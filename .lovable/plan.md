
## Root Cause

The Q1 Target column for both parent metrics (line 4640 in `FinancialSummary.tsx`) and sub-metrics (line 733 in `SubMetricsRow.tsx`) computes the quarterly value as a **simple average** of 3 monthly forecast values:

```ts
displayTarget = forecastVals.reduce((s, v) => s + v, 0) / forecastVals.length;
```

For **dollar metrics** (total_sales, gp_net, etc.), a quarterly target should be the **sum** of 3 monthly values — not an average. This is why parent ≠ sum of sub-metrics: the parent forecast entry is calculated independently via growth-weighted scaling (not as a sum of sub-metric entries), and averaging 3 monthly values produces a completely different number from what the drawer shows as the quarterly total.

For **percentage metrics** (gp_percent, etc.), the correct approach is a weighted average: `sum(numerator months) / sum(denominator months) * 100`, not a simple average.

## Fix — Two files

### 1. `FinancialSummary.tsx` — parent metric Q1 Target (~line 4636–4640)

Change from average to **sum for dollar metrics, weighted calc for percentages**:

```ts
if (forecastVals.length > 0) {
  if (metric.type === 'percentage' && metric.calculation && 'numerator' in metric.calculation) {
    // Weighted: sum numerator months / sum denominator months * 100
    const numVals = qtrMonths.map(mid => getForecastTarget(metric.calculation.numerator, mid)).filter(v => v !== null);
    const denVals = qtrMonths.map(mid => getForecastTarget(metric.calculation.denominator, mid)).filter(v => v !== null);
    const numSum = numVals.reduce((s, v) => s + v, 0);
    const denSum = denVals.reduce((s, v) => s + v, 0);
    displayTarget = denSum > 0 ? (numSum / denSum) * 100 : forecastVals.reduce((s, v) => s + v, 0) / forecastVals.length;
  } else {
    // Dollar: sum of 3 months
    displayTarget = forecastVals.reduce((s, v) => s + v, 0);
  }
  isForecastTarget = true;
}
```

### 2. `SubMetricsRow.tsx` — sub-metric Q1 Target (~line 727–733)

Same change: sum for non-percentage parents, simple average only for percentage parents (since sub-metric percentage values are already percentages):

```ts
if (fVals.length > 0) {
  // For percentage parent metrics, keep average; for dollar metrics, sum
  forecastQuarterAvg = isPercentageMetric
    ? fVals.reduce((s, v) => s + v, 0) / fVals.length
    : fVals.reduce((s, v) => s + v, 0);
}
```

`isPercentageMetric` is already a prop on `SubMetricsRow`.

### Files to change
- `src/components/financial/FinancialSummary.tsx` — lines ~4636–4642: switch dollar metrics from average to sum
- `src/components/financial/SubMetricsRow.tsx` — lines ~727–733: switch dollar sub-metrics from average to sum using `isPercentageMetric` prop
