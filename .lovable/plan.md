

## Fix: Monthly GP% Edits Should Update Total Sales and GP Net (Constant Cost)

### Problem

When editing GP% for a specific month in the forecast grid, only the GP% value is saved. The Total Sales and GP Net for that month are not recalculated using the "constant cost" assumption. This means the GP% change has no visible effect on the dollar metrics for that month.

### Root Cause

In `src/components/financial/ForecastDrawer.tsx`, the `handleCellEdit` function (line 772) simply saves the edited value:

```
updateEntry.mutate({ month, metricName, forecastValue: value });
```

It does not check whether the metric being edited is `gp_percent` and, if so, back-calculate `total_sales` and `gp_net` using constant cost.

### Solution

Add a special case in `handleCellEdit` for when `metricName` is `gp_percent`. When detected:

1. Look up the current month's Total Sales and GP Net values (from `monthlyValues` map or entries)
2. Calculate cost: `cost = currentTotalSales - currentGpNet`
3. Back-calculate: `newTotalSales = cost / (1 - newGP% / 100)` and `newGpNet = newTotalSales - cost`
4. Save all three values (`gp_percent`, `total_sales`, `gp_net`) together using `bulkUpdateEntries`
5. Guard against GP% = 100 (division by zero)

### Technical Changes

**File: `src/components/financial/ForecastDrawer.tsx`** -- `handleCellEdit` function (~line 772)

Replace the simple `updateEntry.mutate` call with logic that detects `gp_percent` edits:

```typescript
const handleCellEdit = (month: string, metricName: string, value: number) => {
  if (view === 'quarter') {
    // Quarter distribution - apply constant-cost logic per distributed month
    const distributions = distributeQuarterToMonths(month as 'Q1'|'Q2'|'Q3'|'Q4', metricName, value);
    if (metricName === 'gp_percent') {
      const updates: { month: string; metricName: string; forecastValue: number }[] = [];
      distributions.forEach((d) => {
        updates.push({ month: d.month, metricName: 'gp_percent', forecastValue: d.value });
        // Get current Total Sales and GP Net for this month
        const monthData = monthlyValues.get(d.month);
        const currentSales = monthData?.get('total_sales')?.value ?? 0;
        const currentGpNet = monthData?.get('gp_net')?.value ?? 0;
        const cost = currentSales - currentGpNet;
        const gpDecimal = d.value / 100;
        const newSales = gpDecimal < 1 ? cost / (1 - gpDecimal) : currentSales;
        const newGpNet = newSales - cost;
        updates.push({ month: d.month, metricName: 'total_sales', forecastValue: newSales });
        updates.push({ month: d.month, metricName: 'gp_net', forecastValue: newGpNet });
      });
      bulkUpdateEntries.mutate(updates);
    } else {
      distributions.forEach((d) => {
        updateEntry.mutate({ month: d.month, metricName, forecastValue: d.value });
      });
    }
  } else {
    // Monthly edit
    if (metricName === 'gp_percent') {
      const monthData = monthlyValues.get(month);
      const currentSales = monthData?.get('total_sales')?.value ?? 0;
      const currentGpNet = monthData?.get('gp_net')?.value ?? 0;
      const cost = currentSales - currentGpNet;
      const gpDecimal = value / 100;
      const newSales = gpDecimal < 1 ? cost / (1 - gpDecimal) : currentSales;
      const newGpNet = newSales - cost;
      bulkUpdateEntries.mutate([
        { month, metricName: 'gp_percent', forecastValue: value },
        { month, metricName: 'total_sales', forecastValue: newSales },
        { month, metricName: 'gp_net', forecastValue: newGpNet },
      ]);
    } else {
      updateEntry.mutate({ month, metricName, forecastValue: value });
    }
  }
};
```

### How It Works

- User edits GP% for January from 20% to 25%
- Current January values: Total Sales = $500K, GP Net = $100K
- Cost = $500K - $100K = $400K (held constant)
- New Total Sales = $400K / (1 - 0.25) = $533K
- New GP Net = $533K - $400K = $133K
- All three values saved together in one bulk operation

### Edge Cases

- **GP% set to 100%**: Guard prevents division by zero; keeps Total Sales unchanged
- **Quarter view**: Same constant-cost logic applied to each distributed month
- Works for all brands since it operates on the parent-level metrics directly

### Files to Modify

1. `src/components/financial/ForecastDrawer.tsx` -- Update `handleCellEdit` function

