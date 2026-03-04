
## Root Cause: Parser Only Handles Nissan Format, Fails Silently on RAM/Stellantis Reports

The `parseTechnicianHoursReport.ts` parser was built for a specific Nissan DMS format:
- **Nissan format**: Col A is always blank on data rows (date is in col 2, hours in cols 4 & 6)
- **RAM/Stellantis format**: Col A likely contains the date directly, with technician name appearing in col A on their own block header, and hours in completely different column positions with different labels

Line 202 only collects data when `!colA && dateVal != null` — so if the RAM report puts dates in col A, **zero rows are collected** and the parser returns empty technicians with no error.

Additionally, column header labels differ:
- Stellantis/RAM commonly uses: "Flat Rate Hrs", "Actual Hrs", "R.O. Hours", "Labor Sold Hrs", "Clock Hours"
- The current search only checks: "sold hrs", "sold hours", "clsd hrs", "closed hrs", "clocked in hrs"

### Fix: Two-mode parser with RAM/Stellantis layout support

**`src/utils/parsers/parseTechnicianHoursReport.ts`**

1. **Expand header detection** — add more label variants for RAM/Stellantis column names:
   - Sold hrs aliases: `"flat rate hrs"`, `"flat rate hours"`, `"labour sold"`, `"labor sold"`, `"f/r hrs"`, `"flagged hrs"`
   - Available hrs aliases: `"actual hrs"`, `"actual hours"`, `"clock hrs"`, `"available hrs"`, `"available hours"`, `"total hrs"`

2. **Add date-in-col-A data row support** — after the existing `!colA` data row detection (line 202), add a second branch:
   - If `colA` contains a parseable date (i.e. `toISODate(row[0]) !== null`) → treat as a data row even with col A populated
   - This handles the RAM layout where dates appear in col A

3. **Technician name detection for date-in-colA format** — in the RAM layout, technician names likely appear as col A values when col A is NOT a date and NOT a skip pattern. The current logic already does this (lines 179-196) and should work once data rows are captured correctly.

4. **Expand fallback column positions** — the current fixed fallback assumes cols (2, 4, 6) which is Nissan-specific. Add a second fallback attempt scanning for date values in col 0 to detect the alternative layout.

### Changes — 1 file:

**`src/utils/parsers/parseTechnicianHoursReport.ts`**

| Change | Details |
|---|---|
| Expand `sIdx` header search | Add: `flat rate hrs`, `flat rate hours`, `labour sold`, `labor sold`, `flagged hrs`, `f r hrs` |
| Expand `cIdx` header search | Add: `actual hrs`, `actual hours`, `clock hrs`, `available hrs`, `available hours`, `total hrs` |
| Add col-A date row detection | After line 210: also collect rows where `toISODate(row[0]) !== null` regardless of whether col A is blank |
| Fix fallback for col-A-date format | If no header found, attempt to detect which column contains dates by scanning first data rows, and pick soldColIdx/clockColIdx accordingly |

No UI changes needed. No DB changes needed.
