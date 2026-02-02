
# Fix Resource Tag Search

## Problem
When you add a tag like "non-negotiable" to a resource, searching for that term returns 0 results because the current search only queries:
- `title`
- `description`  
- `searchable_content`

Tags are stored as a text array (`tags text[]`) and are not included in the search.

## Solution
Add tag searching to the resource query by including the `tags` column in the search filter. For PostgreSQL text arrays, we'll convert the array to a string for partial matching using a custom approach.

## Technical Implementation

### File: `src/pages/Resources.tsx`

**Current search logic (line 87-89):**
```typescript
query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,searchable_content.ilike.%${searchQuery}%`);
```

**Updated search logic:**
Since Supabase/PostgREST doesn't support `ilike` directly on array columns, we have two options:

**Option A (Recommended):** Fetch all resources and filter client-side for tags
- Slightly less efficient but simplest to implement
- Search tags in JavaScript after fetching results that match other criteria

**Option B:** Create a database function or modify how data is saved
- Add tags to `searchable_content` when saving a resource
- Requires updating the ResourceManagementDialog

### Recommended Approach: Hybrid Search
1. Keep the existing database query for title/description/searchable_content
2. If no results found OR to ensure tag matches, also do client-side filtering on tags
3. Combine results

**Changes:**
```typescript
// After database query, also filter for tag matches
if (searchQuery) {
  const lowerQuery = searchQuery.toLowerCase();
  // Filter to include resources where tags contain the search term
  const filtered = data.filter(resource => 
    resource.title?.toLowerCase().includes(lowerQuery) ||
    resource.description?.toLowerCase().includes(lowerQuery) ||
    resource.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}
```

## Result
After this fix, searching "non-negotiable" will find any resource that has:
- "non-negotiable" in the title
- "non-negotiable" in the description
- "non-negotiable" as a tag (partial match supported)
