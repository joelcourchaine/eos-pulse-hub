
# Enable Annual GP% Target to Recalculate Monthly GP Net

## Overview
When you've locked in all your monthly Total Sales values and want to set a target GP% for the year, clicking on the annual GP% cell will let you enter your desired percentage. The system will then automatically calculate the GP Net for each month using the formula: `Monthly GP Net = Locked Total Sales × (Target GP% / 100)`.

This ensures every month achieves your target gross profit margin.

## Current Behavior vs. Requested Behavior

| Aspect | Current | After Change |
|--------|---------|--------------|
| Clicking annual GP% | Scales existing GP Net sub-metrics proportionally | Recalculates all monthly GP Net values from locked Total Sales |
| Monthly GP% values | Can vary month-to-month | All set to the same target percentage |
| Monthly GP Net values | Scaled proportionally | Calculated as: Total Sales × Target GP% |

## How It Will Work

1. **Click on the 2026 GP%** cell (currently showing 69.0%)
2. **Enter your target GP%** (e.g., 70.0%)
3. **System automatically:**
   - Locks the GP% value for all 12 months at 70.0%
   - For each month, calculates: `GP Net = Locked Total Sales × 0.70`
   - Locks the calculated GP Net values
   - Recalculates all dependent metrics (Net Selling Gross, Department Profit, etc.)

## Example Calculation
With your current locked Total Sales:
- Feb: $103K × 70% = $72.1K GP Net
- Mar: $125K × 70% = $87.5K GP Net
- Apr: $125K × 70% = $87.5K GP Net
- (and so on for all months...)

---

## Technical Details

### File to Modify
`src/components/financial/ForecastDrawer.tsx`

### Changes to `handleMainMetricAnnualEdit`

**Enhanced GP% handling logic:**

When `metricKey === 'gp_percent'`:

1. **Get locked Total Sales for each month** from `monthlyValues` map
2. **For each of the 12 months**, build update objects:
   - Lock GP% at the entered target value
   - Calculate GP Net as `lockedTotalSales × (targetGpPercent / 100)`
   - Lock GP Net at the calculated value
3. **Bulk update** all 24 entries (12 months × 2 metrics) using `bulkUpdateEntries.mutate()`

```typescript
// Inside handleMainMetricAnnualEdit, when metricKey === 'gp_percent':

if (metricKey === 'gp_percent') {
  const updates: { month: string; metricName: string; forecastValue: number; isLocked: boolean }[] = [];
  
  // For each month, use locked Total Sales to calculate GP Net at target GP%
  months.forEach((month) => {
    const monthData = monthlyValues.get(month);
    const totalSalesEntry = monthData?.get('total_sales');
    const lockedTotalSales = totalSalesEntry?.value ?? 0;
    
    // Lock GP% at target value
    updates.push({
      month,
      metricName: 'gp_percent',
      forecastValue: newAnnualValue, // Target GP%
      isLocked: true,
    });
    
    // Calculate and lock GP Net
    const calculatedGpNet = lockedTotalSales * (newAnnualValue / 100);
    updates.push({
      month,
      metricName: 'gp_net',
      forecastValue: calculatedGpNet,
      isLocked: true,
    });
  });
  
  bulkUpdateEntries.mutate(updates);
  
  // Scale GP Net sub-metrics proportionally (existing logic)
  // ...
  
  return;
}
```

### Calculation Flow

```text
User enters 70% GP Target
         ↓
┌─────────────────────────────────────┐
│ For each month (Jan-Dec):           │
│                                     │
│  1. Get locked Total Sales          │
│     (e.g., Feb = $103,000)          │
│                                     │
│  2. Calculate GP Net:               │
│     $103,000 × 0.70 = $72,100       │
│                                     │
│  3. Lock both values:               │
│     GP% = 70.0% (locked)            │
│     GP Net = $72,100 (locked)       │
└─────────────────────────────────────┘
         ↓
Dependent metrics auto-recalculate:
  - Net Selling Gross = GP Net - Sales Expense
  - Department Profit = NSG - Fixed Expense
  - Return on Gross % = Dept Profit / GP Net
```

### Edge Cases Handled

1. **Months without locked Total Sales**: Uses the currently calculated (weight-distributed) Total Sales value
2. **GP Net sub-metrics**: Continue to scale proportionally based on the new annual GP Net total
3. **Downstream metrics**: Automatically recalculate via the existing `useForecastCalculations` hook
4. **Undo behavior**: User can reset the forecast to baseline using the existing Reset button
