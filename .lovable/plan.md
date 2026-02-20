

# Fix: Negative Target Values Causing Incorrect Color Indicators

## Problem

When both the actual value and the forecast/target are **negative** (common for metrics like Department Profit during loss periods), the variance percentage calculation produces an inverted result.

**Example from the screenshot:**
- Department Profit actual: -$8,461
- Forecast target: say -$15,000 (a worse loss)
- The actual is **better** (less of a loss), so it should be **green**
- But the math: `((-8,461 - (-15,000)) / (-15,000)) * 100 = -43.6%`
- Because the denominator is negative, the positive numerator becomes a negative percentage
- The code sees `variance < 0` with `targetDirection = "above"` and shows **red**

The same issue affects Net Operating Profit and any other metric that can have negative target values.

## Root Cause

The variance formula `((actual - target) / target) * 100` breaks when `target` is negative because dividing by a negative number flips the sign. The code assumes a positive denominator.

## Solution

Use `Math.abs(targetValue)` in the denominator for all dollar-metric variance calculations. This preserves the correct sign of the numerator (actual minus target) while preventing the negative denominator from inverting the result.

The change: `((value - target) / target)` becomes `((value - target) / Math.abs(target))`

## Files to Update

**`src/components/financial/FinancialSummary.tsx`** -- Update all variance calculation instances (there are approximately 6-8 locations):

1. **Monthly trend cells** (~line 3785-3787): calculated metrics color
2. **Monthly trend cells** (~line 3841-3843): editable metrics color
3. **Quarter trend cells** (~line 4116-4118): quarter trend mode color
4. **Previous year quarter cells** (~line 4168-4170): preceding quarter color
5. **Standard quarter cells** (~line 4306-4308): last year comparison color
6. **Standard month cells** (~line 4546-4548): main quarter view color
7. **Issue creation severity** (~line 2402-2404): auto-severity for new issues

**`src/components/financial/SubMetricsRow.tsx`** -- Update the `getVarianceStatus` helper (~line 123):

Change `((value - targetValue) / Math.abs(targetValue)) * 100` -- this one actually already uses `Math.abs(targetValue)` on line 123, so the sub-metric rows are correct. The bug is only in the parent FinancialSummary component.

## Technical Detail

Each location follows this pattern change:

Before:
```
const variance = metric.type === "percentage"
  ? value - targetValue
  : ((value - targetValue) / targetValue) * 100;
```

After:
```
const variance = metric.type === "percentage"
  ? value - targetValue
  : ((value - targetValue) / Math.abs(targetValue)) * 100;
```

Percentage metrics are unaffected (they use simple subtraction, not division). Only dollar metrics that divide by the target need this fix.

## Impact

- Department Profit, Net Operating Profit, and any other dollar metric with a negative forecast/target will now correctly show green when the actual is better than forecast
- No change to behavior when targets are positive (Math.abs of a positive number is the same number)
- Sub-metric rows already handle this correctly via `Math.abs` in their helper function

