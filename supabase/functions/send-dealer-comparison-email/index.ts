import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import XLSX from "npm:xlsx-js-style@1.2.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ComparisonMetric {
  metricName: string;
  displayName?: string;
  isPercentage?: boolean;
  lowerIsBetter?: boolean;
  storeValues: Record<string, { value: number | null; target: number | null; variance: number | null }>;
}

interface StoreInfo {
  storeId: string;
  storeName: string;
  departmentName?: string;
  monthsWithData: string[];
  lastCompleteMonth: string | null;
  isComplete: boolean;
}

interface QuestionnaireAnswer {
  storeName: string;
  departmentName: string;
  questionText: string;
  answerValue: string | null;
}

interface EmailRequest {
  recipientEmails: string[];
  stores: StoreInfo[];
  metrics: ComparisonMetric[];
  questionnaireData?: QuestionnaireAnswer[];
  metricType?: string;
  selectedMetrics: string[];
  datePeriodType: string;
  selectedMonth?: string;
  selectedYear?: number;
  startMonth?: string;
  endMonth?: string;
  comparisonMode: string;
  filterName?: string;
  brandDisplayName?: string;
  selectedDepartmentNames?: string[];
  isYoyMonth?: boolean;
  yoyCurrentYear?: number;
  yoyPrevYear?: number;
  attachExcel?: boolean;
}

// ===================== Excel Style Constants =====================

const greenFill = { fgColor: { rgb: "C6EFCE" } };
const greenFont = { color: { rgb: "006100" } };
const yellowFill = { fgColor: { rgb: "FFEB9C" } };
const yellowFont = { color: { rgb: "9C5700" } };
const redFill = { fgColor: { rgb: "FFC7CE" } };
const redFont = { color: { rgb: "9C0006" } };

const headerStyle = {
  fill: { fgColor: { rgb: "F2F2F2" } },
  font: { bold: true, sz: 11 },
  border: {
    top: { style: "thin", color: { rgb: "D0D0D0" } },
    bottom: { style: "thin", color: { rgb: "D0D0D0" } },
    left: { style: "thin", color: { rgb: "D0D0D0" } },
    right: { style: "thin", color: { rgb: "D0D0D0" } },
  },
  alignment: { horizontal: "center", vertical: "center" },
};

const metricLabelStyle = {
  font: { bold: true, sz: 11 },
  border: {
    top: { style: "thin", color: { rgb: "D0D0D0" } },
    bottom: { style: "thin", color: { rgb: "D0D0D0" } },
    left: { style: "thin", color: { rgb: "D0D0D0" } },
    right: { style: "thin", color: { rgb: "D0D0D0" } },
  },
};

const cellBorder = {
  top: { style: "thin", color: { rgb: "D0D0D0" } },
  bottom: { style: "thin", color: { rgb: "D0D0D0" } },
  left: { style: "thin", color: { rgb: "D0D0D0" } },
  right: { style: "thin", color: { rgb: "D0D0D0" } },
};

// ===================== Helper Functions =====================

