
## Plan: Preserve manually-edited cells during technician import

### Problem
The import does a blind `upsert` on `scorecard_entries` using `onConflict: "kpi_id,week_start_date"` (weekly) and `onConflict: "kpi_id,month,entry_type"` (monthly). This overwrites any value the user manually typed in the scorecard grid.

### Solution
1. **Add a `manually_edited` boolean column** to `scorecard_entries` (default `false`)
2. **Mark entries as manually edited** when a user saves a cell in `ScorecardGrid.tsx`
3. **Pre-filter import entries** — before the batch upsert, fetch existing entries for the affected KPI IDs that have `manually_edited = true`, then exclude those from the upsert batches

---

### Step 1 — Migration
New column: `manually_edited BOOLEAN NOT NULL DEFAULT false`

```sql
ALTER TABLE public.scorecard_entries 
ADD COLUMN manually_edited boolean NOT NULL DEFAULT false;
```

---

### Step 2 — Mark cells as manually edited (`ScorecardGrid.tsx`)
When a user saves a cell value, the upsert already happens in the grid. Add `manually_edited: true` to that upsert payload.

Search `ScorecardGrid.tsx` for the saveEntry / upsert call to `scorecard_entries` and add the flag.

---

### Step 3 — Skip protected entries during import (`TechnicianImportPreviewDialog.tsx`)

After building `allWeeklyEntries` and `allMonthlyEntries`, before the batch upserts:

```typescript
// Collect all KPI IDs involved in this import
const allKpiIds = [...new Set([
  ...allWeeklyEntries.map(e => e.kpi_id),
  ...allMonthlyEntries.map(e => e.kpi_id),
])];

// Fetch existing manually-edited weekly entries
const { data: protectedWeekly } = await supabase
  .from("scorecard_entries")
  .select("kpi_id, week_start_date")
  .in("kpi_id", allKpiIds)
  .eq("manually_edited", true)
  .eq("entry_type", "weekly");

// Fetch existing manually-edited monthly entries
const { data: protectedMonthly } = await supabase
  .from("scorecard_entries")
  .select("kpi_id, month")
  .in("kpi_id", allKpiIds)
  .eq("manually_edited", true)
  .eq("entry_type", "monthly");

// Build Sets for O(1) lookup
const protectedWeeklyKeys = new Set(
  (protectedWeekly ?? []).map(e => `${e.kpi_id}|${e.week_start_date}`)
);
const protectedMonthlyKeys = new Set(
  (protectedMonthly ?? []).map(e => `${e.kpi_id}|${e.month}`)
);

// Filter out protected entries
const filteredWeekly = allWeeklyEntries.filter(
  e => !protectedWeeklyKeys.has(`${e.kpi_id}|${e.week_start_date}`)
);
const filteredMonthly = allMonthlyEntries.filter(
  e => !protectedMonthlyKeys.has(`${e.kpi_id}|${e.month}`)
);
```

Then use `filteredWeekly` and `filteredMonthly` for the batch upserts instead of the originals.

---

### Files changed
1. **New migration** — adds `manually_edited` column to `scorecard_entries`
2. **`ScorecardGrid.tsx`** — add `manually_edited: true` to user-save upserts
3. **`TechnicianImportPreviewDialog.tsx`** — pre-fetch protected entries and filter them out before upserting
