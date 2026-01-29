
# Plan: Push Forecast Targets to Financial Targets

## Overview
Create a feature that allows users to push their finalized forecast values into the Financial Targets system. This will include:
1. A "Lock All" button to finalize all forecast cells before pushing
2. A "Push to Targets" button that becomes enabled when all cells are locked
3. A confirmation dialog that shows what will be pushed and converts the forecast to quarterly targets

## Current Architecture

### Forecast System
- **ForecastDrawer.tsx**: Main forecast UI drawer
- **useForecast.ts**: Manages forecast entries with lock status per cell
- **useForecastCalculations.ts**: Calculates quarterly and annual values from monthly data
- **ForecastResultsGrid.tsx**: Displays the grid with lock icons per row

### Financial Targets System
- **financial_targets table**: Stores quarterly targets per metric with fields:
  - `department_id`, `metric_name`, `target_value`, `quarter`, `year`, `target_direction`
- **FinancialSummary.tsx**: Contains the "Set Financial Targets" dialog that manually sets targets

### Key Data Flow
```text
Forecast Entries (monthly, locked values)
         |
         v
useForecastCalculations
         |
         +-> monthlyValues (12 months)
         +-> quarterlyValues (Q1-Q4 aggregated)
         |
         v
Push to financial_targets table (per quarter)
```

## Implementation Steps

### 1. Add "Lock All Cells" Button to ForecastDrawer
**File: `src/components/financial/ForecastDrawer.tsx`**

Add a new button in the header area that:
- Locks all forecast cells for all metrics across all 12 months
- Shows current lock status (e.g., "Lock All" vs "All Locked")
- Uses the existing `bulkUpdateEntries` mutation with `isLocked: true`

### 2. Add "Push to Targets" Button
**File: `src/components/financial/ForecastDrawer.tsx`**

Add a button that:
- Only becomes enabled when all forecast cells are locked
- Opens a confirmation dialog showing what will be pushed
- Displays the quarterly target values that will be saved

### 3. Create Push to Targets Dialog Component
**File: `src/components/financial/forecast/PushToTargetsDialog.tsx`** (new file)

A dialog component that:
- Shows a preview table of all metrics with Q1-Q4 values from the forecast
- Shows the target direction (Higher is Better / Lower is Better) for each metric
- Has "Cancel" and "Push Targets" buttons
- Uses the same metric definitions as the forecast grid

### 4. Add Push Targets Mutation
**File: `src/hooks/forecast/useForecast.ts`**

Add a new mutation `pushToTargets` that:
- Deletes existing targets for the department/year
- Inserts new targets from the quarterly forecast values
- Uses the correct `target_direction` based on metric type

### 5. Add Lock State Tracking
**File: `src/components/financial/ForecastDrawer.tsx`**

Add computed state to determine:
- Total number of cells (12 months x N metrics)
- Number of locked cells
- Boolean: `allCellsLocked`

## Technical Details

### Quarterly Value Extraction
The `quarterlyValues` from `useForecastCalculations` provides:
```typescript
quarterlyValues: Record<'Q1' | 'Q2' | 'Q3' | 'Q4', Map<string, CalculationResult>>
```

Each `CalculationResult` contains:
- `value`: The forecast value (summed for currency, averaged for %)
- `is_locked`: Whether any month in the quarter is locked

### Target Direction Mapping
From `financialMetrics.ts`, each metric has a `targetDirection`:
- `"above"` for revenue/profit metrics (Total Sales, GP Net, Dept Profit, etc.)
- `"below"` for expense metrics (Sales Expense, Fixed Expense, etc.)

### Lock All Implementation
```typescript
const handleLockAllCells = () => {
  const updates = [];
  months.forEach(month => {
    metricDefinitions.forEach(metric => {
      const monthData = monthlyValues.get(month);
      const currentValue = monthData?.get(metric.key)?.value ?? 0;
      updates.push({
        month,
        metricName: metric.key,
        forecastValue: currentValue,
        isLocked: true,
      });
    });
  });
  bulkUpdateEntries.mutate(updates);
};
```

### Push to Targets Implementation
```typescript
const handlePushToTargets = async () => {
  // Delete existing targets for this department/year
  await supabase
    .from('financial_targets')
    .delete()
    .eq('department_id', departmentId)
    .eq('year', forecastYear);

  // Insert new targets from quarterly values
  const inserts = [];
  ['Q1', 'Q2', 'Q3', 'Q4'].forEach((q, idx) => {
    const quarterNum = idx + 1;
    metricDefinitions.forEach(metric => {
      const qValue = quarterlyValues[q]?.get(metric.key);
      if (qValue && qValue.value !== 0) {
        inserts.push({
          department_id: departmentId,
          metric_name: metric.key,
          target_value: qValue.value,
          quarter: quarterNum,
          year: forecastYear,
          target_direction: metric.targetDirection, // from financialMetrics config
        });
      }
    });
  });

  await supabase.from('financial_targets').insert(inserts);
};
```

## UI Changes

### ForecastDrawer Header
Add two buttons next to the existing "Save Forecast" button:
1. **Lock All Cells** button with Lock icon
   - Disabled if all cells already locked
   - Shows "All Locked" with checkmark when complete
2. **Push to Targets** button with Target/Flag icon
   - Disabled until all cells are locked
   - Opens the confirmation dialog

### PushToTargetsDialog
```text
+------------------------------------------+
|  Push Forecast to Targets                |
+------------------------------------------+
|  This will update the 2026 financial     |
|  targets with your forecast values.      |
|                                          |
|  Metric              Q1    Q2    Q3   Q4 |
|  ──────────────────────────────────────  |
|  Total Sales        150K  175K  200K 180K|
|  GP Net              45K   52K   60K  54K|
|  GP %               30%   30%   30%  30% |
|  Sales Expense       9K   10K   12K  11K |
|  ...                                     |
|                                          |
|  [Cancel]              [Push to Targets] |
+------------------------------------------+
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/financial/forecast/PushToTargetsDialog.tsx` | Create | Confirmation dialog component |
| `src/components/financial/ForecastDrawer.tsx` | Modify | Add Lock All + Push to Targets buttons, state tracking |
| `src/hooks/forecast/useForecast.ts` | Modify | Add pushToTargets mutation |

## Edge Cases

1. **Partial locks**: Button stays disabled until 100% of cells are locked
2. **Existing targets**: Existing targets for the year are replaced (with user confirmation)
3. **Zero values**: Metrics with zero values are not saved as targets (matching current behavior)
4. **Brand-specific metrics**: Only metrics visible for the current brand are pushed

## User Flow

1. User opens Forecast Drawer
2. User adjusts forecast values as needed
3. User clicks "Lock All Cells" to finalize the forecast
4. User clicks "Push to Targets" 
5. Confirmation dialog shows preview of quarterly targets
6. User confirms -> targets are saved
7. Toast notification confirms success
8. Financial Summary "Set Targets" dialog now shows the pushed values
