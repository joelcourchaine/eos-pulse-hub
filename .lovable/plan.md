
## Two Fixes in `supabase/functions/send-scorecard-email/index.ts`

### Fix 1: Productivity target mismatch

**Root cause**: Line 724 searches for the Productivity KPI in `allKpisFlat`, which is derived from `kpisByOwner` **after** role filtering. The Productivity KPI is not `assigned_to` any technician — it's a calculated row — so when `roleFilter = "technician"`, `allKpisFlat` contains zero Productivity KPIs, and the code falls back to the hardcoded `115` default.

**Fix**: Move the productivity KPI lookup to use the full `kpis` array (fetched at line 284, before any filtering), not `allKpisFlat`.

```typescript
// Line 724 — change from:
const productivityKpi = allKpisFlat.find((k: any) => k.metric_type === 'percentage' && k.name.toLowerCase().includes('product'));

// to:
const productivityKpi = (kpis || []).find((k: any) => k.metric_type === 'percentage' && k.name.toLowerCase().includes('product'));
```

The `kpiTargetsMap` already contains all targets fetched for the current quarter (line 321-323), so `kpiTargetsMap.get(productivityKpi.id)` will correctly return the manually-entered value.

### Fix 2: Add role label to email title

**Current** (line 679):
```
${storeName} — ${deptName} Scorecard
```

**Desired** when `roleFilter` is set and not "all":
```
${storeName} — ${deptName} Technician Scorecard
```

**Fix**: Build a `roleLabel` string from `roleFilter`:
```typescript
const roleLabel = roleFilter && roleFilter !== "all"
  ? ` ${roleFilter.charAt(0).toUpperCase() + roleFilter.slice(1)}`
  : "";
// then in line 679:
${storeName} — ${deptName}${roleLabel} Scorecard
```

### Changes summary

- **Line ~679**: Title: `${deptName} Scorecard` → `${deptName}${roleLabel} Scorecard`
- **Line ~724**: Change `allKpisFlat.find(...)` → `(kpis || []).find(...)` to get the productivity KPI from the full unfiltered list
