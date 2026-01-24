
# Enterprise Filter Hierarchy Restructuring

## Overview
Restructure the "Filter Stores" section to use a cascading hierarchy approach where each filter level narrows down the available options for subsequent filters.

## Current Structure
```
Tab: Brand → Group → Custom
- Each tab operates independently
- Selecting a tab shows all items of that type
- No cascading/narrowing between selections
```

## Proposed Structure
```
Tab: Group → Brand → Stores
- Group: First filter (shows all available groups)
- Brand: Second filter (shows only brands with stores in selected groups)
- Stores: Third filter (shows only stores matching selected groups AND brands)
```

## Implementation Details

### 1. UI Changes
- **Reorder tabs**: Change from `Brand | Group | Custom` to `Group | Brand | Stores`
- **Rename "Custom" to "Stores"**: The third tab will be labeled "Stores"
- **Update tab visibility for non-super-admins**: The Group tab will only show for super-admins (existing behavior, but now it's first)

### 2. Cascading Filter Logic

#### Available Brands (computed)
When groups are selected, the brand list will only show brands that have stores within those selected groups:
```typescript
const availableBrandsForFilter = useMemo(() => {
  if (filterMode !== 'brand') return availableBrands;
  if (selectedGroupIds.length === 0) return availableBrands;
  
  // Only show brands that have stores in the selected groups
  const brandIdsInSelectedGroups = new Set(
    stores
      .filter(s => selectedGroupIds.includes(s.group_id))
      .map(s => s.brand_id)
      .filter(Boolean)
  );
  return availableBrands.filter(b => brandIdsInSelectedGroups.has(b.id));
}, [availableBrands, stores, selectedGroupIds, filterMode]);
```

#### Available Stores (computed)
When groups and/or brands are selected, the stores list will show only matching stores:
```typescript
const availableStoresForFilter = useMemo(() => {
  if (!stores) return [];
  
  let filtered = [...stores];
  
  // Filter by selected groups (if any)
  if (selectedGroupIds.length > 0) {
    filtered = filtered.filter(s => selectedGroupIds.includes(s.group_id));
  }
  
  // Filter by selected brands (if any)
  if (selectedBrandIds.length > 0) {
    filtered = filtered.filter(s => selectedBrandIds.includes(s.brand_id));
  }
  
  return filtered;
}, [stores, selectedGroupIds, selectedBrandIds]);
```

### 3. Filter Mode Behavior Updates
Update how `filteredStores` responds to the new hierarchy:

```typescript
const filteredStores = useMemo(() => {
  if (!stores) return [];
  
  let baseStores = [...stores];
  
  // Always apply group filter if groups are selected (cascading down)
  if (selectedGroupIds.length > 0) {
    baseStores = baseStores.filter(s => selectedGroupIds.includes(s.group_id));
  }
  
  switch (filterMode) {
    case "group":
      return baseStores; // Return all stores in selected groups
      
    case "brand":
      if (selectedBrandIds.length === 0) return [];
      return baseStores.filter(s => selectedBrandIds.includes(s.brand_id));
      
    case "custom": // Now called "stores"
      return baseStores.filter(s => selectedStoreIds.includes(s.id));
      
    default:
      return [];
  }
}, [stores, filterMode, selectedGroupIds, selectedBrandIds, selectedStoreIds]);
```

### 4. Tab Order Update
```typescript
<TabsList className={`grid w-full ${isSuperAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
  {isSuperAdmin && <TabsTrigger value="group">Group</TabsTrigger>}
  <TabsTrigger value="brand">Brand</TabsTrigger>
  <TabsTrigger value="custom">Stores</TabsTrigger>
</TabsList>
```

### 5. Store Selection Display Enhancement
When in "Stores" tab, show the group and brand info for each store to help with identification:
```typescript
{store.name}
{store.brands && <span>({brand.name})</span>}
{store.store_groups && <span>• {group.name}</span>}
```

## Files to Modify
- `src/pages/Enterprise.tsx`: All filter restructuring changes

## Technical Notes
- Session storage keys remain unchanged (`selectedGroupIds`, `selectedBrandIds`, `selectedStoreIds`)
- Saved filter functionality continues to work as before
- RLS policies for non-super-admins remain unaffected

## User Experience Flow
1. Super-admin selects a Group (e.g., "Murray Auto Group")
2. Brand tab now only shows brands that have stores within Murray Auto Group
3. User selects a Brand (e.g., "Stellantis")
4. Stores tab now only shows Stellantis stores within Murray Auto Group
5. User can optionally select specific stores from that filtered list
