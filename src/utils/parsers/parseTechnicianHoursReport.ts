import * as XLSX from "xlsx";

/**
 * Technician Hours Report Parser
 *
 * Report format (vertical):
 *  - Each technician block starts with a row whose first cell is the technician name
 *  - Date columns run across the header row (individual calendar dates)
 *  - Rows inside each block contain a label in column A (e.g. "Sold Hrs", "Clocked In Hrs")
 *    and numeric values under each date column
 *  - The next technician block starts when another name appears in column A
 *
 * We produce:
 *  - weeklyTotals  – summed Mon-Sun week buckets (using existing fiscal week start = Monday)
 *  - monthlyTotals – sum of all days in the selected month
 *  - productive    – soldHrs / clockedInHrs  (null if denominator is 0)
 */

export interface TechnicianDailyValue {
  date: string; // ISO "YYYY-MM-DD"
  soldHrs: number;
  clockedInHrs: number;
}

export interface TechnicianWeeklyTotal {
  weekStartDate: string; // ISO Monday date "YYYY-MM-DD"
  soldHrs: number;
  clockedInHrs: number;
  productive: number | null; // soldHrs / clockedInHrs
}

export interface TechnicianMonthlyTotal {
  month: string; // "YYYY-MM"
  soldHrs: number;
  clockedInHrs: number;
  productive: number | null;
}

export interface TechnicianData {
  rawName: string;
  displayName: string;
  dailyValues: TechnicianDailyValue[];
  weeklyTotals: TechnicianWeeklyTotal[];
  monthlyTotals: TechnicianMonthlyTotal[];
}

export interface TechnicianHoursParseResult {
  storeName: string;
  month: string; // "YYYY-MM" – the dominant month in the report
  technicians: TechnicianData[];
  detectedNames: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const parseNumeric = (v: any): number => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const cleaned = String(v).replace(/[$,\s]/g, "").trim();
  if (cleaned === "" || cleaned === "-") return 0;
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

/** Convert an Excel serial date or a JS Date to "YYYY-MM-DD" */
const toISODate = (v: any): string | null => {
  if (v == null) return null;
  let d: Date | null = null;
  if (v instanceof Date) {
    d = v;
  } else if (typeof v === "number") {
    // XLSX serial date: days since 1899-12-30
    d = XLSX.SSF.parse_date_code(v) as any;
    if (d && typeof d === "object" && "y" in d) {
      const { y, m, d: day } = d as any;
      return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  } else if (typeof v === "string") {
    // Try common date string patterns
    const mm = v.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
    if (mm) {
      const [, a, b, c] = mm;
      const year = c.length === 2 ? 2000 + parseInt(c) : parseInt(c);
      d = new Date(year, parseInt(a) - 1, parseInt(b));
    } else {
      d = new Date(v);
    }
  }
  if (!d || isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Return Monday ISO date for a given ISO date string */
const getMondayOfWeek = (iso: string): string => {
  const d = new Date(iso + "T12:00:00Z");
  const day = d.getUTCDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
};

/** Label normalisation for row-type detection */
const normLabel = (v: any): string => String(v ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();

const isSoldHrsRow = (label: string): boolean =>
  label.includes("sold hrs") || label.includes("sold hours") ||
  label.includes("clsd hrs") || label.includes("closed hrs") || label.includes("closed hours") ||
  label.includes("open and closed") || label.includes("open & closed");

const isClockInHrsRow = (label: string): boolean =>
  label.includes("clocked in") || label.includes("clock in") || label.includes("avail") ||
  label.includes("available");

/** Heuristic: is this cell a technician name (not a date, number, or known label)? */
const looksLikeTechnicianName = (v: any, knownLabels: Set<string>): boolean => {
  if (v == null || v === "") return false;
  if (typeof v === "number") return false;
  const s = String(v).trim();
  if (s.length < 2 || s.length > 60) return false;
  const low = s.toLowerCase();
  // Exclude known header/label words
  const excluded = [
    "technician", "tech", "advisor", "date", "day", "week", "month", "total",
    "sold hrs", "clocked", "available", "productive", "efficiency", "hours",
    "name", "employee", "store", "department", "", "grand total", "dept total",
  ];
  if (excluded.some(e => low === e || low.startsWith(e + " ") || low.endsWith(" " + e))) return false;
  if (knownLabels.has(low)) return false;
  // Must contain at least one letter
  if (!/[a-zA-Z]/.test(s)) return false;
  // Looks like a date string → skip
  if (/^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/.test(s)) return false;
  if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(s) && s.length < 12) return false;
  return true;
};

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export const parseTechnicianHoursReport = (file: File): Promise<TechnicianHoursParseResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary", cellDates: true });

        // Prefer a sheet with "tech" in the name, else first sheet
        let sheetName = workbook.SheetNames[0];
        for (const name of workbook.SheetNames) {
          if (/tech|hour|productivity/i.test(name)) {
            sheetName = name;
            break;
          }
        }

        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
          reject(new Error("No sheets found in workbook"));
          return;
        }

        // Parse with raw values so we can inspect dates
        const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          raw: false,      // formatted strings for most
          dateNF: "yyyy-mm-dd",
        });

