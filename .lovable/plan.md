
# Plan: Add 12-Month Monthly Trend Date Period to Enterprise Reporting

## Overview
Add a new "12 Month Trend" date period option to the Enterprise Financial Metrics filter, allowing users to select a custom date range and view month-by-month trend data directly from the filter panel.

## Current Architecture

The Enterprise page has three date period options:
- **Single Month**: View data for one specific month
- **Full Year**: View aggregated data for an entire year
- **Custom Range**: Specify start and end months

The "Monthly Trend Report" button already exists but only appears for "Fixed Combined" department selection and navigates to a separate trend view component (`FixedCombinedTrendView`).

## Implementation Approach

### Option A: Add "12 Month Trend" as a 4th Date Period Type
Add a new option `"monthly_trend"` to `DatePeriodType` that:
- Shows start/end month selectors (like Custom Range)
- Defaults to last 12 months from current date
- Passes data to `DealerComparison` page configured for trend display

### Option B: Make the "Monthly Trend Report" Button Always Available (Recommended)
Currently the trend report button is hidden unless "Fixed Combined" is selected. This approach:
- Shows the "Monthly Trend Report" button for all Financial Metrics selections
- Uses the existing start/end month selectors that appear for Custom Range
- Leverages the already-built `FixedCombinedTrendView` component

**Recommendation:** Option B is simpler and reuses existing components.

## Implementation Steps

### 1. Update Date Period Type
**File: `src/pages/Enterprise.tsx`**

Add a new date period type:
```typescript
type DatePeriodType = "month" | "full_year" | "custom_range" | "monthly_trend";
```

### 2. Add "12 Month Trend" Option to Date Period Dropdown
**File: `src/pages/Enterprise.tsx`** (around line 1193)

Add new SelectItem:
```typescript
<SelectItem value="monthly_trend">12 Month Trend</SelectItem>
```

### 3. Add Date Range Selectors for Monthly Trend
**File: `src/pages/Enterprise.tsx`**

When `datePeriodType === "monthly_trend"`, display start/end month pickers with defaults:
- Start: 11 months ago
- End: Current month

This can reuse the existing Custom Range UI, or be a simplified version.

### 4. Update Report Generation Logic
**File: `src/pages/Enterprise.tsx`** (around line 1797)

Remove the condition that limits the Monthly Trend Report button to only "Fixed Combined":
- Change from: `{selectedDepartmentNames.includes('Fixed Combined') && metricType === 'financial' && (...)`
- Change to: `{metricType === 'financial' && datePeriodType === 'monthly_trend' && (...)`

Or alternatively, always show the Monthly Trend button when Financial Metrics is selected and a date range is specified.

### 5. Ensure FixedCombinedTrendView Works for All Departments
The `FixedCombinedTrendView` currently only fetches Parts and Service departments. Need to verify it handles the selected departments correctly.

**File: `src/components/enterprise/FixedCombinedTrendView.tsx`** (line 168-172)

Consider passing `selectedDepartmentNames` as a prop to filter appropriately.

## UI Changes

### Date Period Dropdown (Financial Metrics)
```text
Current:
- Single Month
- Full Year  
- Custom Range

After:
- Single Month
- Full Year
- Custom Range
- 12 Month Trend  (NEW)
```

### When "12 Month Trend" is Selected
Show start/end month pickers that default to the last 12 months:
- Start Month: [Select Month dropdown - defaults to 12 months ago]
- End Month: [Select Month dropdown - defaults to current month]

The "View Dashboard" button will navigate to the trend view instead of the comparison table.

## Technical Details

### Default Date Range Calculation
```typescript
// When user selects "monthly_trend"
const today = new Date();
const defaultStart = new Date(today.getFullYear(), today.getMonth() - 11, 1);
const defaultEnd = today;
```

### Session Storage Persistence
The existing state persistence already saves `datePeriodType`, `startMonth`, and `endMonth`, so the new option will automatically persist.

### Saved Filters Compatibility
The `enterprise_filters` table already stores `date_period_type`, so saved filters will work with the new option.

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/Enterprise.tsx` | Add `monthly_trend` to DatePeriodType, add dropdown option, update button visibility logic |
| `src/components/enterprise/FixedCombinedTrendView.tsx` | Optional: Add prop for selected department names if needed |

## Edge Cases
1. **No data in range**: Already handled by FixedCombinedTrendView with "No data available" message
2. **Partial data**: DataCoverageBadge already shows months with data vs total
3. **Sub-metrics**: Already supported in the trend view
4. **Brand-specific metrics**: Already handled via `getMetricsForBrand()`
