
## Show All Scorecard KPIs in the Mapping Dialog

### Problem
The "Map Cell to KPI" dialog currently only shows KPIs assigned to the specific advisor (owner). You want to see ALL KPIs available in the department scorecard so you can map any cell to any KPI regardless of ownership.

### Changes

**File: `src/components/admin/scorecard-mapper/ScorecardVisualMapper.tsx`**

1. Change the `userAssignedKpis` memo (around line 1282) to return ALL department KPIs instead of filtering by `assigned_to === selectedKpiOwnerId`:

```typescript
const userAssignedKpis = useMemo(() => {
  if (!departmentKpis) return [];
  return departmentKpis;
}, [departmentKpis]);
```

2. Update the sidebar label in the `CellKpiMappingPopover` section (around line 1875) to say "Department KPIs" or "Scorecard KPIs" instead of showing the advisor's name possessively (e.g., "Craig Hominick's KPIs").

3. The "Need Mapping" vs "Already Mapped" split, the progress bar, and the Select dropdown will all automatically show all department KPIs since they derive from `userAssignedKpis`.

**File: `src/components/admin/scorecard-mapper/CellKpiMappingPopover.tsx`**

No structural changes needed -- it already accepts a `userKpis` array and renders whatever is passed. The sidebar title uses the `advisorName` prop, so we will pass a generic label like "Scorecard KPIs" instead.

### What stays the same
- The auto-apply templates logic (`applyTemplatesForUser`) will still filter by `assigned_to` since that maps specific KPIs to specific users during import.
- The bulk apply logic remains owner-scoped for correct data import.
- Only the mapping dialog's KPI picker is broadened.