        // Also parse with raw: true to get actual numeric date serials when needed
        const rawRowsTyped: any[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          raw: true,
        });

        console.log("[TechParse] Sheet:", sheetName, "rows:", rawRows.length);

        // ----------------------------------------------------------------
        // Step 1: Find the date header row
        // ----------------------------------------------------------------
        let dateHeaderRowIndex = -1;
        let dateColumns: Array<{ colIndex: number; iso: string }> = [];

        for (let ri = 0; ri < Math.min(30, rawRows.length); ri++) {
          const row = rawRowsTyped[ri];
          if (!row) continue;
          const candidates: Array<{ colIndex: number; iso: string }> = [];
          for (let ci = 1; ci < row.length; ci++) {
            const v = row[ci];
            const iso = toISODate(v);
            if (iso) candidates.push({ colIndex: ci, iso });
          }
          if (candidates.length >= 3) {
            dateHeaderRowIndex = ri;
            dateColumns = candidates;
            break;
          }
        }

        // Fallback: look for string dates in formatted rows
        if (dateHeaderRowIndex === -1) {
          for (let ri = 0; ri < Math.min(30, rawRows.length); ri++) {
            const row = rawRows[ri];
            if (!row) continue;
            const candidates: Array<{ colIndex: number; iso: string }> = [];
            for (let ci = 1; ci < row.length; ci++) {
              const v = row[ci];
              const iso = toISODate(v);
              if (iso) candidates.push({ colIndex: ci, iso });
            }
            if (candidates.length >= 3) {
              dateHeaderRowIndex = ri;
              dateColumns = candidates;
              break;
            }
          }
        }

        if (dateHeaderRowIndex === -1 || dateColumns.length === 0) {
          reject(new Error("Could not find date header row in technician report. Make sure the file has daily date columns."));
          return;
        }

        console.log("[TechParse] Date header row:", dateHeaderRowIndex, "columns:", dateColumns.length);

        // Determine dominant month from date columns
        const monthCounts: Record<string, number> = {};
        for (const { iso } of dateColumns) {
          const m = iso.slice(0, 7);
          monthCounts[m] = (monthCounts[m] ?? 0) + 1;
        }
        const dominantMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

        // ----------------------------------------------------------------
        // Step 2: Collect known row labels for name detection
        // ----------------------------------------------------------------
        const knownLabels = new Set<string>();
        for (let ri = dateHeaderRowIndex + 1; ri < rawRows.length; ri++) {
          const v = rawRows[ri]?.[0];
          if (v != null && v !== "") {
            const nl = normLabel(v);
            if (isSoldHrsRow(nl) || isClockInHrsRow(nl)) {
              knownLabels.add(nl);
              knownLabels.add(String(v).toLowerCase().trim());
            }
          }
        }

        // ----------------------------------------------------------------
        // Step 3: Walk rows and build technician blocks
        // ----------------------------------------------------------------
        const technicians: TechnicianData[] = [];
        let currentTech: { name: string; soldHrs: Record<string, number>; clockedInHrs: Record<string, number> } | null = null;

        for (let ri = dateHeaderRowIndex + 1; ri < rawRows.length; ri++) {
          const rowFormatted = rawRows[ri];
          const rowRaw = rawRowsTyped[ri];
          if (!rowFormatted || rowFormatted.every((c: any) => c == null || c === "")) continue;

          const col0 = String(rowFormatted[0] ?? "").trim();
          const nl = normLabel(col0);

          // Check if this row starts a new technician block
          if (looksLikeTechnicianName(col0, knownLabels)) {
            // Save previous technician
            if (currentTech) {
              technicians.push(buildTechnicianData(currentTech));
            }
            currentTech = { name: col0, soldHrs: {}, clockedInHrs: {} };
            console.log("[TechParse] Found technician:", col0);
            continue;
          }

          if (!currentTech) continue;

          // Check if this is a Sold Hrs or Clocked In Hrs row
          const isSold = isSoldHrsRow(nl);
          const isClock = isClockInHrsRow(nl);

          if (!isSold && !isClock) continue;

          // Extract values for each date column
          for (const { colIndex, iso } of dateColumns) {
            const val = parseNumeric(rowRaw?.[colIndex] ?? rowFormatted?.[colIndex]);
            if (isSold) {
              currentTech.soldHrs[iso] = (currentTech.soldHrs[iso] ?? 0) + val;
            } else {
              currentTech.clockedInHrs[iso] = (currentTech.clockedInHrs[iso] ?? 0) + val;
            }
          }
        }

        // Save last technician
        if (currentTech) {
          technicians.push(buildTechnicianData(currentTech));
        }

        // Deduplicate: merge entries with the same name (case-insensitive)
        const mergedMap = new Map<string, TechnicianData>();
        for (const tech of technicians) {
          const key = tech.rawName.toLowerCase().trim();
          if (mergedMap.has(key)) {
            const existing = mergedMap.get(key)!;
            // Merge daily values by date
            const dateMap = new Map<string, TechnicianDailyValue>();
            for (const dv of existing.dailyValues) dateMap.set(dv.date, { ...dv });
            for (const dv of tech.dailyValues) {
              if (dateMap.has(dv.date)) {
                const e = dateMap.get(dv.date)!;
                dateMap.set(dv.date, {
                  date: dv.date,
                  soldHrs: e.soldHrs + dv.soldHrs,
                  clockedInHrs: e.clockedInHrs + dv.clockedInHrs,
                });
              } else {
                dateMap.set(dv.date, { ...dv });
              }
            }
            // Rebuild from merged daily values
            const soldHrs: Record<string, number> = {};
            const clockedInHrs: Record<string, number> = {};
            for (const dv of dateMap.values()) {
              soldHrs[dv.date] = dv.soldHrs;
              clockedInHrs[dv.date] = dv.clockedInHrs;
            }
            mergedMap.set(key, buildTechnicianData({ name: existing.rawName, soldHrs, clockedInHrs }));
          } else {
            mergedMap.set(key, tech);
          }
        }
        const deduped = Array.from(mergedMap.values());

        console.log("[TechParse] Found", technicians.length, "technicians,", deduped.length, "after dedup");

        // Extract store name from top rows
        let storeName = "Unknown Store";
        for (let ri = 0; ri < Math.min(5, rawRows.length); ri++) {
          for (const cell of rawRows[ri] ?? []) {
            if (typeof cell === "string" && cell.length > 5 &&
              /chevrolet|ford|toyota|honda|dodge|chrysler|jeep|ram|gmc|buick|hyundai|kia|mazda|motors|auto/i.test(cell)) {
              storeName = cell.trim();
              break;
            }
          }
        }

        resolve({
          storeName,
          month: dominantMonth,
          technicians: deduped,
          detectedNames: deduped.map(t => t.rawName),
        });

      } catch (err: any) {
        console.error("[TechParse] Error:", err);
        reject(new Error(err.message ?? "Failed to parse technician hours report"));
      }
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsBinaryString(file);
  });
};

