
## Root Cause — Two distinct problems

### Problem 1: Orphan duplicate profiles in the database
Michael Abrahamsz has **4 profiles** (IDs: `d1db405c`, `34c0d739`, `5fe36bb8`, `bd0f8f56`). Three are orphan duplicates with no KPI definitions, created during earlier failed import attempts before the de-duplication fix. These orphan profiles show up in the scorecard's user list causing empty duplicate rows.

### Problem 2: Bill Vanderbos has a stale "Closed Hours" KPI
He has both `Closed Hours` (id: `2eb30f65`) and `Open and Closed Hours` — the old KPI from a previous import before the label was corrected. This causes his row to appear twice.

---

## Fix — Two parts

### Part 1: Database cleanup (direct data operations)

**Delete orphan Michael Abrahamsz profiles** (the 3 duplicates, keeping the oldest `d1db405c`):
```sql
DELETE FROM profiles 
WHERE id IN (
  '34c0d739-4feb-46d6-b425-d55615610c58',
  '5fe36bb8-d8be-4d9d-be57-1b54a9e9cf72',
  'bd0f8f56-e842-4d6a-bce2-521b6670ddf2'
);
```

**Delete the stale "Closed Hours" KPI for Bill Vanderbos** (id: `2eb30f65`):
```sql
DELETE FROM kpi_definitions WHERE id = '2eb30f65-bbd5-4f8b-9d39-a77173a55981';
```

### Part 2: Code fix — prevent future orphan profile creation

The `createUserMutation` check added in the last fix queries `profiles` by `full_name` and `store_id`, but the auth user deletion (if the orphan auth.users records still exist) could still cause issues. The real issue is the check was added AFTER the `auth.users` user was already being created — so if the profile lookup returned nothing (because the profile hadn't synced yet via trigger), it created a new one anyway.

The fix is to make the lookup also check `scorecard_user_aliases` so that if a technician was previously imported and aliased, we reuse that user ID without hitting the `profiles` table timing issue:

In `TechnicianImportPreviewDialog.tsx`, in `createUserMutation`, add a fallback alias check before the profile check:
```typescript
// 1. Check aliases first (most reliable — set at end of successful import)
const { data: alias } = await supabase
  .from("scorecard_user_aliases")
  .select("user_id")
  .eq("store_id", storeId)
  .eq("alias_name", fullName)
  .maybeSingle();
if (alias) return { user: { id: alias.user_id } };

// 2. Then check profiles
const { data: existingProfile } = await supabase
  .from("profiles")
  .select("id")
  .eq("store_id", storeId)
  .eq("full_name", fullName)
  .maybeSingle();
if (existingProfile) return { user: { id: existingProfile.id } };

// 3. Only then create new user
```

This two-part fix: cleans up the database now, and prevents the issue from recurring.
