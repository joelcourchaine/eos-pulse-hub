
## Problem

In the weekly view, cell colors (green/amber/red) come from `entry?.status` stored in the database — a value computed at import/save time. If no target is set (or a target was deleted), the stored `status` might still be "green"/"red" from a previous import, causing misleading colors on cells that have no target to compare against.

In monthly/quarterly/yearly views, `trendStatus`/`qStatus` are computed live by comparing the value to a `targetValue`. If `targetValue` is null/0, the status is already `null` and no color shows — these views are **already correct**.

The problem is specifically the **weekly view** data cells and the **weekly Q-Total column**, where color comes from the stored `entry.status` regardless of whether a target currently exists.

## Fix

### 1. Weekly data cells (line ~4787)
Currently:
```typescript
const status = getStatus(entry?.status || null);
const targetValue = kpiTargets[kpi.id] || kpi.target_value;
```
Add a `hasTarget` guard so `status` is suppressed when no target exists:
```typescript
const targetValue = kpiTargets[kpi.id] ?? kpi.target_value;
const hasTarget = targetValue !== null && targetValue !== undefined && targetValue !== 0;
const status = hasTarget ? getStatus(entry?.status || null) : "default";
```

### 2. Weekly Q-Total cell (line ~4963-4989)
The Q-Total is computed live from `qTarget`. Already only sets `qStatus` when `qTarget !== null && qTarget !== 0` — this is already correct. No change needed here.

### 3. Also: Target column display
Currently the target column shows `formatTarget()` which returns `"—"` for null values, so no change needed there.

### 4. Text color classes in weekly cells (lines ~4815-4825)
The text color classes (`text-emerald-800`, `text-amber-800`, `text-red-800`) that appear inside the display value div also need the same guard — they key off `status`, so fixing `status` at the source (step 1) automatically fixes the text color too.

## Files to change

- **`src/components/scorecard/ScorecardGrid.tsx`**: ~line 4787 (weekly view per-cell status derivation) — derive `hasTarget` from `kpiTargets[kpi.id] ?? kpi.target_value` and set `status = hasTarget ? getStatus(entry?.status || null) : "default"`.

That's a single, targeted, safe change. Monthly/quarterly/yearly views already guard on `targetValue !== null` before computing their status, so no changes needed there.
