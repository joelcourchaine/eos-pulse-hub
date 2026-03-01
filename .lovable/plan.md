
## Root Cause

The import log confirms `metrics_imported: {}` — no data was written for anyone, despite the import showing "success". Bill Vanderbos has KPI definitions but zero entries.

The issue: **`importMutation` captures a stale closure over `mappings`**. When the user creates a new user (Bill) and then clicks Import, React's `useMutation` `mutationFn` closes over the `mappings` state at the time the mutation was *defined*, not when it's *called*. This means Bill's `selectedUserId` is still `null` in the function's view, even though the UI shows him as mapped.

Additionally, the import log's `metrics_imported` field is always empty `{}` — it's never populated in the code — so there's no visibility into what actually got written.

## Fix Plan

### 1. Fix stale closure on `mappings` in `importMutation`

**`src/components/scorecard/TechnicianImportPreviewDialog.tsx`**

Use a `useRef` to always hold the latest `mappings` value, and read from the ref inside `mutationFn`:

```typescript
const mappingsRef = useRef(mappings);
useEffect(() => { mappingsRef.current = mappings; }, [mappings]);

// In importMutation mutationFn:
const currentMappings = mappingsRef.current; // always fresh
for (let i = 0; i < currentMappings.length; i++) {
  const { tech, selectedUserId } = currentMappings[i];
  ...
}
```

### 2. Populate `metrics_imported` in the import log

Currently logged as `{}`. Change it to record actual KPI IDs written per user so the admin logs show real data.

### 3. Keep the fix minimal and safe

Only change `TechnicianImportPreviewDialog.tsx` — add the ref, wire it up, use `mappingsRef.current` inside `mutationFn`.
