
## Fix: Move Activity Tracking Out of Dashboard

### Problem
The `last_active_at` update only fires when a user visits `/dashboard` (inside `fetchProfile` in `Dashboard.tsx`). If a user navigates directly to `/my-tasks`, `/enterprise`, or any other route, their activity is never recorded. This explains why Craig's date is stale -- he may be using the app but not landing on the Dashboard page each time.

### Solution
Move the `last_active_at` update into a shared hook that runs on any authenticated page load, not just the Dashboard.

### Changes

**New file: `src/hooks/useTrackActivity.ts`**
- Create a hook that listens for auth state, and on mount (when a session exists), updates `last_active_at` on the user's profile.
- Throttle it so it only fires once per session/page-load (not on every re-render).

**File: `src/App.tsx`**
- Call `useTrackActivity()` inside the `App` component so it runs globally on every page.

**File: `src/pages/Dashboard.tsx`**
- Remove the `last_active_at` update from `fetchProfile` (lines 411-418) since it's now handled globally.

### Why this works
By placing the tracking in `App.tsx`, every authenticated page visit -- whether it's `/dashboard`, `/my-tasks`, `/enterprise`, or anything else -- will update the user's `last_active_at` timestamp. Craig (and anyone else) will show accurate activity dates regardless of which page they use.
