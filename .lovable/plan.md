
# Auto-Map "All Repair Orders" to Department Manager

## Overview
Automatically map the "All Repair Orders" section in CSR Productivity Reports to the department manager for Service Departments. This eliminates manual mapping for aggregate/totals rows.

## Current Behavior
When a CSR Productivity Report is uploaded to the Visual Mapper:
1. Each advisor section (e.g., "Advisor 1099 - Kayla Bender") is detected and shown in the user mappings panel
2. The "All Repair Orders" totals section is also detected as a mappable "advisor"
3. Users must manually select the department manager from the dropdown for "All Repair Orders"

## Proposed Behavior
When "All Repair Orders" is detected and a department is selected:
1. Automatically look up the department's manager from `departments.manager_id`
2. Pre-populate the user mapping for "All Repair Orders" with the manager
3. Still allow manual override if needed

## Technical Implementation

### 1. Update Department Query to Include Manager Info
Modify the `storeDepartments` query to fetch manager details:

```typescript
// Current query (line ~384-396)
const { data: storeDepartments } = useQuery({
  queryKey: ["store-departments-for-mapper", selectedStoreId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("departments")
      .select("id, name")  // Only fetches id and name
      .eq("store_id", selectedStoreId)
      .order("name");
    if (error) throw error;
    return data;
  },
  enabled: !!selectedStoreId,
});

// Updated query - include manager_id and manager profile name
const { data: storeDepartments } = useQuery({
  queryKey: ["store-departments-for-mapper", selectedStoreId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("departments")
      .select(`
        id, 
        name, 
        manager_id,
        manager:profiles!departments_manager_id_fkey(id, full_name)
      `)
      .eq("store_id", selectedStoreId)
      .order("name");
    if (error) throw error;
    return data;
  },
  enabled: !!selectedStoreId,
});
```

### 2. Add Auto-Mapping Effect for "All Repair Orders"
Add a new `useEffect` after the existing alias sync effect (~line 892):

```typescript
// Auto-map "All Repair Orders" to department manager
useEffect(() => {
  if (!selectedDepartmentId || !storeDepartments || userMappings.length === 0) return;
  
  // Find the selected department and its manager
  const selectedDept = storeDepartments.find(d => d.id === selectedDepartmentId);
  const managerId = selectedDept?.manager_id;
  const managerName = selectedDept?.manager?.full_name;
  
  if (!managerId || !managerName) return;
  
  // Check if "All Repair Orders" needs auto-mapping
  const allRepairOrdersMapping = userMappings.find(um => 
    /\ball\s+repair\s+orders?\b/i.test(um.advisorName)
  );
  
  // Only auto-map if not already assigned
  if (allRepairOrdersMapping && !allRepairOrdersMapping.userId) {
    setUserMappings(prev => prev.map(um => {
      if (/\ball\s+repair\s+orders?\b/i.test(um.advisorName)) {
        return {
          ...um,
          userId: managerId,
          matchedProfileName: managerName,
        };
      }
      return um;
    }));
  }
}, [selectedDepartmentId, storeDepartments, userMappings]);
```

### 3. Type Definition Update
Update the `storeDepartments` type to include manager info:

```typescript
interface DepartmentWithManager {
  id: string;
  name: string;
  manager_id: string | null;
  manager: { id: string; full_name: string } | null;
}
```

## File Changes
| File | Change |
|------|--------|
| `src/components/admin/scorecard-mapper/ScorecardVisualMapper.tsx` | Update department query and add auto-mapping effect |

## Behavior Summary
1. User selects store (e.g., "Steve Marshall Ford")
2. User selects department (e.g., "Service Department")
3. User uploads CSR Productivity Report
4. System detects "All Repair Orders" in the report
5. **NEW**: System automatically maps "All Repair Orders" to Sara (the department manager)
6. User can still override this mapping if needed

## Edge Cases Handled
- Department has no manager set: No auto-mapping occurs, user must manually select
- "All Repair Orders" already has a saved alias: Existing alias takes precedence (via the existing alias sync effect)
- User manually changes the mapping: The manual selection is preserved
