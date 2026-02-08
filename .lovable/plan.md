

## Enterprise YOY: 3-Column Layout + Fix Sub-Metric Data

Two changes to the Dealer Comparison page when viewing Year-over-Year for a single month:

### 1. Fix Sub-Metric "No data" Bug

There's a key mismatch causing sub-metrics (like ABSENTEE COMPENSATION, EMPLOYEE BENEFITS, etc.) to show "No data" even when the data exists in the database.

**Root Cause:** The table renders rows using `selectionId` (e.g., `sub:sales_expense:ABSENTEE COMPENSATION`) as the lookup key into the store metrics map. But the metrics map stores dollar sub-metrics under their *display name* (e.g., `↳ ABSENTEE COMPENSATION`). These two formats don't match, so the lookup returns undefined.

**Fix:** When building the `storeData` metrics map from `comparisonData`, also index each item under its corresponding selection ID. This way, the render can find the data regardless of which key format is used. Alternatively, the render lookup will check both `selectionId` and `displayName`.

### 2. Three-Column YOY Layout

When comparing Year over Year for a single month, replace the current stacked layout (value + "LY: $xxx" + variance badge in one cell) with three distinct columns per store:

```text
+--------------------+---------------------------+
| Metric             |    Winnipeg Chevrolet      |
|                    | 2026   |  2025  |   Diff   |
+--------------------+--------+--------+----------+
| Total Sales        | $531K  | $551K  | -$20K    |
| GP Net             | $381K  | $354K  | +$28K    |
| GP %               | 71.8%  | 64.2%  | +7.6%    |
| Sales Expense      | $235K  | $192K  | +$42K    |
|  ↳ ABSENTEE COMP   | $1,200 | $980   | +$220    |
|  ↳ EMPLOYEE BENE   | $5,400 | $4,800 | +$600    |
+--------------------+--------+--------+----------+
```

- The store name spans all 3 sub-columns as a header
- Years are derived dynamically from the selected month (not hardcoded)
- The "Diff" column shows the raw difference (current minus previous year) with color coding: green for favorable, red for unfavorable
- For percentage metrics, the difference is shown in percentage points

### Technical Details

**File:** `src/pages/DealerComparison.tsx`

Changes:

1. **Fix storeData metrics map (around line 1423):** When building the `storeData` reduce, also store each metric entry under the corresponding `selectionId` key (using the `displayNameToSelectionId` map already available). This ensures the render lookup succeeds for sub-metrics.

2. **Table header (around line 1673):** When `comparisonMode === "year_over_year"` and `datePeriodType === "month"`:
   - Each store header cell gets `colSpan={3}`
   - Add a second header row with "Current Year", "Last Year", "Diff" sub-headers

3. **Table body (around line 1730):** For each store column in YOY single-month mode, render 3 `<TableCell>` elements instead of 1:
   - Cell 1: Current year value (formatted)
   - Cell 2: Last year value (formatted, from `metricData.target`)
   - Cell 3: Difference (current - last year), color-coded green/red

4. **Difference formatting:** Uses the same `formatValue` logic for the diff value. Color is determined by whether the difference is favorable (considering metric direction -- e.g., lower expenses = green).

**No changes needed to:**
- Data fetching or processing logic (data is already correct)
- MetricComparisonTable.tsx (it's used for multi-store non-YOY comparisons)
- Any other pages or components

