

# Fix: Preserve User-Entered Sales Expense % Values

## Problem

When you edit the annual **Sales Expense %**, the value is being immediately overwritten by the recalculation logic in the `monthlyValues` useMemo. This happens because:

1. The `monthlyValues` calculation recalculates `sales_expense_percent` unconditionally (line 1854-1860)
2. The `monthlyValues` useMemo doesn't have `entriesMap` in its dependencies, so it doesn't react to stored user entries

## Changes Required

### File: `src/hooks/forecast/useForecastCalculations.ts`

### Change 1: Preserve user-entered Sales Expense % values (Lines 1854-1860)

**Current code:**
```typescript
// Update sales_expense_percent
const salesExpPercentCurrent = adjustedMetrics.get('sales_expense_percent');
if (salesExpPercentCurrent && gpNetValue > 0) {
  adjustedMetrics.set('sales_expense_percent', {
    ...salesExpPercentCurrent,
    value: (adjustedSalesExpense / gpNetValue) * 100,
  });
}
```

**New code:**
```typescript
// Update sales_expense_percent - BUT preserve user-entered values
const salesExpPercentCurrent = adjustedMetrics.get('sales_expense_percent');
const storedSalesExpPercent = entriesMap.get(`${month}:sales_expense_percent`);
const hasUserEnteredSalesExpPercent = storedSalesExpPercent?.forecast_value !== null && 
  storedSalesExpPercent?.forecast_value !== undefined;

if (salesExpPercentCurrent && gpNetValue > 0 && !hasUserEnteredSalesExpPercent) {
  // Only recalculate if user hasn't explicitly set a value
  adjustedMetrics.set('sales_expense_percent', {
    ...salesExpPercentCurrent,
    value: (adjustedSalesExpense / gpNetValue) * 100,
  });
}
```

### Change 2: Add `entriesMap` to `monthlyValues` dependencies (Line 1905)

**Current:**
```typescript
}, [baseMonthlyValues, subMetricForecasts, subMetricOverrides, months, annualBaseline, baselineData, forecastYear]);
```

**New:**
```typescript
}, [baseMonthlyValues, subMetricForecasts, subMetricOverrides, months, annualBaseline, baselineData, forecastYear, entriesMap]);
```

## Why This Works

- When a user edits the annual Sales Expense %, the `handleMainMetricAnnualEdit` function saves `forecast_value` entries for each month
- With these changes, the `monthlyValues` recalculation will:
  1. Detect that user has explicitly set the `sales_expense_percent` value (via `entriesMap`)
  2. Skip the automatic recalculation that was overwriting the user's input
  3. Allow the sub-metric scaling and parent synchronization to work correctly

## Note on Fix 1

The first fix mentioned (adding `entriesMap` to `calculateAnnualValues` dependencies) is already in place at line 833.

