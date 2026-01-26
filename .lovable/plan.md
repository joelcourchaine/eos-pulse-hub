
# Add Admin Login Activity Chart

## Overview
Create a new chart component that visualizes user login activity over time, with selectable time ranges (1D, 1W, 1M, 6M, 1Y). This chart will be added to the Admin Overview tab to provide administrators with a visual representation of user engagement trends.

## Files to Change

### 1. Create New File: `src/components/admin/AdminLoginChart.tsx`
A new React component featuring:
- Interactive time range selector (1D, 1W, 1M, 6M, 1Y buttons)
- Area chart using Recharts library (already installed)
- Queries the `profiles` table for `last_sign_in_at` timestamps
- Buckets data by hour (1D), day (1W/1M), or week (6M/1Y)
- Shows total unique users count in the header
- Gradient fill for visual appeal
- Loading skeleton while data fetches

### 2. Modify: `src/components/admin/AdminOverviewTab.tsx`
- Add import for the new `AdminLoginChart` component
- Restructure the layout to place the chart at the top spanning full width
- Keep existing "Users by Role" and "Recent Logins" cards in a 2-column grid below

## Technical Details

### Data Query Logic
The component queries `profiles.last_sign_in_at` within the selected date range:
- Filters out null values and system users
- Groups logins into time buckets based on selected range
- Uses `date-fns` for date manipulation (already imported in codebase)

### Time Range Bucketing
| Range | Bucket Size | Format |
|-------|-------------|--------|
| 1D | Hour | HH:mm |
| 1W | Day | MMM d |
| 1M | Day | MMM d |
| 6M | Week | MMM d |
| 1Y | Week | MMM d |

### Chart Styling
- Uses Recharts `AreaChart` with gradient fill
- Primary color theming via CSS variables
- Responsive container for all screen sizes

## Layout After Changes
```text
+------------------------------------------+
|         Admin Login Chart (full width)   |
|  [1D] [1W] [1M] [6M] [1Y]               |
|  ~~~~~~~~ Area Chart ~~~~~~~~            |
+------------------------------------------+
+-------------------+  +-------------------+
|  Users by Role    |  |  Recent Logins   |
|  (existing card)  |  |  (existing card) |
+-------------------+  +-------------------+
```
