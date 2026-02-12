

## Add Unapplied/Variance Sub-Metric Under GP % for Stellantis in Enterprise Reports

### Problem
Stellantis stores have "UNAPPLIED/VARIANCE LABOUR MECHNICAL" stored as a sub-metric under GP Net (`sub:gp_net:012:...`), but it does not appear under GP % in the Enterprise report's metric picker or comparison tables. This is because the Stellantis metric configuration lacks `hasSubMetrics: true` on the relevant metrics.

### Root Cause
In `src/config/financialMetrics.ts`, the `STELLANTIS_METRICS` array defines `total_sales`, `gp_net`, and `gp_percent` **without** `hasSubMetrics: true`. The Enterprise page relies on this flag to discover and list sub-metrics. Other brands (GMC, Nissan, Ford, Honda) already have this flag set on these metrics.

### Solution

**File: `src/config/financialMetrics.ts`** (Stellantis section, lines 665-690)

Add `hasSubMetrics: true` to three Stellantis metrics:

1. **Total Sales** (line 671) -- add `hasSubMetrics: true`
2. **GP Net** (line 678) -- add `hasSubMetrics: true`  
3. **GP %** (line 689) -- add `hasSubMetrics: true`

This is the same pattern used by Honda, Ford, GMC, and Nissan configs.

### How It Works

The Enterprise page already has the logic to handle this:

1. `availableFinancialMetricsForCombined` (line 696-699) checks `metric.hasSubMetrics` and for percentage metrics resolves to the numerator key (`gp_net`). This means GP % will list all `gp_net` sub-metrics (including "UNAPPLIED/VARIANCE LABOUR MECHNICAL").

2. `DealerComparison.tsx` (line 1480-1510) already synthesizes percentage sub-metrics by dividing the numerator sub-value by the denominator total. So the GP % value for this sub-metric will be computed as `(UNAPPLIED/VARIANCE LABOUR MECHNICAL GP Net / Total Sales) * 100`.

3. The ordering is preserved from the database key (`sub:gp_net:012:...`), so it will appear in position 012 -- after the other GP Net sub-metrics.

### What This Fixes
- Stellantis stores will show all sub-metrics (including "UNAPPLIED/VARIANCE LABOUR MECHNICAL") under Total Sales, GP Net, and GP % in the Enterprise metric picker
- The GP % sub-metric values will be correctly calculated as percentages
- Sub-metric ordering matches the original financial statement

### What Stays the Same
- Financial Summary page already handles these via the `useSubMetrics` hook (separate mechanism)
- Other brands are unaffected
- No database changes needed
- DealerComparison percentage synthesis logic is unchanged
