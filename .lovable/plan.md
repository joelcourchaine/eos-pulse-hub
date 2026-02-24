

# Fix Financial Summary Color Indicators Using Wrong Target Scale

## Problem

The green/yellow/red performance indicators in the Financial Summary are comparing **monthly actual values** against **quarterly target totals** without dividing by 3. This makes all the colors wrong:

- "Below" metrics (expenses) appear falsely green because monthly actuals are naturally less than a 3-month total
- "Above" metrics (revenue/profit) appear falsely red because monthly actuals can't reach a 3-month total

For example, at Murray Merritt Service (January 2026):
- Sales Expense actual: $56,208/month vs quarterly target $135,198 -- shows green (below target) when it should be red ($56,208 > $45,066 monthly target)
- Total Sales actual: $128,287/month vs quarterly target $328,986 -- shows red (below target) when it should be green ($128,287 > $101,449 monthly target)

## Root Cause

The `getTargetForMonth` function (line 442-466 of FinancialSummary.tsx) returns the raw quarterly target value from `financial_targets` without adjusting for monthly comparison. The forecast fallback correctly stores per-month values, but it is never reached because the quarterly manual target takes priority.

## Solution

Modify `getTargetForMonth` to divide quarterly dollar targets by 3 when resolving a target for a specific month. Percentage metrics should NOT be divided since percentages are rates, not cumulative totals.

## Technical Details

### File: `src/components/financial/FinancialSummary.tsx`

Update the `getTargetForMonth` function at lines 448-466. When a manual quarterly target is found (either from `trendTargets` or `targets`), divide the value by 3 for non-percentage metrics before returning:

```text
Before (line 451-452):
  if (trendTarget && trendTarget.value !== 0) {
    return { value: trendTarget.value, ... };
  }

After:
  if (trendTarget && trendTarget.value !== 0) {
    const monthlyValue = metricDef.type === 'percentage' 
      ? trendTarget.value 
      : trendTarget.value / 3;
    return { value: monthlyValue, ... };
  }
```

Same adjustment for the standard targets path (line 455-456):

```text
Before:
  return { value: targets[metricKey], ... };

After:
  const monthlyValue = metricDef.type === 'percentage'
    ? targets[metricKey]
    : targets[metricKey] / 3;
  return { value: monthlyValue, ... };
```

### Build Error Fix

Additionally, fix the existing logrocket type error by adding a type declaration file `src/logrocket.d.ts` to suppress the third-party type issue.

### Files Changed
- `src/components/financial/FinancialSummary.tsx` -- Divide quarterly targets by 3 for monthly comparison
- `src/logrocket.d.ts` -- New file to fix logrocket type error

