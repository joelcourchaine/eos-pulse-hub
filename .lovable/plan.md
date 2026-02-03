

# Fix Quarter Trend Mode Not Populating All Financial Data

## Problem
In Quarter Trend view, some financial metrics (Total Sales, GP Net, Sales Expense, Semi Fixed Expense, Total Fixed Expense) show "-" while calculated metrics (GP %, Net Selling Gross, Department Profit, etc.) display correctly.

## Root Cause
The quarter trend data loading has 3 code paths:

| Path | Logic Used | Sub-metric Support |
|------|-----------|-------------------|
| Percentage metrics | `getMetricTotal` → `getMonthValue` → `getDirectValueForMonth` | Yes |
| Calculated dollar metrics | `getMetricTotal` → `getMonthValue` → `getDirectValueForMonth` | Yes |
| Direct database values | Direct filter: `entry.metric_name === metric.key` | **No** |

For stores that import data as sub-metrics only (without parent totals), the "direct database values" path fails to find any data because it only looks for exact metric name matches.

## Solution
Modify the "direct database values" branch to use the same helper functions (`getMonthsWithMetricData` and `getMetricTotal`) that already work correctly for calculated metrics. These helpers properly aggregate sub-metric sums.

## File to Modify

**`src/components/financial/FinancialSummary.tsx`** (lines 1407-1432)

### Current Code (Broken)

```typescript
} else {
  // For direct database values
  // Honda special case: legacy months may not have stored Total Direct Expenses, so compute it
  if (isHondaBrand && metric.key === 'total_direct_expenses') {
    const metricMonthCount = getMonthsWithMetricData(metric.key, quarterMonthIds);
    if (metricMonthCount > 0) {
      const total = getMetricTotal(metric.key, quarterMonthIds);
      const avg = total / metricMonthCount;
      averages[`${metric.key}-Q${qtr.quarter}-${qtr.year}`] = avg;
    }
    return;
  }

  const values = data
    ?.filter(entry => 
      entry.metric_name === metric.key && 
      quarterMonthIds.includes(entry.month)
    )
    .map(entry => entry.value || 0) || [];
  
  if (values.length > 0) {
    const total = values.reduce((sum, val) => sum + val, 0);
    const avg = total / monthCount;
    averages[`${metric.key}-Q${qtr.quarter}-${qtr.year}`] = avg;
  }
}
```

### Fixed Code

```typescript
} else {
  // For direct database values - use getMonthValue which includes sub-metric sums
  const metricMonthCount = getMonthsWithMetricData(metric.key, quarterMonthIds);
  if (metricMonthCount > 0) {
    const total = getMetricTotal(metric.key, quarterMonthIds);
    const avg = total / metricMonthCount;
    averages[`${metric.key}-Q${qtr.quarter}-${qtr.year}`] = avg;
  }
}
```

## Why This Works

The helper functions already support sub-metrics:

```text
getMetricTotal(metricKey, monthIds)
    └─> getMonthValue(metricKey, monthId)
            └─> getDirectValueForMonth(metricKey, monthId)
                    ├─> First tries: data.find(e.metric_name === metricKey)
                    └─> Fallback: sums all sub-metrics matching "sub:{metricKey}:*"
```

## Testing

1. Open Dashboard and select a store with sub-metric data only
2. Switch to Quarter Trend view (quarter = 0)
3. Verify that Total Sales, GP Net, Sales Expense, and other base metrics now display values
4. Verify percentage metrics still calculate correctly
5. Navigate years using the new PeriodNavigation arrows - confirm data updates

