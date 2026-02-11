

## Filter Cell Mappings by Store in Visual Mapper and Import Preview

### Problem
When viewing the Visual Mapper for a specific store (e.g., Winnipeg Chevrolet), cell KPI mappings from advisors at OTHER stores (e.g., Murray Merritt) are also loaded and displayed. The mappings themselves are correctly tied to individual user IDs, but the fetch queries don't filter by store -- they load every mapping for the entire import profile.

### What Changes

The column templates and KPI position mappings stay universal (they define report format). Only the **user-specific cell mappings** need to be filtered so you only see the advisors/managers from the currently selected store.

### Fix (2 files, 2 queries)

**1. Visual Mapper (`ScorecardVisualMapper.tsx`) -- Line ~582-593**

Currently fetches ALL cell mappings for the profile:
```
.from("scorecard_cell_mappings")
.select("*")
.eq("import_profile_id", selectedProfileId)
```

Fix: Also filter by user IDs belonging to the selected store. Use the `storeUsers` data (already fetched at line 404-418) to build a list of valid user IDs and add `.in("user_id", storeUserIds)` to the query. Add `selectedStoreId` to the query key so it refetches on store change.

**2. Import Preview (`ScorecardImportPreviewDialog.tsx`) -- Line ~156-183**

Currently fetches ALL cell mappings for the profile:
```
.from("scorecard_cell_mappings")
.select("*, kpi_definitions(name)")
.eq("import_profile_id", importProfile.id)
```

Fix: Filter by users belonging to the current `storeId`. Fetch store user IDs first, then add `.in("user_id", storeUserIds)` to the cell mappings query.

### Why This Works
- Cell mappings are already keyed per user (`user_id` column)
- Users belong to specific stores (`profiles.store_id`)
- By filtering to only users from the selected store, each store sees only its own advisors' mappings
- The column templates remain universal -- only the user-level cell mappings are scoped
- No database schema changes needed

### Edge Case: Users with No Store
If `storeUsers` is empty or not yet loaded, the query will return no mappings (safe default -- prevents cross-store leakage).
