
# Fix Quarter Validation for Scorecard Email

## Problem
When attempting to email a "Monthly" scorecard report while in Quarter Trend view (`quarter = 0`), the edge function throws "Quarter is required for weekly and monthly modes" because the validation `!quarter` treats `0` as falsy/missing.

## Root Cause
Line 177 in `send-scorecard-email/index.ts`:
```typescript
if (mode !== "yearly" && !quarter) {
  throw new Error("Quarter is required for weekly and monthly modes");
}
```

The check `!quarter` returns `true` for both:
- `quarter = 0` (Quarter Trend mode - valid value)
- `quarter = undefined/null` (actually missing - should fail)

## Solution
Change the validation to explicitly check for `null` or `undefined` instead of using falsy check:

```typescript
if (mode !== "yearly" && quarter == null) {
  throw new Error("Quarter is required for weekly and monthly modes");
}
```

The `== null` check only matches `null` and `undefined`, allowing `0` to pass through.

## Additional Consideration
When `quarter = 0` (Quarter Trend mode), the edge function should determine appropriate periods. Looking at the existing logic (lines 282-286), it handles:
- `quarter === -1` → Monthly Trend (12 months)
- Specific quarters (1-4) → 3 months

For `quarter = 0` (Quarter Trend), we should use the same logic as "yearly" mode (all 12 months) since Quarter Trend shows a rolling 5-quarter view which spans multiple years.

## File to Modify

**`supabase/functions/send-scorecard-email/index.ts`**

### Change 1: Fix validation (line 177)
```typescript
// Before
if (mode !== "yearly" && !quarter) {

// After  
if (mode !== "yearly" && quarter == null) {
```

### Change 2: Handle Quarter Trend mode in period selection (lines 280-286)
```typescript
// Before
const periods = mode === "weekly"
  ? getWeekDates({ year, quarter: quarter! })
  : (mode === "yearly" || mode === "monthly") && quarter === -1
  ? getMonthlyTrendMonths({ year })
  : mode === "yearly"
  ? getAllMonthsForYear({ year })
  : getMonthsForQuarter({ year, quarter: quarter! });

// After - also handle quarter === 0 (Quarter Trend) like yearly
const periods = mode === "weekly"
  ? getWeekDates({ year, quarter: quarter! })
  : (mode === "yearly" || mode === "monthly") && (quarter === -1 || quarter === 0)
  ? getMonthlyTrendMonths({ year })
  : mode === "yearly"
  ? getAllMonthsForYear({ year })
  : getMonthsForQuarter({ year, quarter: quarter! });
```

## Testing
1. Navigate to Steve Marshall Ford dashboard
2. Switch to "Quarter Trend" view (quarter = 0)
3. Open Print/Email dialog and select "Monthly" report
4. Send email to test recipient
5. Verify email is sent successfully with 12-month data
