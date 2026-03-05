
## Diagnosis

The screenshot shows Jim E's Q1 Total: Available Hours = 283.43, Open and Closed Hours = 65.63, Productivity = 47%.

Math check: 65.63 / 283.43 × 100 = **23.1%** — not 47%.

This means the Productivity percentage stored in the DB is **inconsistent** with the Available Hours and Sold Hours values also stored. There are two likely explanations:

1. **Data in DB is stale from before the parser fix** — Jim E's Available Hours were imported from the wrong column ("Actual Hrs" instead of "Clocked In Hrs"), but Productivity was calculated from the correct columns at import time (or vice versa). The mismatch is between what's stored and what the live calculation would yield.

2. **The Σ Totals Productivity row is calculated live** (sold sum ÷ avail sum × 100) but Jim E's **individual row** reads the stored `actual_value` directly — if the stored value came from a different ratio than the stored hours, they'll disagree.

The root cause: **the old import (before the parser fix) wrote Available Hours from "Actual Hrs" column and Productivity from `soldHrs / clockedInHrs`** — so the Productivity% in the DB was calculated correctly from "Clocked In Hrs", but the "Available Hours" KPI value was written from "Actual Hrs". Now the individual Productivity row shows the correct ratio (47% from sold/clockedIn), but Available Hours shows "Actual Hrs" value (283.43) which is larger — making the live Q1 Total calculation (65.63 / 283.43 = 23%) wrong.

**The fix is not in the code** — the code parser is now correct (exact match: "Clocked In Hrs"). **The fix is to re-import the River City Ram report.** This will overwrite the stale Available Hours values (currently "Actual Hrs" values) with the correct "Clocked In Hrs" values. After re-import, the individual Productivity stored value AND the live Σ Totals calculation will both be consistent.

## What needs to happen

1. **No code change needed** — the parser is already fixed to use exact "Clocked In Hrs" for Available Hours and "Sold Hrs" for Open and Closed Hours.
2. **Re-import the River City Ram technician report** — this will overwrite the stale DB entries with correctly-mapped values.

## One code concern to verify

Looking at the import code at line 345:
```typescript
actual_value: parseFloat((week.productive * 100).toFixed(2))
```
`week.productive = soldHrs / clockedInHrs` (a ratio like 0.47)
→ stored as `47.0` ✅ correct

And the cell renders via `formatTarget` with `metric_type = "percentage"` → `Math.round(47)%` = "47%" ✅

So after re-import with the correct column mapping, Jim E's Productivity will equal `(OpenAndClosedHours / AvailableHours) × 100` and all three values in the DB will be consistent.

## Summary

| What | Status |
|---|---|
| Parser code | ✅ Already fixed — exact match "Clocked In Hrs" and "Sold Hrs" |
| DB data (Jim E + all techs) | ❌ Stale — imported before parser fix, Available Hours has wrong values |
| Fix | Re-import the River City Ram report |

**No code changes needed.** The user should re-upload the River City Ram technician report through the import flow. All 8 technicians will have their data corrected.
