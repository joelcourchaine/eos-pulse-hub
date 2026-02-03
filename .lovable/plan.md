
# Quarterly Trend Email Report - COMPLETED

## What was implemented

Added a new "Quarterly Trend (Rolling 5 quarters)" option to the Email Scorecard Report dialog.

### Frontend Changes (`src/pages/Dashboard.tsx`)
- Extended `printMode` type to include `"quarterly-trend"`
- Added new radio button option in the email dialog
- Updated mode passing to the edge function

### Backend Changes (`supabase/functions/send-scorecard-email/index.ts`)
- Added `"quarterly-trend"` to EmailRequest mode type
- Created `getQuarterlyTrendPeriods()` function to generate 5 rolling quarters (Q1 prev year through current quarter)
- Updated validation to allow quarterly-trend mode without explicit quarter parameter
- Implemented quarterly aggregation of monthly KPI data with proper handling for average vs sum metrics
- Implemented quarterly aggregation of financial data with recalculated percentages from summed components
- Fetches targets for both years when spanning two calendar years
- Uses proper inline styles for email forwarding compatibility
- Email subject line updated for quarterly-trend mode

### PrintView Changes (`src/components/print/PrintView.tsx`)
- Updated interface to accept `"quarterly-trend"` mode

## How it works

The Quarterly Trend email report:
1. Shows 5 quarters: Q1 of previous year through current quarter
2. Aggregates monthly KPI entries into quarterly totals (using sum or average based on aggregation_type)
3. Aggregates monthly financial data into quarterly totals
4. Recalculates percentage metrics from aggregated dollar components for accuracy
5. Shows status colors based on quarter-specific targets
6. Includes Avg and Total summary columns
7. Uses inline HTML styles for proper email forwarding
