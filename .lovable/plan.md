
## The Problem

The "Failed to load to-dos" error in `TodosPanel.tsx` has two likely causes working together:

**1. Hardcoded realtime channel name collision**
`TodosPanel.tsx` always uses `'todos-realtime'` as the Supabase channel name. If the component re-renders (department switch, page navigation), a new subscription is created while the old one isn't fully cleaned up yet. This causes channel conflicts and failed queries.

**2. `setTodos([])` before async fetch creates a visible flicker/error loop**
The code clears todos immediately (`setTodos([])`) before awaiting the fetch. If the fetch then fails (due to a brief auth token refresh or channel conflict), the error toast fires AND todos stay empty — which looks broken.

**3. Missing auth session check in `loadTodos`**
The `loadTodos` in `TodosPanel.tsx` makes no check that the user is authenticated before querying. If the Supabase client is mid-token-refresh, the query gets fired without a valid token → RLS rejects it → error toast.

## The Fix

**In `src/components/todos/TodosPanel.tsx`:**

1. **Make the channel name unique** using `departmentId` so it doesn't collide across re-renders:
   ```typescript
   .channel(`todos-realtime-${departmentId}`)
   ```

2. **Add auth guard to `loadTodos`** — check session exists before querying:
   ```typescript
   const { data: { session } } = await supabase.auth.getSession();
   if (!session) return;
   ```

3. **Remove `setTodos([])` before the fetch** — only update state on success, keeping the previous data visible while loading. This prevents the jarring empty→error flash.

4. **Add a debounce to the realtime callback** — use a ref-based debounce (100ms) so rapid-fire realtime events don't stack up multiple simultaneous `loadTodos` calls:
   ```typescript
   const realtimeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
   // In the channel callback:
   if (realtimeTimeoutRef.current) clearTimeout(realtimeTimeoutRef.current);
   realtimeTimeoutRef.current = setTimeout(() => loadTodos(), 100);
   ```

## Files Changed

| File | Change |
|---|---|
| `src/components/todos/TodosPanel.tsx` | Unique channel name, auth guard, remove premature clear, debounce realtime |
