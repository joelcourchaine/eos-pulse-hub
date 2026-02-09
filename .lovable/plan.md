

## Persist Enterprise Filters (Including Sub-Metrics) When Navigating Back

### Problem

When you navigate to the Dealer Comparison report and then press "Back", all your metric selections -- including sub-metrics -- are lost and reset to only parent metrics.

### Root Cause

There are two effects in `Enterprise.tsx` that cause this:

1. **Line 728-732**: A `useEffect` that watches `metricType` and clears all selected metrics (`setSelectedMetrics([])`) whenever it runs. This effect fires on every component mount, including when navigating back, even though `metricType` hasn't actually changed -- it was simply restored from session storage.

2. **Line 734-761**: A follow-up `useEffect` that auto-selects metrics when the selection is empty. Because the first effect just cleared everything, this one kicks in and only selects **parent metrics** (explicitly filtering out sub-metrics with `!m.isSubMetric`).

So the sequence on "Back" navigation is:
```text
1. Component mounts
2. selectedMetrics restored from sessionStorage (with sub-metrics) - GOOD
3. "Clear on metricType change" effect fires on mount - WIPES everything
4. "Auto-select" effect fires because selection is now empty - only adds parents
5. Sub-metrics are gone
```

### Fix

**File: `src/pages/Enterprise.tsx`**

**Change 1 -- Skip the "clear metrics" effect on initial mount:**

Add a `useRef` flag (`isInitialMount`) that starts as `true`. On the first render, the clear-metrics effect will detect this flag, skip the clearing, and set the flag to `false`. On subsequent `metricType` changes (user actually switches the tab), it will clear as intended.

```text
Before:
  useEffect(() => {
    setSelectedMetrics([]);
    setSelectedKpiMetrics([]);
    setSelectedFinancialMetrics([]);
  }, [metricType]);

After:
  const isInitialMount = useRef(true);
  
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return; // Don't clear on initial mount -- session restored values
    }
    setSelectedMetrics([]);
    setSelectedKpiMetrics([]);
    setSelectedFinancialMetrics([]);
  }, [metricType]);
```

**Change 2 -- Prevent auto-select from overwriting restored sub-metrics:**

The auto-select effect (line 734-761) checks `selectedMetrics.length === 0` before auto-selecting. With the fix above, `selectedMetrics` will no longer be cleared on mount, so the auto-select will naturally skip since `selectedMetrics.length > 0`. No code change needed here.

### What This Preserves

After this fix, navigating back from any report view will restore:
- Filter mode (brand/group/custom)
- Selected brands, groups, and stores
- Selected department names
- Metric type (weekly/monthly/financial/combined)
- **All selected metrics, including sub-metrics** (e.g., `sub:sales_expense:ABSENTEE COMPENSATION`)
- Selected KPI metrics and financial metrics (for combined view)
- Date period settings (month, year, custom range)
- Sort-by metric
- Comparison mode
- Department manager filter toggle

### Scope

- **1 file** modified: `src/pages/Enterprise.tsx`
- **2 lines** added (the ref declaration and the guard check)
- No database changes
- No edge function changes

