

# Fix Import Failed: RLS Policy Blocking Alias Creation

## Root Cause

The postgres logs show: **"new row violates row-level security policy for table scorecard_user_aliases"**

Daniel Park's role is `department_manager`. The current RLS policies on `scorecard_user_aliases` only allow writes for:
- `super_admin`
- `store_gm` (matching store_id)

Department managers are not permitted to insert aliases, so when the import tries to save the new "DANIEL" alias mapping, it throws an RLS error that aborts the entire import.

## Solution

Add an RLS policy allowing department managers (and fixed ops managers) to manage aliases for their own store. These are the users who actually perform scorecard imports day-to-day.

## Technical Details

### Database Migration

Add a new RLS policy on `scorecard_user_aliases`:

```sql
CREATE POLICY "Department managers can manage aliases for their store"
ON public.scorecard_user_aliases
FOR ALL
USING (
  store_id = (SELECT store_id FROM public.profiles WHERE id = auth.uid())
  AND public.is_manager_or_above(auth.uid())
)
WITH CHECK (
  store_id = (SELECT store_id FROM public.profiles WHERE id = auth.uid())
  AND public.is_manager_or_above(auth.uid())
);
```

The existing `is_manager_or_above` function already covers `department_manager`, `fixed_ops_manager`, `store_gm`, and `super_admin` -- so this single policy replaces the need for the existing `store_gm` policy (though we can keep it for safety).

### Files Changed
- **Database migration only** -- no code changes needed

