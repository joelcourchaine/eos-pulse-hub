
## Feature: Quarter View Toggle — Totals vs Average Month

### Context
- In the Forecast Drawer, when `view === 'quarter'`, Q1/Q2/Q3/Q4 columns show the **sum of 3 months** for dollar metrics and the **ratio-of-sums** for percentage metrics.
- The user wants a toggle button that switches the quarter display between **"Totals"** (current behavior: 3-month sum) and **"Average Month"** (each quarter divided by 3).
- Percentage metrics (GP %, Sales Expense %, etc.) already calculate correctly from ratios — dividing by 3 doesn't apply to them; only dollar/number metrics get divided.

### What to build

**1. New state in `ForecastDrawer.tsx`**
Add `const [quarterDisplayMode, setQuarterDisplayMode] = useState<'total' | 'average'>('total')` near the existing `view` state.

**2. Toggle button in `ForecastDrawer.tsx`** (shown only when `view === 'quarter'`)
Add a small pill toggle next to the view buttons:
```
[ Monthly ][ Quarter ][ Annual ]   [ Totals | Avg Month ]
```

**3. Pass `quarterDisplayMode` down to `ForecastResultsGrid`**
Add a `quarterDisplayMode?: 'total' | 'average'` prop to `ForecastResultsGridProps`.

**4. Apply the divide-by-3 in `ForecastResultsGrid.tsx`**
In `getValue()`, when `view === 'quarter'` and `quarterDisplayMode === 'average'`, divide the cell value by 3 only for non-percentage metrics:
```ts
const getValue = (column: string, metricKey: string) => {
  if (view === 'quarter') {
    const result = quarterlyValues[column]?.get(metricKey);
    if (result && quarterDisplayMode === 'average') {
      const metric = metricDefinitions.find(m => m.key === metricKey);
      if (metric?.type !== 'percent') {
        return { ...result, value: result.value / 3, baseline_value: result.baseline_value / 3 };
      }
    }
    return result;
  }
  ...
};
```

**5. Same treatment for sub-metric quarterly values**
In the sub-metric rendering block (line ~481), also divide `subMetricData.quarterlyValues.get(col.key)` by 3 when in average mode for non-percentage sub-metrics.

**6. Column header update**
When `quarterDisplayMode === 'average'`, change the quarter column header labels to show `Q1 Avg`, `Q2 Avg`, etc. (or add a small subtitle under each header).

### Files to change
- `src/components/financial/ForecastDrawer.tsx` — add state + toggle button UI
- `src/components/financial/forecast/ForecastResultsGrid.tsx` — add prop, apply divide-by-3 in getValue + sub-metric cell + header labels
