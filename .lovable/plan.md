

## Fix: Universal Mapping Template Should Not Be Store-Filtered

### Root Cause
The recent store-filtering change made the `cellMappings` query only return mappings for users in the current store. But Winnipeg Chevrolet has zero cell mappings -- the mappings were created for users at Murray Merritt. Since the `universalMappingTemplate` is built from these filtered (empty) results, the import falls back to the legacy `getStandardKpiName` matching, which only maps "E.L.R." to "CP ELR".

The cell mappings define the **report format** (e.g., column 14, row offset 2 = "CP ELR"). This structure is universal across all stores using the same import profile. The store filter should NOT apply to the template -- only to determining which specific user's KPIs to write to.

### Fix

**File: `src/components/scorecard/ScorecardImportPreviewDialog.tsx`**

Change the `cellMappings` query (lines 127-158) to remove the store-user filter. Fetch ALL cell mappings for the import profile, since the template is universal:

```
// Before (broken): filters to store users only
const storeUserIds = storeProfiles?.map(p => p.id) || [];
if (storeUserIds.length === 0) return [];
.in("user_id", storeUserIds);

// After (fixed): fetch all mappings for the profile
.eq("import_profile_id", importProfile.id)
// No store filter -- template is universal
```

Remove the intermediate `profiles` fetch and the `.in("user_id", ...)` filter. The query key can also drop `storeId` since the template is profile-scoped, not store-scoped.

### Why This Is Safe
- The template only extracts the report structure (column index + row offset -> KPI name)
- The actual import logic (lines 344-396) matches KPI names against `kpiDefinitions.filter(k => k.assigned_to === mapping.selectedUserId)` -- so it already scopes writes to the correct user's KPIs
- No cross-store data leakage occurs because the user assignment dropdowns are already store-filtered

### What Stays Store-Filtered
- The Visual Mapper (`ScorecardVisualMapper.tsx`) should keep its store filter because it shows per-user mapping UI
- The user dropdowns in the import preview remain store-filtered
- Only the template extraction needs to be universal

