
## Auto-Refresh on Extended Inactivity

This plan adds a visibility change handler that automatically refreshes the application when a user returns after being away for more than 2 hours. This is particularly important for PWA users who may leave the app installed and open for extended periods.

### What This Solves

- Stale data issues when users return to the app after extended periods
- Service worker cache inconsistencies in the PWA
- Session token staleness that could cause API failures
- Users seeing outdated scorecard/financial data after leaving the app open overnight

### Implementation

**1. Create a reusable hook** (`src/hooks/useAutoRefreshOnReturn.ts`)
   - Encapsulates the visibility change logic in a clean, testable hook
   - Configurable timeout threshold (default: 2 hours)
   - Tracks when the user last had the tab active
   - Triggers `window.location.reload()` when returning after the threshold

**2. Add the hook to App.tsx**
   - Place it at the app root level so it works across all routes
   - This ensures the refresh behavior is consistent regardless of which page the user is on

### Technical Details

```text
┌─────────────────────────────────────────────────────────────┐
│                     User leaves tab                          │
│                           │                                  │
│                           ▼                                  │
│              Record lastActive = Date.now()                  │
│                           │                                  │
│                           ▼                                  │
│                  User returns to tab                         │
│                           │                                  │
│                           ▼                                  │
│         Calculate inactiveTime = now - lastActive            │
│                           │                                  │
│              ┌────────────┴────────────┐                     │
│              │                         │                     │
│     inactiveTime > 2hrs        inactiveTime ≤ 2hrs          │
│              │                         │                     │
│              ▼                         ▼                     │
│     window.location.reload()      No action                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Hook Implementation:**
- Uses `useEffect` with `visibilitychange` event listener
- Stores `lastActive` timestamp in a ref to persist across renders
- Only triggers reload when `document.hidden` changes from `true` to `false` (returning to tab)
- 2-hour threshold (7,200,000 ms) is reasonable for catching stale sessions without being too aggressive

**Files to Create/Modify:**
1. **Create**: `src/hooks/useAutoRefreshOnReturn.ts` - New reusable hook
2. **Modify**: `src/App.tsx` - Add hook usage at app root level
