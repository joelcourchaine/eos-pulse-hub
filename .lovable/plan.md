
## Root Cause Analysis

The Q1 Target column (lines 4628–4658 in `FinancialSummary.tsx`) follows this priority logic:

```ts
const hasManualTarget = target !== null && target !== undefined && target !== 0;
let displayTarget = target;  // From financial_targets table

if (!hasManualTarget && hasForecastTargets) {
  // Only reach here if no manual target exists
  displayTarget = forecastAverage;  
}
```

`target` comes from `targets[metric.key]` which is populated by `loadTargets()` → `financial_targets` table, queried for `year` and current `quarter`. Even though old targets were purged, the system may still have stale rows — **or more importantly**, the `onTargetsPushed` callback fires `loadTargets()` (reloads financial_targets table) but NOT `refetchForecastTargets()`. So the forecast map doesn't refresh after "Push to Targets" is clicked.

Additionally, because we're now forecast-only, the **forecast average should always take priority** over any stale financial_targets rows for the Q1 Target column display.

## Fix — Two Changes to `FinancialSummary.tsx`

### 1. Q1 Target display logic — forecast always wins (lines 4628–4658)

Change the condition from "forecast only if no manual target" to "forecast always, with manual as last resort":

```ts
// Before:
const hasManualTarget = target !== null && target !== undefined && target !== 0;
let displayTarget = target;
if (!hasManualTarget && hasForecastTargets) { ... use forecast ... }

// After:
let displayTarget = target;
let isForecastTarget = false;

if (hasForecastTargets) {
  // Forecast always wins when a forecast exists
  const qtrMonths = getQuarterMonthsForCalculation(quarter, year).map((m) => m.identifier);
  const forecastVals = qtrMonths
    .map((mid) => getForecastTarget(metric.key, mid))
    .filter((v): v is number => v !== null);
  if (forecastVals.length > 0) {
    displayTarget = forecastVals.reduce((s, v) => s + v, 0) / forecastVals.length;
    isForecastTarget = true;
  }
}
// Fall back to manual target only if no forecast
if (!isForecastTarget) {
  displayTarget = target;
}
```

### 2. `onOpenChange` — also refresh forecast targets when drawer closes (line 5544–5549)

Currently closing the drawer only calls `refetchForecastTargets()`. But if "Push to Targets" is clicked inside, `onTargetsPushed = loadTargets` fires (refreshes the `financial_targets` state) but NOT the forecast map. The close handler already does `refetchForecastTargets()` so this is fine — but we should also ensure `loadTargets` is called on close so both maps are fresh:

```ts
onOpenChange={(open) => {
  setForecastDrawerOpen(open);
  if (!open) {
    refetchForecastTargets();
    loadTargets(); // also refresh manual targets cache
  }
}}
```

### Files to change
- `src/components/financial/FinancialSummary.tsx` — fix Q1 Target display logic (lines ~4628–4658) and add `loadTargets()` to drawer close handler (line ~5547)
