
## Root Cause

The parser (`parseTechnicianHoursReport.ts`) was written for a **horizontal** format where dates are column headers and KPI rows run underneath. The actual Nissan report is **vertical** — each row is one day, with the date in column C, Sold Hrs in column E, and Clocked In Hrs in column G.

**Actual structure:**
```text
Row: [blank]  [blank]  [Date col C]  [Actual Hrs]  [Sold Hrs]  [Sold%]  [Clocked In Hrs]  ...
Row: 13 - Michael Abrahamsz         ← technician header (col A)
Row:           12/29/2025  0.00  0.00  0.00  0.00  ...       ← date+values in cols C,D,E,F,G
Row: Week Total:  ...                ← skip
Row: Total (Tech): 13  ...           ← end of technician block
Row: 605 - Bill Vanderbos            ← next technician
```

The parser currently looks for a row with 3+ dates spread across column headers, which never matches this vertical format. So it returns 0 technicians found → 0 data written.

---

## Fix

Rewrite `parseTechnicianHoursReport.ts` to handle this vertical format:

1. **Find the column header row** — look for a row containing "Date", "Sold Hrs", "Clocked In Hrs" (col labels). Record which column index each lives at.

2. **Walk rows** — when col A matches pattern `\d+ - Name` (e.g. `13 - Michael Abrahamsz`) or just a name with no digits, start a new technician block. Strip the `13 - ` prefix to get display name.

3. **For each data row** — if col C has a parseable date AND col A is blank/empty, read:
   - `soldHrs` from the "Sold Hrs" column (col E, index 4)
   - `clockedInHrs` from the "Clocked In Hrs" column (col G, index 6)
   
4. **Skip** rows where col A is "Week Total:", "Total (Tech):", page header repeats (store name/report title), or blank.

5. **Page break handling** — when the report repeats the header `[store name] / Technician Productivity Report / Page N` + column headers mid-sheet, continue the same technician (col A will still show the technician name again after the page break header rows). The existing dedup-by-name merge handles this correctly.

6. **Aggregation** — the existing `buildTechnicianData()` function (weekly/monthly grouping) stays unchanged since it works on `dailyValues[]`.

7. **Dominant month** — derive from the date values found, same as current logic.

**Column index map (0-based):**
- Col 0 (A): Technician name or row label
- Col 2 (C): Date  
- Col 4 (E): Sold Hrs
- Col 6 (G): Clocked In Hrs

To be robust, dynamically detect the column positions from the header row rather than hardcoding them, in case the report shifts columns.
