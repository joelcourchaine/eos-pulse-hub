
## Two changes: rename "Productive" → "Productivity" + make it read-only and auto-derived

### What needs to change

**1. Rename "Productive" → "Productivity" everywhere**

The KPI name `"Productive"` is used as a string literal in several places for:
- Detection/filtering (the `isCalculatedKPI` guard, soldKpis exclusions, productiveKpis filter)
- Auto-creation during technician import
- Totals section row label and KPI filter matching

Files with the literal string `"Productive"` tied to the KPI name:
- `src/components/scorecard/ScorecardGrid.tsx` — lines 5388, 5390, 5420, 5438 (all string comparisons and labels)
- `src/components/scorecard/TechnicianImportPreviewDialog.tsx` — line 332, 377 (KPI creation name and ID lookup)

**2. Make "Productivity" read-only + auto-recalculate from Available/Sold Hours**

Currently `isCalculatedKPI()` returns an empty array (line 2661–2663) — nothing is auto-calculated. The `calculateDependentKPIs()` function at line 1852 already has full machinery to:
- Watch for a changed KPI
- Find a matching calculated KPI owned by the same technician
- Compute numerator/denominator
- Upsert the result to `scorecard_entries`

**Changes required:**

**A. `isCalculatedKPI` — add "Productivity" to the list (line 2661)**
```typescript
const calculatedKPIs: string[] = ["Productivity"];
```
This makes every cell for a "Productivity" KPI `disabled` and `readOnly` in the UI — already wired at lines 4633–4634, 4926–4927, 5326–5327.

**B. `calculateDependentKPIs` — add rule for "Productivity" (line 1866)**
```typescript
const calculationRules: { [key: string]: { numerator: string; denominator: string } } = {
  "Productivity": { numerator: "Sold Hours", denominator: "Available Hours" },
};
```
When a user saves Available Hours or Sold Hours, this rule fires for all KPIs named "Productivity" owned by the same technician, computes `sold / available * 100`, and saves it.

> Note: The sold KPI may be named differently (e.g., "Open Hours", "Closed Hours"). We need to handle that. Instead of hardcoding "Sold Hours" as numerator, we should look up the sold KPI by: same owner + unit type + not "Available Hours" + not "Productivity". This already mirrors the logic at line 5388. We'll add a helper that resolves the rule dynamically by owner context.

**C. Update the rename references in `ScorecardGrid.tsx`**
- Line 5388: `k.name !== "Productive"` → `k.name !== "Productivity"`
- Line 5390: same
- Line 5420: `k.name === "Productive"` → `k.name === "Productivity"`
- Line 5438: `label: "Productive"` → `label: "Productivity"`

**D. Update `TechnicianImportPreviewDialog.tsx`**
- Line 332: `name: "Productive"` → `name: "Productivity"`
- Line 377: `kpiIdMap["Productive"]` → `kpiIdMap["Productivity"]`

### Migration note for existing data
Existing KPIs named "Productive" in the database won't automatically be renamed — but since KPI names are stored per-department, and the filtering logic is string-match based, existing old-named KPIs will simply not match the new rules. A one-off database migration renaming existing "Productive" KPIs to "Productivity" is needed.

**New migration file:** `supabase/migrations/20260303130000_rename_productive_to_productivity.sql`
```sql
UPDATE public.kpis SET name = 'Productivity' WHERE name = 'Productive';
```

### Files changed
1. `src/components/scorecard/ScorecardGrid.tsx` — 5 string literal replacements + add "Productivity" to `isCalculatedKPI` + dynamic rule in `calculateDependentKPIs`
2. `src/components/scorecard/TechnicianImportPreviewDialog.tsx` — 2 string literal replacements
3. **New:** `supabase/migrations/20260303130000_rename_productive_to_productivity.sql`
