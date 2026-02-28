
## Goal
Make Blake Harrison, Sam Chen, and Riley Thompson always appear in the Celebrations card for the Growth Automotive demo store (`effbf1c8-8506-4734-bf1d-0bfaa54690a0`), regardless of what date it is.

## Problem
The DB function `get_upcoming_celebrations` calculates `days_until` based on real `CURRENT_DATE`. The anniversary `start_month` values are set to March, so once March 2026 passes, they fall outside the window and disappear permanently (even with 365 days ahead).

## Solution
In `Celebrations.tsx`, after fetching from the DB, **inject 3 hardcoded demo entries** when the current store is the Growth Automotive demo store. These entries always show as upcoming (fixed `daysUntil` of 1, 1, and 3), overriding or supplementing whatever the DB returns.

This keeps real stores working normally — only the demo store gets the pinned entries.

### Changes to `src/components/celebrations/Celebrations.tsx`

1. Define the demo store ID constant: `DEMO_STORE_ID = 'effbf1c8-8506-4734-bf1d-0bfaa54690a0'`

2. Define 3 hardcoded demo celebrations:
   - Blake Harrison — Anniversary — 5 years — "In 1 day"
   - Sam Chen — Anniversary — 7 years — "In 2 days"  
   - Riley Thompson — Birthday — "March 3" — "In 3 days"

3. After loading, if `currentStoreId === DEMO_STORE_ID`, replace results with the hardcoded entries instead of the DB results (so the display never changes).

Single file edit: `src/components/celebrations/Celebrations.tsx`
