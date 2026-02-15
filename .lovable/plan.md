

## ✅ COMPLETED: Body Shop Forecast Not Producing Visual Cues

### Fix Applied

Added `saveTrigger` state counter to `ForecastDrawer.tsx` that forces the auto-save `useEffect` to re-run when drivers are initialized. This solves the issue where `markDirty()` only set a ref (no re-render), so the auto-save effect never fired for sub-metric-only departments.

Changes:
1. Added `saveTrigger` state + `setSaveTrigger(c => c + 1)` in all three initialization paths (driver settings, prior year data, sub-metric fallback)
2. Removed `!driversInitialized.current` guard from sub-metric fallback (driver settings may set it first)
3. Added `saveTrigger` to auto-save dependency array
4. Fixed `activity_log` type errors in admin components
