
## Two Problems to Fix

### Problem 1: Duplicate Michael Abrahamsz entries in the list
The parser has deduplication logic, but 4 entries are still showing. The dedup uses `tech.rawName.toLowerCase().trim()` as the key. If the names differ by even a single whitespace or invisible character, they won't deduplicate. The fix: **also deduplicate in the UI layer** inside `TechnicianImportPreviewDialog`, after `parseResult.technicians` is received, using a `Map` keyed on normalized name — this is a safety net that catches any edge case the parser misses.

### Problem 2: Allow creating a user with a name that already exists
When the user clicks "Create Technician", there's no check against `storeUsers`. If "Michael Abrahamsz" already exists in the store, we should:
- Show a warning inline and block submission
- Optionally auto-select the existing user instead

## Changes — one file only: `TechnicianImportPreviewDialog.tsx`

### 1. Deduplicate `parseResult.technicians` in the `useEffect` that builds `mappings` (lines 136–164)

Before building the mapping array, deduplicate technicians by normalized name:

```typescript
// Deduplicate technicians by normalized name (safety net over parser)
const seen = new Map<string, TechnicianData>();
for (const tech of parseResult.technicians) {
  const key = tech.rawName.toLowerCase().replace(/\s+/g, " ").trim();
  if (!seen.has(key)) seen.set(key, tech);
}
const uniqueTechs = Array.from(seen.values());
```

Then use `uniqueTechs` instead of `parseResult.technicians` when building `initialMappings`.

### 2. Validate name uniqueness before creating user (around line 560)

In the "Create Technician" button's `onClick`, check if the typed name already exists in `storeUsers`:

```typescript
// Before calling createUserMutation.mutate(...)
const nameExists = storeUsers?.some(
  (u) => u.full_name?.toLowerCase().trim() === newUserForm.fullName.toLowerCase().trim()
);
if (nameExists) {
  toast({ title: "User already exists", description: `${newUserForm.fullName} is already a user at this store.`, variant: "destructive" });
  return;
}
```

Also add a real-time warning label beneath the Full Name input that appears as the user types, showing "This name already exists" in red if a match is found — so they see it before hitting the button.