// ---------------------------------------------------------------------------
// Build aggregated data for one technician
// ---------------------------------------------------------------------------

function buildTechnicianData(raw: {
  name: string;
  soldHrs: Record<string, number>;
  clockedInHrs: Record<string, number>;
}): TechnicianData {
  const allDates = Array.from(
    new Set([...Object.keys(raw.soldHrs), ...Object.keys(raw.clockedInHrs)])
  ).sort();

  const dailyValues: TechnicianDailyValue[] = allDates.map(date => ({
    date,
    soldHrs: raw.soldHrs[date] ?? 0,
    clockedInHrs: raw.clockedInHrs[date] ?? 0,
  }));

  // Group by week (Monday start)
  const weekMap: Record<string, { soldHrs: number; clockedInHrs: number }> = {};
  for (const dv of dailyValues) {
    const monday = getMondayOfWeek(dv.date);
    if (!weekMap[monday]) weekMap[monday] = { soldHrs: 0, clockedInHrs: 0 };
    weekMap[monday].soldHrs += dv.soldHrs;
    weekMap[monday].clockedInHrs += dv.clockedInHrs;
  }

  const weeklyTotals: TechnicianWeeklyTotal[] = Object.entries(weekMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStartDate, totals]) => ({
      weekStartDate,
      soldHrs: totals.soldHrs,
      clockedInHrs: totals.clockedInHrs,
      productive: totals.clockedInHrs > 0 ? totals.soldHrs / totals.clockedInHrs : null,
    }));

  // Group by month
  const monthMap: Record<string, { soldHrs: number; clockedInHrs: number }> = {};
  for (const dv of dailyValues) {
    const month = dv.date.slice(0, 7);
    if (!monthMap[month]) monthMap[month] = { soldHrs: 0, clockedInHrs: 0 };
    monthMap[month].soldHrs += dv.soldHrs;
    monthMap[month].clockedInHrs += dv.clockedInHrs;
  }

  const monthlyTotals: TechnicianMonthlyTotal[] = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, totals]) => ({
      month,
      soldHrs: totals.soldHrs,
      clockedInHrs: totals.clockedInHrs,
      productive: totals.clockedInHrs > 0 ? totals.soldHrs / totals.clockedInHrs : null,
    }));

  return {
    rawName: raw.name,
    displayName: raw.name,
    dailyValues,
    weeklyTotals,
    monthlyTotals,
  };
}