function formatValue(value: number | null, isPercentage: boolean): string {
  if (value === null || value === undefined) return "-";
  if (isPercentage) return `${value.toFixed(1)}%`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDiffValue(diff: number, isPercentage: boolean): string {
  const sign = diff >= 0 ? "+" : "";
  if (isPercentage) return `${sign}${diff.toFixed(1)}%`;
  return `${sign}${new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(diff)}`;
}

function formatMonthShort(month: string): string {
  const date = new Date(month + '-15');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

function detectPercentage(metricName: string): boolean {
  const lowerName = metricName.toLowerCase();
  const percentageMetrics = ["return on gross", "service absorption", "parts to service ratio"];
  return (
    metricName.includes("%") ||
    lowerName.includes("percent") ||
    percentageMetrics.some(m => lowerName === m)
  );
}

function getVarianceStyle(variance: number | null) {
  if (variance === null) return { border: cellBorder };
  if (variance >= 10) return { fill: { patternType: "solid", ...greenFill }, font: greenFont, border: cellBorder };
  if (variance >= -10) return { fill: { patternType: "solid", ...yellowFill }, font: yellowFont, border: cellBorder };
  return { fill: { patternType: "solid", ...redFill }, font: redFont, border: cellBorder };
}

function getDiffStyle(diff: number | null, lowerIsBetter: boolean) {
  if (diff === null || diff === 0) return { border: cellBorder };
  const favorable = lowerIsBetter ? diff < 0 : diff > 0;
  if (favorable) return { fill: { patternType: "solid", ...greenFill }, font: greenFont, border: cellBorder };
  return { fill: { patternType: "solid", ...redFill }, font: redFont, border: cellBorder };
}

function getQuestionnaireStyle(answer: string | null) {
  if (!answer) return { border: cellBorder };
  const lower = answer.toLowerCase().trim();
  if (lower === "yes" || lower === "true") return { fill: { patternType: "solid", ...greenFill }, font: greenFont, border: cellBorder };
  if (lower === "no" || lower === "false") return { fill: { patternType: "solid", ...redFill }, font: redFont, border: cellBorder };
  return { border: cellBorder };
}

function makeCell(value: string | number | null, style: Record<string, unknown>, numFmt?: string) {
  if (value === null || value === undefined) {
    return { v: "-", t: "s", s: { ...style, alignment: { horizontal: "center" } } };
  }
  if (typeof value === "number") {
    const s: Record<string, unknown> = { ...style, alignment: { horizontal: "center" } };
    if (numFmt) s.numFmt = numFmt;
    return { v: value, t: "n", s };
  }
  return { v: value, t: "s", s: { ...style, alignment: { horizontal: "center" } } };
}

// ===================== Excel Generation Functions =====================

function generateStandardExcel(
  stores: StoreInfo[],
  metrics: ComparisonMetric[],
  periodDescription: string,
): Uint8Array {
  const wb = XLSX.utils.book_new();
  const wsData: unknown[][] = [];

  // Header row
  const headerRow = [{ v: "Metric", s: { ...headerStyle, alignment: { horizontal: "left" } } }];
  stores.forEach(store => {
    headerRow.push({ v: store.storeName, s: headerStyle } as any);
  });
  wsData.push(headerRow);

  // Metric rows
  metrics.forEach(metric => {
    const displayName = metric.displayName || metric.metricName;
    const isPercent = metric.isPercentage ?? detectPercentage(displayName);
    const numFmt = isPercent ? "0.0%" : "$#,##0";

    const row: unknown[] = [{ v: displayName, s: metricLabelStyle }];

    stores.forEach(store => {
      const sv = metric.storeValues[store.storeId];
      if (!sv || sv.value === null) {
        row.push(makeCell(null, getVarianceStyle(null)));
      } else {
        const excelValue = isPercent ? sv.value / 100 : sv.value;
        row.push(makeCell(excelValue, getVarianceStyle(sv.variance), numFmt));
      }
    });

    wsData.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws["!cols"] = [{ wch: 30 }, ...stores.map(() => ({ wch: 18 }))];

  XLSX.utils.book_append_sheet(wb, ws, periodDescription || "Comparison");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Uint8Array(buf);
}

function generateYoyExcel(
  stores: StoreInfo[],
  metrics: ComparisonMetric[],
  periodDescription: string,
  curYearLabel: string | number,
  prevYearLabel: string | number,
): Uint8Array {
  const wb = XLSX.utils.book_new();
  const wsData: unknown[][] = [];

  // Header row 1: Metric + store names (each spanning 3 cols)
  const headerRow1: unknown[] = [{ v: "Metric", s: { ...headerStyle, alignment: { horizontal: "left" } } }];
  stores.forEach(store => {
    headerRow1.push({ v: store.storeName, s: headerStyle });
    headerRow1.push({ v: "", s: headerStyle });
    headerRow1.push({ v: "", s: headerStyle });
  });
  wsData.push(headerRow1);

  // Header row 2: sub-headers per store
  const headerRow2: unknown[] = [{ v: "", s: headerStyle }];
  stores.forEach(() => {
    headerRow2.push({ v: String(curYearLabel), s: headerStyle });
    headerRow2.push({ v: String(prevYearLabel), s: headerStyle });
    headerRow2.push({ v: "Diff", s: headerStyle });
  });
  wsData.push(headerRow2);

  // Metric rows
  metrics.forEach(metric => {
    const displayName = metric.displayName || metric.metricName;
    const isPercent = metric.isPercentage ?? detectPercentage(displayName);
    const lowerIsBetter = metric.lowerIsBetter ?? false;
    const numFmt = isPercent ? "0.0%" : "$#,##0";

    const row: unknown[] = [{ v: displayName, s: metricLabelStyle }];

    stores.forEach(store => {
      const sv = metric.storeValues[store.storeId];
      const curValue = sv?.value ?? null;
      const lyValue = sv?.target ?? null;
      const diff = (curValue !== null && lyValue !== null) ? curValue - lyValue : null;

      // Current year
      if (curValue !== null) {
        const ev = isPercent ? curValue / 100 : curValue;
        row.push(makeCell(ev, { border: cellBorder }, numFmt));
      } else {
        row.push(makeCell(null, { border: cellBorder }));
      }

      // Last year
      if (lyValue !== null) {
        const ev = isPercent ? lyValue / 100 : lyValue;
        row.push(makeCell(ev, { border: cellBorder, font: { color: { rgb: "666666" } } }, numFmt));
      } else {
        row.push(makeCell(null, { border: cellBorder }));
      }

      // Diff with color
      if (diff !== null) {
        const ev = isPercent ? diff / 100 : diff;
        row.push(makeCell(ev, getDiffStyle(diff, lowerIsBetter), isPercent ? "+0.0%;-0.0%" : "+$#,##0;-$#,##0"));
      } else {
        row.push(makeCell(null, { border: cellBorder }));
      }
    });

    wsData.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Merge store name headers
  const merges: XLSX.Range[] = [];
  stores.forEach((_, i) => {
    const startCol = 1 + i * 3;
    merges.push({ s: { r: 0, c: startCol }, e: { r: 0, c: startCol + 2 } });
  });
  ws["!merges"] = merges;

  // Column widths
  ws["!cols"] = [{ wch: 30 }, ...stores.flatMap(() => [{ wch: 16 }, { wch: 16 }, { wch: 16 }])];

  XLSX.utils.book_append_sheet(wb, ws, periodDescription || "YOY Comparison");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Uint8Array(buf);
}

function generateQuestionnaireExcel(
  questionnaireData: QuestionnaireAnswer[],
  selectedMetrics: string[],
): Uint8Array {
  const wb = XLSX.utils.book_new();

  // Group data by store+department
  const storeMap = new Map<string, { storeName: string; departmentName: string; answers: Map<string, string | null> }>();
  questionnaireData.forEach(item => {
    const key = `${item.storeName}|${item.departmentName}`;
    if (!storeMap.has(key)) {
      storeMap.set(key, { storeName: item.storeName, departmentName: item.departmentName, answers: new Map() });
    }
    storeMap.get(key)!.answers.set(item.questionText, item.answerValue);
  });

  const uniqueQuestions = selectedMetrics.filter(q =>
    questionnaireData.some(d => d.questionText === q)
  );
  const storesArray = Array.from(storeMap.values()).sort((a, b) => a.storeName.localeCompare(b.storeName));

  const wsData: unknown[][] = [];

  // Header
  const headerRow: unknown[] = [{ v: "Question", s: { ...headerStyle, alignment: { horizontal: "left" } } }];
  storesArray.forEach(store => {
    headerRow.push({ v: `${store.storeName} - ${store.departmentName}`, s: headerStyle });
  });
  wsData.push(headerRow);

  // Question rows
  uniqueQuestions.forEach(question => {
    const row: unknown[] = [{ v: question, s: metricLabelStyle }];
    storesArray.forEach(store => {
      const answer = store.answers.get(question) ?? null;
      const displayValue = answer ?? "-";
      row.push({ v: displayValue, t: "s", s: { ...getQuestionnaireStyle(answer), alignment: { horizontal: "center" } } });
    });
    wsData.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{ wch: 45 }, ...storesArray.map(() => ({ wch: 22 }))];

  XLSX.utils.book_append_sheet(wb, ws, "Questionnaire");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Uint8Array(buf);
}

// ===================== Encode to Base64 =====================

function uint8ArrayToBase64(uint8Array: Uint8Array): string {
  let binary = "";
  const len = uint8Array.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

// ===================== HTML Email Builders =====================
// (kept identical to original)

function buildQuestionnaireHtml(
  questionnaireData: QuestionnaireAnswer[],
  selectedMetrics: string[],
  reportTitle: string,
  brandLine: string,
  departmentLine: string,
): string {
  const storeMap = new Map<string, { storeName: string; departmentName: string; answers: Map<string, string | null> }>();
  questionnaireData.forEach((item: QuestionnaireAnswer) => {
    const key = `${item.storeName}|${item.departmentName}`;
    if (!storeMap.has(key)) {
      storeMap.set(key, { storeName: item.storeName, departmentName: item.departmentName, answers: new Map() });
    }
    storeMap.get(key)!.answers.set(item.questionText, item.answerValue);
  });

  const uniqueQuestions = selectedMetrics.filter(q =>
    questionnaireData.some((d: QuestionnaireAnswer) => d.questionText === q)
  );
  const storesArray = Array.from(storeMap.values()).sort((a, b) => a.storeName.localeCompare(b.storeName));

  const formatAnswer = (value: string | null): string => {
    if (value === null || value === undefined || value === '') return '<span style="color: #999;">—</span>';
    const lowerValue = value.toLowerCase().trim();
    if (lowerValue === 'yes' || lowerValue === 'true') return '<span style="color: #16a34a; font-weight: 500;">✓ Yes</span>';
    if (lowerValue === 'no' || lowerValue === 'false') return '<span style="color: #dc2626; font-weight: 500;">✗ No</span>';
    if (lowerValue === 'n/a' || lowerValue === 'na') return '<span style="color: #666;">N/A</span>';
    if (value.length > 40) return value.substring(0, 40) + '...';
    return value;
  };

  let html = `<!DOCTYPE html><html><head></head><body style="font-family: Arial, sans-serif; margin: 20px; color: #333;">
    <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 8px;">${reportTitle}</h1>
    <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
      <strong>${brandLine}</strong>${departmentLine ? ` • <strong>${departmentLine}</strong>` : ''} • ${storesArray.length} stores compared • ${uniqueQuestions.length} questions
    </p>
    <table style="border-collapse: collapse; width: 100%; margin-top: 20px;">
      <thead><tr>
        <th style="border: 1px solid #ddd; padding: 10px 12px; text-align: left; font-size: 13px; background-color: #f8f8f8; font-weight: 600;">Question</th>`;

  storesArray.forEach(store => {
    html += `<th style="border: 1px solid #ddd; padding: 10px 12px; text-align: center; font-size: 13px; background-color: #f8f8f8; font-weight: 600; min-width: 150px;">
      ${store.storeName}<div style="font-size: 11px; color: #666; font-weight: normal; margin-top: 2px;">${store.departmentName}</div></th>`;
  });
  html += `</tr></thead><tbody>`;

  uniqueQuestions.forEach(question => {
    html += `<tr><td style="border: 1px solid #ddd; padding: 10px 12px; text-align: left; font-size: 13px; font-weight: 500; max-width: 300px;">${question}</td>`;
    storesArray.forEach(store => {
      const answer = store.answers.get(question);
      html += `<td style="border: 1px solid #ddd; padding: 10px 12px; text-align: center; font-size: 13px;">${formatAnswer(answer ?? null)}</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table>
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #888;">
      <p>This report was generated by the Growth Scorecard application.</p>
      <p>Generated on ${new Date().toLocaleString()}</p>
    </div></body></html>`;

  return html;
}

function buildYoyHtml(
  stores: StoreInfo[],
  metrics: ComparisonMetric[],
  reportTitle: string,
  brandLine: string,
  departmentLine: string,
  periodDescription: string,
  curYearLabel: string | number,
  prevYearLabel: string | number,
): string {
  let html = `<!DOCTYPE html><html><head></head><body style="font-family: Arial, sans-serif; margin: 20px; color: #333;">
    <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 8px;">${reportTitle}</h1>
    <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
      <strong>${brandLine}</strong>${departmentLine ? ` • <strong>${departmentLine}</strong>` : ''} • ${periodDescription} • Year over Year • ${stores.length} stores compared
    </p>
    <table style="border-collapse: collapse; width: 100%; margin-top: 20px;">
      <thead><tr>
        <th style="border: 1px solid #ddd; padding: 10px 12px; text-align: left; font-size: 13px; background-color: #f8f8f8; font-weight: 600;" rowspan="2">Metric</th>`;

  stores.forEach(store => {
    html += `<th style="border: 1px solid #ddd; padding: 10px 12px; text-align: center; font-size: 13px; background-color: #f8f8f8; font-weight: 600; min-width: 280px;" colspan="3">${store.storeName}</th>`;
  });
  html += `</tr><tr>`;
  stores.forEach(() => {
    html += `<th style="border: 1px solid #ddd; padding: 6px 8px; text-align: center; font-size: 11px; background-color: #f0f0f0; font-weight: 600; min-width: 90px;">${curYearLabel}</th>
      <th style="border: 1px solid #ddd; padding: 6px 8px; text-align: center; font-size: 11px; background-color: #f0f0f0; font-weight: 600; min-width: 90px;">${prevYearLabel}</th>
      <th style="border: 1px solid #ddd; padding: 6px 8px; text-align: center; font-size: 11px; background-color: #f0f0f0; font-weight: 600; min-width: 80px;">Diff</th>`;
  });
  html += `</tr></thead><tbody>`;

  metrics.forEach(metric => {
    const displayName = metric.displayName || metric.metricName;
    const isPercent = metric.isPercentage ?? detectPercentage(displayName);
    const lowerIsBetter = metric.lowerIsBetter ?? false;

    html += `<tr><td style="border: 1px solid #ddd; padding: 10px 12px; text-align: left; font-size: 13px; font-weight: 500;">${displayName}</td>`;
    stores.forEach(store => {
      const sv = metric.storeValues[store.storeId];
      const curValue = sv?.value ?? null;
      const lyValue = sv?.target ?? null;
      const diff = (curValue !== null && lyValue !== null) ? curValue - lyValue : null;

      let diffColor = "#666";
      if (diff !== null && diff !== 0) {
        const favorable = lowerIsBetter ? diff < 0 : diff > 0;
        diffColor = favorable ? "#16a34a" : "#dc2626";
      }

      html += `<td style="border: 1px solid #ddd; padding: 8px 10px; text-align: center; font-size: 14px; font-weight: 600;">${formatValue(curValue, isPercent)}</td>`;
      html += `<td style="border: 1px solid #ddd; padding: 8px 10px; text-align: center; font-size: 13px; color: #666;">${formatValue(lyValue, isPercent)}</td>`;
      if (diff !== null) {
        html += `<td style="border: 1px solid #ddd; padding: 8px 10px; text-align: center; font-size: 13px; font-weight: 500; color: ${diffColor};">${formatDiffValue(diff, isPercent)}</td>`;
      } else {
        html += `<td style="border: 1px solid #ddd; padding: 8px 10px; text-align: center; font-size: 13px; color: #999;">-</td>`;
      }
    });
    html += `</tr>`;
  });

  html += `</tbody></table>
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #888;">
      <p>This report was generated by the Growth Scorecard application.</p>
      <p>Generated on ${new Date().toLocaleString()}</p>
    </div></body></html>`;

  return html;
}

function buildStandardHtml(
  stores: StoreInfo[],
  metrics: ComparisonMetric[],
  reportTitle: string,
  brandLine: string,
  departmentLine: string,
  periodDescription: string,
  comparisonDescription: string,
  comparisonMode: string,
  datePeriodType: string,
): string {
  let html = `<!DOCTYPE html><html><head></head><body style="font-family: Arial, sans-serif; margin: 20px; color: #333;">
    <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 8px;">${reportTitle}</h1>
    <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
      <strong>${brandLine}</strong>${departmentLine ? ` • <strong>${departmentLine}</strong>` : ''} • ${periodDescription} • ${comparisonDescription} • ${stores.length} stores compared
    </p>
    <table style="border-collapse: collapse; width: 100%; margin-top: 20px;">
      <thead><tr>
        <th style="border: 1px solid #ddd; padding: 10px 12px; text-align: left; font-size: 13px; background-color: #f8f8f8; font-weight: 600;">Metric</th>`;

  stores.forEach(store => {
    const statusColor = store.isComplete ? '#16a34a' : '#ca8a04';
    const statusText = store.lastCompleteMonth ? `Thru ${formatMonthShort(store.lastCompleteMonth)}` : 'No data';
    html += `<th style="border: 1px solid #ddd; padding: 10px 12px; text-align: center; font-size: 13px; background-color: #f8f8f8; font-weight: 600; min-width: 180px;">
      ${store.storeName}${datePeriodType !== "month" ? `<div style="font-size: 11px; color: ${statusColor}; font-weight: normal; margin-top: 4px;">${statusText}</div>` : ''}</th>`;
  });

  html += `</tr></thead><tbody>`;

  metrics.forEach(metric => {
    const displayName = metric.displayName || metric.metricName;
    const isPercent = metric.isPercentage ?? detectPercentage(displayName);
    html += `<tr><td style="border: 1px solid #ddd; padding: 10px 12px; text-align: left; font-size: 13px; font-weight: 500;">${displayName}</td>`;

    stores.forEach(store => {
      const sv = metric.storeValues[store.storeId];
      if (sv && sv.value !== null) {
        let varianceBgColor = "";
        let varianceTextColor = "";
        if (sv.variance !== null) {
          if (sv.variance >= 10) { varianceBgColor = "#dcfce7"; varianceTextColor = "#166534"; }
          else if (sv.variance >= -10) { varianceBgColor = "#fef9c3"; varianceTextColor = "#854d0e"; }
          else { varianceBgColor = "#fee2e2"; varianceTextColor = "#991b1b"; }
        }
        const targetLabel = comparisonMode === "year_over_year" ? "LY" : "Target";
        html += `<td style="border: 1px solid #ddd; padding: 10px 12px; text-align: center; font-size: 13px;">
          <div style="font-size: 15px; font-weight: 600;">${formatValue(sv.value, isPercent)}</div>
          ${sv.target !== null ? `<div style="font-size: 11px; color: #888; margin-top: 2px;">${targetLabel}: ${formatValue(sv.target, isPercent)}</div>` : ''}
          ${sv.variance !== null ? `<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; margin-top: 4px; background-color: ${varianceBgColor}; color: ${varianceTextColor};">${sv.variance >= 0 ? '+' : ''}${sv.variance.toFixed(1)}%</span>` : ''}
        </td>`;
      } else {
        html += `<td style="border: 1px solid #ddd; padding: 10px 12px; text-align: center; font-size: 13px; color: #999;">No data</td>`;
      }
    });
    html += `</tr>`;
  });

  html += `</tbody></table>
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #888;">
      <p>This report was generated by the Growth Scorecard application.</p>
      <p>Generated on ${new Date().toLocaleString()}</p>
    </div></body></html>`;

  return html;
}

// ===================== Main Handler =====================

const handler = async (req: Request): Promise<Response> => {
  console.log("=== Dealer Comparison Email function called ===");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const {
      recipientEmails, stores, metrics, questionnaireData, metricType,
      selectedMetrics, datePeriodType, selectedMonth, selectedYear,
      startMonth, endMonth, comparisonMode, filterName, brandDisplayName,
      selectedDepartmentNames, isYoyMonth, yoyCurrentYear, yoyPrevYear,
      attachExcel,
    }: EmailRequest = await req.json();

    console.log("Sending dealer comparison email to:", recipientEmails);
    console.log("Metric type:", metricType, "isYoyMonth:", isYoyMonth, "attachExcel:", attachExcel);
    console.log("Stores:", stores.length, "Metrics:", metrics.length);

    // Build period description
    let periodDescription = "";
    if (datePeriodType === "month" && selectedMonth) periodDescription = formatMonthShort(selectedMonth);
    else if (datePeriodType === "full_year" && selectedYear) periodDescription = `Full Year ${selectedYear}`;
    else if (datePeriodType === "custom_range" && startMonth && endMonth) periodDescription = `${formatMonthShort(startMonth)} - ${formatMonthShort(endMonth)}`;

    let comparisonDescription = "";
    if (comparisonMode === "targets") comparisonDescription = "vs Store Targets";
    else if (comparisonMode === "current_year_avg") comparisonDescription = "vs Current Year Average";
    else if (comparisonMode === "year_over_year") comparisonDescription = "vs Year over Year";

    const reportTitle = filterName ? filterName : (metricType === "dept_info" ? "Service Dept Info Comparison" : "Dealer Comparison Report");
    const brandLine = brandDisplayName || "All Brands";
    const departmentLine = selectedDepartmentNames && selectedDepartmentNames.length > 0
      ? selectedDepartmentNames.join(", ") : "";

    // Build HTML email body
    let html: string;
    if (metricType === "dept_info" && questionnaireData && questionnaireData.length > 0) {
      html = buildQuestionnaireHtml(questionnaireData, selectedMetrics, reportTitle, brandLine, departmentLine);
    } else if (isYoyMonth) {
      html = buildYoyHtml(stores, metrics, reportTitle, brandLine, departmentLine, periodDescription, yoyCurrentYear ?? "", yoyPrevYear ?? "");
    } else {
      html = buildStandardHtml(stores, metrics, reportTitle, brandLine, departmentLine, periodDescription, comparisonDescription, comparisonMode, datePeriodType);
    }

    // Build email subject
    const emailSubject = metricType === "dept_info"
      ? (filterName ? `${filterName} - ${brandLine}` : `Service Dept Info Comparison - ${brandLine}`)
      : (filterName
        ? `${filterName} - ${brandLine} - ${periodDescription}`
        : `Dealer Comparison Report - ${brandLine} - ${periodDescription}`);

    // Generate Excel attachment if requested
    const attachments: { filename: string; content: string }[] = [];
    if (attachExcel !== false) {
      try {
        console.log("Generating Excel attachment...");
        let excelBuffer: Uint8Array;

        if (metricType === "dept_info" && questionnaireData && questionnaireData.length > 0) {
          excelBuffer = generateQuestionnaireExcel(questionnaireData, selectedMetrics);
        } else if (isYoyMonth) {
          excelBuffer = generateYoyExcel(stores, metrics, periodDescription, yoyCurrentYear ?? "", yoyPrevYear ?? "");
        } else {
          excelBuffer = generateStandardExcel(stores, metrics, periodDescription);
        }

        // Build filename
        const fileDate = periodDescription.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\-]/g, "");
        const fileName = `Dealer_Comparison_Report_${fileDate}.xlsx`;

        attachments.push({
          filename: fileName,
          content: uint8ArrayToBase64(excelBuffer),
        });
        console.log("Excel attachment generated:", fileName, "size:", excelBuffer.byteLength, "bytes");
      } catch (excelError) {
        console.error("Error generating Excel attachment (sending email without it):", excelError);
      }
    }

    // Send email using Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

    const emailBody: Record<string, unknown> = {
      from: "Growth Scorecard <reports@dealergrowth.solutions>",
      to: recipientEmails,
      subject: emailSubject,
      html,
    };

    if (attachments.length > 0) {
      emailBody.attachments = attachments;
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailBody),
    });

    const emailResult = await emailResponse.json();
    if (!emailResponse.ok) {
      console.error("Resend API error:", emailResult);
      throw new Error(emailResult.message || "Failed to send email");
    }

    console.log("Email sent successfully:", emailResult);

    return new Response(JSON.stringify({ success: true, emailId: emailResult.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error sending dealer comparison email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
