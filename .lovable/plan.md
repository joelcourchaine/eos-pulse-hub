
# Security Migration: Restrict Announcements to Authenticated Users

## Overview
Apply a security migration to revoke anonymous access to the announcements tables and ensure all RLS policies explicitly target the `authenticated` role only.

---

## Changes

### Database Migration

The following SQL will be executed:

1. **Revoke anonymous access** from both `announcements` and `announcement_dismissals` tables
2. **Recreate RLS policies** with explicit `TO authenticated` clauses

| Table | Policy | Access |
|-------|--------|--------|
| `announcements` | Users can view active announcements for their groups | SELECT for authenticated users |
| `announcements` | Super admins can manage all announcements | ALL for super_admin role |
| `announcement_dismissals` | Users can view their own dismissals | SELECT for authenticated users |
| `announcement_dismissals` | Users can dismiss announcements | INSERT for authenticated users |
| `announcement_dismissals` | Super admins can manage all announcement dismissals | ALL for super_admin role |

---

## Technical Details

The migration:
- Uses `REVOKE ALL ... FROM anon` to remove any grants to the anonymous role
- Drops existing policies and recreates them with `TO authenticated` to ensure only logged-in users can interact with the data
- Relies on existing helper functions (`has_role`, `get_user_store_group`) for authorization checks

---

## Implementation

I will use the database migration tool to apply this SQL in a single transaction.
