
## Problem
The `celebrations` section pulls from `profiles` + `profile_sensitive_data`. Growth Automotive's store (ID: `effbf1c8-8506-4734-bf1d-0bfaa54690a0`) has 4 test user profiles, none with birthday/anniversary data set.

The org chart `team_members` are separate from auth users — they're display-only records and aren't linked to `profiles`.

## Plan
Pick 3 existing Growth Automotive profiles and:
1. Update their `full_name` to match 3 org chart people (Blake Harrison, Riley Thompson, Sam Chen)
2. Insert `profile_sensitive_data` rows for those 3 with celebration dates that will appear soon:

| Person | Type | Date | Days Until |
|--------|------|------|------------|
| Blake Harrison | Anniversary | March 2026 (start_year = 2021) | ~1 day away |
| Sam Chen | Anniversary | March 2026 (start_year = 2019) | ~1 day away |
| Riley Thompson | Birthday | March 3 | ~3 days away |

This way all 3 show up in the Celebrations card immediately.

**Also fix** the 30-day window bug in `Celebrations.tsx` → change to 365 days, slice to 8 results.

### Operations
1. UPDATE 3 profiles: set `full_name` to Blake Harrison, Sam Chen, Riley Thompson
2. UPSERT 3 `profile_sensitive_data` rows with the celebration dates
3. Edit `src/components/celebrations/Celebrations.tsx`: `p_days_ahead: 30` → `365`, add `.slice(0, 8)`
