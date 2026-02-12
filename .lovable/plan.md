

## Fix: First Advisor in CSR Report Is Skipped During Parsing

### Problem
Kayla Bender (the first advisor in the report) is not being parsed. Her data rows are processed but silently discarded because no advisor context exists yet.

### Root Cause
The parser's `findHeaderRow` function locates the first row containing column labels like "Pay Type", "#SO", "Sold Hrs", etc. In the report, this row appears **inside** the first advisor's section:

```text
Row 4:  Advisor 1099 - Kayla Bender     <-- advisor header
Row 5:  Pay Type | #SO | Sold Hrs | ... <-- findHeaderRow returns THIS row
Row 6:  Customer | 53  | 211      | ... <-- loop starts HERE
```

The main parsing loop starts at `headerInfo.rowIndex + 1` (row 6), so it never encounters Kayla's advisor header on row 4. Her Customer/Warranty/Internal/Total data rows are parsed, but since `currentAdvisor` is still `null`, the condition `if (metrics && metricsByIdx)` fails and values are silently dropped.

All subsequent advisors (TAYLER, QUICK LUBE, TRINA ALEXIS, etc.) work correctly because their headers appear within the loop's scan range.

### Fix

**File: `src/utils/parsers/parseCSRProductivityReport.ts`**

After `findHeaderRow` returns, scan backwards from the header row to find an advisor header that precedes it. If found, initialize `currentAdvisor` before the main loop begins.

Add this block after line 236 (after the header row is found) and before line 248 (where the main loop begins):

```typescript
// Check rows BEFORE the header row for the first advisor header.
// In many CSR reports, the first advisor's name appears 1-3 rows
// above the first "Pay Type" column header row, so the main loop
// (which starts at headerInfo.rowIndex + 1) never sees it.
for (let i = Math.max(0, headerInfo.rowIndex - 5); i < headerInfo.rowIndex; i++) {
  const row = rows[i];
  if (!row) continue;
  for (let colIdx = 0; colIdx < Math.min(15, row.length); colIdx++) {
    const cellValue = String(row[colIdx] ?? "").trim();
    if (cellValue) {
      const info = parseAdvisorHeader(cellValue);
      if (info) {
        currentAdvisor = {
          rawName: cellValue,
          displayName: info.displayName,
          employeeId: info.employeeId,
          metrics: { customer: {}, warranty: {}, internal: {}, total: {} },
          metricsByIndex: { customer: {}, warranty: {}, internal: {}, total: {} },
          payTypeByRowOffset: {},
        };
        currentAdvisorAnchorRowIndex = i;
        console.log(`[CSR Parse] Found first advisor (pre-header): ${info.displayName} (${info.employeeId})`);
        break;
      }
    }
  }
  if (currentAdvisor) break;
}
```

### What This Fixes
- Kayla Bender (and any first advisor in any CSR report) will now be detected and parsed
- Her Customer, Warranty, Internal, and Total metrics will be captured correctly
- No impact on subsequent advisors or department totals -- they continue to work as before

### No Other Changes Needed
- The advisor header regex already handles the format correctly
- The data row parsing logic is correct -- it was just missing the advisor context
- No database changes required

