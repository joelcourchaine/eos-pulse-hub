import * as XLSX from "xlsx";

export interface TechnicianDailyValue {
  date: string;
  soldHrs: number;
  clockedInHrs: number;
}

export interface TechnicianWeeklyTotal {
  weekStartDate: string;
  soldHrs: number;
  clockedInHrs: number;
  productive: number | null;
}

export interface TechnicianMonthlyTotal {
  month: string;
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
  month: string;
  technicians: TechnicianData[];
  detectedNames: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const parseNumeric = (v: any): number => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const cleaned = String(v).replace(/[$,%\s]/g, "").trim();
  if (cleaned === "" || cleaned === "-") return 0;
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

const toISODate = (v: any): string | null => {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  if (typeof v === "number" && v > 1000) {
    const parsed = XLSX.SSF.parse_date_code(v) as any;
    if (parsed && "y" in parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }
  if (typeof v === "string") {
    const mm = v.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
    if (mm) {
      const year = mm[3].length === 2 ? 2000 + parseInt(mm[3]) : parseInt(mm[3]);
      const d = new Date(year, parseInt(mm[1]) - 1, parseInt(mm[2]));
      if (!isNaN(d.getTime()))
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    // Try ISO or other parseable formats
    const d = new Date(v);
    if (!isNaN(d.getTime()) && v.length >= 8)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return null;
};

const getMondayOfWeek = (iso: string): string => {
  const d = new Date(iso + "T12:00:00Z");
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
};

const normCol = (v: any): string =>
  String(v ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------------------
// Main parser — vertical format
// ---------------------------------------------------------------------------

export const parseTechnicianHoursReport = (file: File): Promise<TechnicianHoursParseResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary", cellDates: true });

        let sheetName = workbook.SheetNames[0];
        for (const name of workbook.SheetNames) {
          if (/tech|hour|productivity/i.test(name)) { sheetName = name; break; }
        }

        const sheet = workbook.Sheets[sheetName];
        if (!sheet) { reject(new Error("No sheets found in workbook")); return; }

        // Parse with cellDates for proper Date objects
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

        console.log("[TechParse] Sheet:", sheetName, "rows:", rows.length);

        // ----------------------------------------------------------------
        // Step 1: Find column header row (contains "date", "sold hrs", "clocked in")
        // ----------------------------------------------------------------
        let headerRowIndex = -1;
        let dateColIdx = -1;
        let soldColIdx = -1;
        let clockColIdx = -1;

        for (let ri = 0; ri < Math.min(40, rows.length); ri++) {
          const row = rows[ri];
          if (!row) continue;
          const normed = row.map(normCol);
          const dIdx = normed.findIndex(c => c === "date" || c.startsWith("date "));
          const sIdx = normed.findIndex(c => c.includes("sold hrs") || c.includes("sold hours") || c.includes("clsd hrs") || c.includes("closed hrs"));
          // "Clocked In Hrs" is the available hours column used for the scorecard
          const cIdx = normed.findIndex(c => c.includes("clocked in hrs") || c.includes("clocked in hours") || c === "clocked in");
          if (dIdx !== -1 && sIdx !== -1 && cIdx !== -1) {
            headerRowIndex = ri;
            dateColIdx = dIdx;
            soldColIdx = sIdx;
            clockColIdx = cIdx;
            break;
          }
        }

        // Fallback: use fixed column positions from known Nissan format
          // Col 2 = Date, Col 4 = Sold Hrs, Col 6 = Clocked In Hrs (Available Hours)
          if (headerRowIndex === -1) {
            console.warn("[TechParse] Could not find header row dynamically, using fixed column positions (2,4,6)");
            dateColIdx = 2;
            soldColIdx = 4;
            clockColIdx = 6; // Clocked In Hrs = Available Hours
            headerRowIndex = 0;
          }

        console.log("[TechParse] Header row:", headerRowIndex, "date:", dateColIdx, "sold:", soldColIdx, "clock:", clockColIdx);

        // ----------------------------------------------------------------
        // Step 2: Walk rows, detect technician blocks, collect daily data
        // ----------------------------------------------------------------
        const SKIP_PATTERNS = /^(week total|total \(tech\)|dept total|grand total|page \d|technician productivity|date\b)/i;

        const techBlocks: Array<{ name: string; soldHrs: Record<string, number>; clockedInHrs: Record<string, number> }> = [];
        let current: typeof techBlocks[0] | null = null;

        for (let ri = headerRowIndex + 1; ri < rows.length; ri++) {
          const row = rows[ri];
          if (!row) continue;

          const colA = String(row[0] ?? "").trim();
          const colANorm = colA.toLowerCase();

          // Skip blank rows
          if (!colA && !row[dateColIdx]) continue;

          // Skip known non-data rows
          if (colA && SKIP_PATTERNS.test(colA)) continue;

          // Detect technician header: "13 - Michael Abrahamsz" or name-only
          // Col A is non-empty AND col at dateColIdx is empty/null
          const dateVal = row[dateColIdx];
          const colAHasDate = toISODate(dateVal) !== null;

          if (colA && !colAHasDate) {
            // Check it doesn't look like a page header or store name
            const isTechName = !/productivity report|page \d|\/|\bstore\b|\bdealer\b/i.test(colA)
              && colA.length > 1
              && colA.length < 80;

              if (isTechName) {
              // Strip numeric prefix "13 - " or "605 - " then title-case
              const stripped = colA.replace(/^\d+\s*[-–—]\s*/, "").trim();
              const displayName = stripped.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
              if (displayName.length > 1) {
                // Save previous
                if (current) techBlocks.push(current);
                current = { name: displayName, soldHrs: {}, clockedInHrs: {} };
                console.log("[TechParse] Technician:", displayName);
                continue;
              }
            }
          }

          if (!current) continue;

          // Data row: col A is blank, dateColIdx has a date
          if (!colA && dateVal != null) {
            const iso = toISODate(dateVal);
            if (iso) {
              const sold = parseNumeric(row[soldColIdx]);
              const clock = parseNumeric(row[clockColIdx]);
              current.soldHrs[iso] = (current.soldHrs[iso] ?? 0) + sold;
              current.clockedInHrs[iso] = (current.clockedInHrs[iso] ?? 0) + clock;
            }
          }
        }

        if (current) techBlocks.push(current);

        // ----------------------------------------------------------------
        // Step 3: Deduplicate by name (handles page breaks re-listing same tech)
        // ----------------------------------------------------------------
        const mergedMap = new Map<string, typeof techBlocks[0]>();
        for (const block of techBlocks) {
          const key = block.name.toLowerCase().trim();
          if (mergedMap.has(key)) {
            const ex = mergedMap.get(key)!;
            for (const [date, val] of Object.entries(block.soldHrs)) {
              ex.soldHrs[date] = (ex.soldHrs[date] ?? 0) + val;
            }
            for (const [date, val] of Object.entries(block.clockedInHrs)) {
              ex.clockedInHrs[date] = (ex.clockedInHrs[date] ?? 0) + val;
            }
          } else {
            mergedMap.set(key, { ...block, soldHrs: { ...block.soldHrs }, clockedInHrs: { ...block.clockedInHrs } });
          }
        }

        const technicians = Array.from(mergedMap.values()).map(buildTechnicianData);

        console.log("[TechParse] Found", techBlocks.length, "blocks,", technicians.length, "after dedup");

        // Dominant month from all daily values
        const monthCounts: Record<string, number> = {};
        for (const t of technicians) {
          for (const dv of t.dailyValues) {
            const m = dv.date.slice(0, 7);
            monthCounts[m] = (monthCounts[m] ?? 0) + 1;
          }
        }
        const dominantMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

        // Store name from top rows
        let storeName = "Unknown Store";
        for (let ri = 0; ri < Math.min(5, rows.length); ri++) {
          for (const cell of rows[ri] ?? []) {
            if (typeof cell === "string" && cell.length > 5 &&
              /chevrolet|ford|toyota|honda|dodge|chrysler|jeep|ram|gmc|buick|hyundai|kia|mazda|motors|auto|nissan/i.test(cell)) {
              storeName = cell.trim();
              break;
            }
          }
        }

        resolve({ storeName, month: dominantMonth, technicians, detectedNames: technicians.map(t => t.rawName) });

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

function buildTechnicianData(raw: { name: string; soldHrs: Record<string, number>; clockedInHrs: Record<string, number> }): TechnicianData {
  const allDates = Array.from(new Set([...Object.keys(raw.soldHrs), ...Object.keys(raw.clockedInHrs)])).sort();

  const dailyValues: TechnicianDailyValue[] = allDates.map(date => ({
    date,
    soldHrs: raw.soldHrs[date] ?? 0,
    clockedInHrs: raw.clockedInHrs[date] ?? 0,
  }));

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

  return { rawName: raw.name, displayName: raw.name, dailyValues, weeklyTotals, monthlyTotals };
}
