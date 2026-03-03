
## Fix: Profiles not loading in "Create To-Do" from Top 10

**Root cause**: `Top10ItemRow` passes `profiles={[]}` (hardcoded empty array) to `TodoManagementDialog`, so the assignee dropdown is always empty. The dialog itself doesn't fetch profiles — it relies on the parent to supply them.

**Fix**: Load profiles lazily inside `Top10ItemRow` when the dialog opens, using the same `get_profiles_basic` RPC pattern used by `TodosPanel`.

### Changes — `src/components/top-10/Top10ItemRow.tsx` only

1. Add `profiles` state: `const [profiles, setProfiles] = useState<Profile[]>([])`
2. Add a `loadProfiles` async function that calls `supabase.rpc("get_profiles_basic")` and maps the result to `{ id, full_name }[]`
3. Update `handleCreateTodo` to call `loadProfiles()` before opening the dialog (or pass it as `onDialogOpen`)
4. Replace `profiles={[]}` with `profiles={profiles}` on the `TodoManagementDialog`

**No changes needed to `TodoManagementDialog`** — it already accepts and uses the `profiles` prop correctly, and already supports `onDialogOpen` callback for lazy loading.

### Files changed
- **`src/components/top-10/Top10ItemRow.tsx`** only
