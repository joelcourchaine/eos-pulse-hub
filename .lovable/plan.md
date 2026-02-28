
## What's happening

Line 56–60 already handles the demo store (`DEMO_STORE_ID = "effbf1c8-8506-4734-bf1d-0bfaa54690a0"`) with hardcoded `DEMO_CELEBRATIONS` — this is the "Growth Automotive" test store for explainer videos.

The problem is the real store query still uses `p_days_ahead: 365`, which floods North Island Nissan (and any real store) with a full year of events.

## Fix — `src/components/celebrations/Celebrations.tsx`

**Line 38**: Change `p_days_ahead: 365` → `p_days_ahead: 30`

The demo store path (lines 56–58) stays untouched — it will continue showing the 3 hardcoded demo celebrations regardless of date. Only real stores will now be filtered to 30 days ahead.
