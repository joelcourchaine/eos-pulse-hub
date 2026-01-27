

# Fix: Synthesize Sales Expense % Sub-Metrics for GMC/Nissan Stores

## Problem Summary

When editing the annual **Sales Expense %** in the forecast for GMC/Chevrolet, Nissan, and other stores, the changes don't propagate to the sub-metrics because:

| Store Type | What's in Database | What the Forecast Needs |
|------------|-------------------|------------------------|
| Stellantis/Ford | `sales_expense` AND `sales_expense_percent` sub-metrics | Works correctly |
| GMC/Nissan | Only `sales_expense` sub-metrics | Missing `sales_expense_percent` sub-metrics |

The forecast calculation engine already has sophisticated logic to handle `sales_expense_percent` sub-metric overrides and derive the corresponding `sales_expense` dollar values. However, this logic only activates when percentage sub-metrics exist in the baseline data.

## Solution

Synthesize `sales_expense_percent` sub-metrics from the existing `sales_expense` sub-metrics. For each `sales_expense` line item, we calculate its percentage as:

```
Sales Expense % = (Sales Expense $ / GP Net) × 100
```

This happens in `useForecastCalculations.ts` where sub-metric baselines are grouped by parent key. When we detect that `sales_expense` sub-metrics exist but `sales_expense_percent` sub-metrics don't, we synthesize the percentages.

## Technical Changes

### File: `src/hooks/forecast/useForecastCalculations.ts`

**Location**: Inside `calculateSubMetricForecasts` function, after grouping sub-metrics by parent (around line 880-895)

**Change**: Add logic to synthesize `sales_expense_percent` sub-metrics when they're missing but `sales_expense` sub-metrics exist.

```typescript
// After grouping sub-metrics by parent key
const byParent = new Map<string, SubMetricBaseline[]>();
// ... existing grouping logic ...

// Synthesize sales_expense_percent sub-metrics if missing
const hasSalesExpenseSubs = byParent.has('sales_expense') && (byParent.get('sales_expense')?.length ?? 0) > 0;
const hasSalesExpensePercentSubs = byParent.has('sales_expense_percent') && (byParent.get('sales_expense_percent')?.length ?? 0) > 0;

if (hasSalesExpenseSubs && !hasSalesExpensePercentSubs) {
  // GMC/Nissan case: synthesize sales_expense_percent from sales_expense
  const salesExpenseSubs = byParent.get('sales_expense')!;
  const synthesizedPercentSubs: SubMetricBaseline[] = [];
  
  for (const salesExpSub of salesExpenseSubs) {
    // Create a matching percentage sub-metric
    const percentSub: SubMetricBaseline = {
      parentKey: 'sales_expense_percent',
      name: salesExpSub.name,
      orderIndex: salesExpSub.orderIndex,
      monthlyValues: new Map(),
    };
    
    // Calculate percentage for each month: (Sales Exp $ / GP Net) × 100
    salesExpSub.monthlyValues.forEach((salesExpValue, month) => {
      const gpNetForMonth = baselineData.get(month)?.get('gp_net') ?? 0;
      const percentValue = gpNetForMonth > 0 
        ? (salesExpValue / gpNetForMonth) * 100 
        : 0;
      percentSub.monthlyValues.set(month, percentValue);
    });
    
    synthesizedPercentSubs.push(percentSub);
  }
  
  byParent.set('sales_expense_percent', synthesizedPercentSubs);
}
```

This change means:
1. The existing logic in `calculateSubMetricForecasts` that processes `sales_expense_percent` sub-metrics will now activate for GMC/Nissan stores
2. When a user edits the annual Sales Expense % in the forecast column, the override flow will work:
   - User sets new % → stored as override
   - Each synthesized `sales_expense_percent` sub-metric scales proportionally
   - The existing reverse-calculation logic derives new `sales_expense` dollar amounts from the % targets
3. No changes needed to `ForecastDrawer.tsx` - the existing `handleMainMetricAnnualEdit` logic will just work

## Why This Approach Is Better

1. **Minimal code change**: Only ~25 lines added in one location
2. **Leverages existing infrastructure**: The calculation engine already handles percentage→dollar reverse calculations
3. **Consistent behavior**: GMC stores will behave exactly like Stellantis/Ford stores
4. **No data migration needed**: We synthesize on-the-fly, no need to backfill database entries
5. **Follows your existing pattern**: The financial summary already derives percentages from dollar amounts when displaying sub-metrics

## Testing Checklist

- [ ] Open forecast for a GMC store (Murray Chev, Winnipeg Chevrolet)
- [ ] Verify Sales Expense sub-metrics are visible (SALARIES-SUPERVISION, etc.)
- [ ] Verify Sales Expense % sub-metrics are now visible (synthesized)
- [ ] Edit the annual Sales Expense % value (e.g., change from 60% to 65%)
- [ ] Confirm all monthly Sales Expense $ sub-metrics scale proportionally
- [ ] Confirm the parent Sales Expense total matches the new target
- [ ] Verify Stellantis/Ford stores still work correctly (no regression)

