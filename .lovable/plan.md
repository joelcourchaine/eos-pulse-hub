

# Unify "View Dashboard" Button for All Period Types

## Problem

When "12 Month Trend" is selected, there are two buttons: "View Dashboard" (navigates to dealer comparison table) and "View Trend Report" (opens the trend chart). This is inconsistent with other period types which only have one button. The user expects "View Dashboard" to show the appropriate view based on the selected period.

## Fix

### File: `src/pages/Enterprise.tsx`

1. **Modify the "View Dashboard" button's `onClick` handler** (~line 1942): When `datePeriodType === 'monthly_trend'` and `metricType === 'financial'`, instead of navigating to `/dealer-comparison`, execute the trend report logic (set `trendReportParams` and `setViewMode("trend")`).

2. **Remove the separate "View Trend Report" button** (~lines 1964-2010): Since the "View Dashboard" button will handle this case, the dedicated trend button is no longer needed.

### Logic Change (pseudo-code)

```
onClick={() => {
  if (datePeriodType === 'monthly_trend' && metricType === 'financial') {
    // Open trend view inline (current "View Trend Report" logic)
    setTrendReportParams({ storeIds, selectedMetrics, startMonth, endMonth, ... });
    setViewMode("trend");
  } else {
    // Navigate to dealer comparison table (existing behavior)
    navigate("/dealer-comparison", { state: { ... } });
  }
}}
```

This is a single-file change: move the trend logic into the existing button handler and delete the now-redundant second button block.
