
## Root Cause

In `handleRedistributeByWeights` (line 438), redistributed entries are saved with `isLocked: false`. After saving, the calculation engine in `useForecastCalculations.ts` (line 592) only uses stored values when `isLocked === true` — unlocked stored values are ignored and the engine recalculates from growth. So the DB gets the right numbers but the UI immediately overwrites them with growth-calculated values.

## Fix — `src/components/financial/ForecastDrawer.tsx`, line 438

Change `isLocked: false` to `isLocked: true` in the `updates.push(...)` call inside `handleRedistributeByWeights`:

```ts
// BEFORE (line 438)
isLocked: false,

// AFTER
isLocked: true,
```

This makes redistributed values stick in the UI (calculation engine respects locked entries), which is also the correct semantic — the user has explicitly overridden the monthly distribution, so those values should be preserved until they unlock or reset.
