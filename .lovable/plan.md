

## Deduplicate KPIs in the Mapping Dialog

### Problem
Since we changed the KPI list to show all department KPIs (not filtered by owner), and each KPI is assigned once per advisor, the same KPI name like "CP ELR" appears 7 times in the list. You only need one entry per unique KPI since the mapping is position-based and applies to all advisors.

### Changes

**File: `src/components/admin/scorecard-mapper/ScorecardVisualMapper.tsx`**

Update the `userAssignedKpis` memo (around line 1282) to deduplicate by KPI name, keeping only one entry per unique KPI:

```typescript
const userAssignedKpis = useMemo(() => {
  if (!departmentKpis) return [];
  // Deduplicate by name — one entry per unique KPI
  const seen = new Map<string, typeof departmentKpis[0]>();
  for (const kpi of departmentKpis) {
    if (!seen.has(kpi.name)) {
      seen.set(kpi.name, kpi);
    }
  }
  return Array.from(seen.values());
}, [departmentKpis]);
```

This uses the first occurrence of each KPI name, preserving the id, name, and metric_type for the mapping dialog. The mapping is stored by KPI name (not id), so it correctly applies across all advisors during import regardless of which specific `id` is used in the picker.

### What stays the same
- The auto-apply and bulk-apply logic still filters `departmentKpis` by `assigned_to` for user-specific operations
- The `CellKpiMappingPopover` component needs no changes
- The mapping save/remove logic is unchanged

