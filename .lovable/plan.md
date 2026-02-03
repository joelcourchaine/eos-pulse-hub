

# Enable Total Sales Editing for All Brands

## Problem
The `total_sales` metric is missing from the explicit list of editable metrics in the forecast grid. This prevents editing the annual column for Total Sales on brands like Stellantis (and would affect any brand with sub-metrics).

## Solution
Add `metric.key === 'total_sales'` to the editability conditions in `ForecastResultsGrid.tsx`.

## Implementation

### File: `src/components/financial/forecast/ForecastResultsGrid.tsx`

**Line 680** - Add `total_sales` to cursor-pointer condition:
```typescript
// Current:
((!hasChildren && !metric.isDerived) || metric.key === 'gp_percent' || metric.key === 'gp_net' || ...)

// Updated:
((!hasChildren && !metric.isDerived) || metric.key === 'total_sales' || metric.key === 'gp_percent' || metric.key === 'gp_net' || ...)
```

**Line 695** - Same change for click handler condition

## Files to Modify

| File | Change |
|------|--------|
| `src/components/financial/forecast/ForecastResultsGrid.tsx` | Add `total_sales` to editable metrics list (2 locations: lines 680 and 695) |

## Testing
- Verify Total Sales annual column is editable for Stellantis and other brands
- Confirm bidirectional distribution works (editing annual distributes to months)

