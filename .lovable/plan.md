
## Root Cause: Duplicate Entries Within the Upsert Batch

The DB logs reveal the real error: **"ON CONFLICT DO UPDATE command cannot affect row a second time"**

This is a Postgres error that occurs when a single `upsert` batch contains **two or more rows with the same conflict key**. Postgres cannot decide which of the two rows to use for the update, so it throws and the entire batch fails silently (supabase-js swallows it).

The previous constraint fix was necessary but not sufficient. The actual bug is in `TechnicianImportPreviewDialog.tsx`: the `allMonthlyEntries` and `allWeeklyEntries` arrays are built by pushing entries across multiple technicians, but for **weekly data** a single technician can have the same `week_start_date` span appearing more than once (if the report has page breaks that restart the technician block partway through), and for **monthly data** this compounds if the parser sees data across page boundaries.

### Fix: Deduplicate entries before upserting

After building `allMonthlyEntries` and `allWeeklyEntries` (and after filtering protected entries), deduplicate by composite key — keeping the last value seen:

```typescript
// Deduplicate weekly entries — keep last value per kpi_id+week_start_date
const weeklyMap = new Map<string, typeof filteredWeekly[0]>();
for (const e of filteredWeekly) {
  weeklyMap.set(`${e.kpi_id}|${e.week_start_date}`, e);
}
const dedupedWeekly = Array.from(weeklyMap.values());

// Deduplicate monthly entries — keep last value per kpi_id+month+entry_type
const monthlyMap = new Map<string, typeof filteredMonthly[0]>();
for (const e of filteredMonthly) {
  monthlyMap.set(`${e.kpi_id}|${e.month}|${e.entry_type}`, e);
}
const dedupedMonthly = Array.from(monthlyMap.values());
```

Then upsert `dedupedWeekly` and `dedupedMonthly` instead of `filteredWeekly` and `filteredMonthly`.

### File to change
- `src/components/scorecard/TechnicianImportPreviewDialog.tsx` — add deduplication step between protected-entry filtering and batch upsert loops (~lines 379–400)

### No DB changes needed
The constraints are now correct. The issue is purely client-side duplicate rows in the batch payload.
