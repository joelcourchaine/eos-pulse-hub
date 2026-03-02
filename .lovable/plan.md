

## Plan: Show Totals row when a specific KPI is selected

**Problem:** The Totals section derives `availKpis`, `soldKpis`, and `productiveKpis` from `filteredKpis` (line 5376). When a specific KPI like "Sold Hours" is selected, `filteredKpis` excludes "Available Hours", so `availKpis` is empty and the guard at line 5377 returns `null`, hiding the entire Totals section.

**Fix in `src/components/scorecard/ScorecardGrid.tsx`:**

1. **Use unfiltered `kpis` for Totals data** (~lines 5376–5412): Change `filteredKpis` → `kpis` (with role filter only) when deriving `availKpis`, `soldKpis`, and `productiveKpis`. This ensures the Totals section always has the underlying data to compute all three rows regardless of KPI filter.

2. **Filter which total rows render** (~line 5427): When `selectedKpiFilter !== "all"`, only show the matching total row. For example, selecting "Sold Hours" shows just the Sold Hours total; selecting "Available Hours" shows just Available Hours; selecting "Productive" shows just Productive. If the selected KPI matches none of the three total row labels, show nothing.

3. **Keep the guard intact** — if the department has no Available Hours KPIs at all (from full `kpis`), the section still won't render.

This is a ~10-line change confined to the Totals section block.

