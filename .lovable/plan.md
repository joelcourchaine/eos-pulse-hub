
## Root Cause

The `useEffect` on line 136 rebuilds the entire `mappings` array whenever `storeUsers` changes (it's in the deps array on line 172). This fires every time:
- A new user is created and `refetchUsers()` is called
- Any other trigger causes `storeUsers` to update

So when you map Technician A to User X, then create a new user for Technician B, the `refetchUsers()` call causes `storeUsers` to update, which triggers the `useEffect` to **reset all mappings back to their auto-detected defaults** — wiping out your manual selections.

## Fix

Two changes to `TechnicianImportPreviewDialog.tsx`:

### 1. Remove `storeUsers` from the `useEffect` dependency array

The effect should only run **once** when the dialog opens with fresh parse data. It should not re-run when `storeUsers` changes.

Change line 172 from:
```typescript
}, [open, parseResult.technicians, userAliases, storeUsers]);
```
to:
```typescript
}, [open, parseResult.technicians, userAliases]);
```

### 2. Use a "has initialized" guard so it only runs once per dialog open

Add a `hasInitialized` ref so even if `open` flips, we don't reset mappings that already have user selections:

```typescript
const hasInitialized = useRef(false);

useEffect(() => {
  if (!open) { hasInitialized.current = false; return; }
  if (hasInitialized.current) return; // don't re-run if already built
  if (!parseResult.technicians || !userAliases) return;
  
  hasInitialized.current = true;
  // ... build initialMappings using storeUsers (current value only, not reactive)
  // ...
  setMappings(initialMappings);
}, [open, parseResult.technicians, userAliases]);
```

This way:
- On dialog open: mappings initialize once with auto-matching
- After creating a new user: `storeUsers` refetches but mappings are **not reset**
- The new user's auto-selection still works because it uses `setMappings(prev => ...)` (a targeted update), not the full rebuild
