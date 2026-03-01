
## Root Cause

The image shows each technician appearing **twice** in the scorecard (e.g., Bill Vanderbos appears at two different positions, Michael Abrahamsz appears twice). This happens because the KPI lookup during import uses `.ilike("name", spec.name)` — a case-insensitive **partial match** — instead of an exact match.

On re-import, `.ilike("name", "Productive")` would match any KPI containing "Productive" in its name. If it silently returns nothing (or the match fails due to whitespace), a **second** KPI definition is created for the same technician+department with the same name. The scorecard then shows both KPI rows per technician.

## Fix — `TechnicianImportPreviewDialog.tsx` only

### Change `.ilike()` to `.eq()` for exact KPI name matching (line 312)

```typescript
// BEFORE (broken — partial match can miss or create duplicates)
.ilike("name", spec.name)

// AFTER (correct — exact match prevents duplicates)
.eq("name", spec.name)
```

### Also: Delete orphaned duplicate KPI definitions on import

When checking for an existing KPI, if multiple rows are found (which is why `.maybeSingle()` silently fails), we should:
1. Keep the first one
2. Delete the duplicates (or at minimum, not create another one)

Change the existing check from `.maybeSingle()` to `.limit(1)` with a separate cleanup step:

```typescript
// Get all KPIs with this exact name for this user
const { data: existingList } = await supabase
  .from("kpi_definitions")
  .select("id, name")
  .eq("department_id", departmentId)
  .eq("assigned_to", selectedUserId)
  .eq("name", spec.name);  // exact match

if (existingList && existingList.length > 0) {
  // Use the first one, delete any extras
  kpiIdMap[spec.name] = existingList[0].id;
  if (existingList.length > 1) {
    const idsToDelete = existingList.slice(1).map(e => e.id);
    await supabase.from("kpi_definitions").delete().in("id", idsToDelete);
  }
} else {
  // Create new KPI
}
```

This is a one-file change that both prevents future duplicates and cleans up existing ones on the next import.
