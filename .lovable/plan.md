

## Fix Routine Sidebar Vertical Positioning

The sidebar is currently positioned with `top: 4rem` (64px), but the dashboard header is taller than that - approximately 80-88px. This causes the first cadence icon to be hidden behind the header buttons.

---

### The Problem

```text
Current:
┌─────────────────────────────────────────────────┬──────┐
│  Logo  │ Store Dropdown │  Admin │ User Icon    │ ■ ←── Hidden behind header!
├─────────────────────────────────────────────────┼──────┤
│                                                 │ Daily│
│                                                 │ Week │
```

The header has:
- `py-4` = 16px top + 16px bottom padding
- Logo height = 40px (`h-10`)
- Total ≈ 72-80px+ (varies when buttons wrap)

Current sidebar: `top: 4rem` = 64px (too high)

---

### The Fix

Increase the sidebar's top offset from `4rem` (64px) to `5rem` (80px) to clear the header:

**File:** `src/components/routines/RoutineSidebar.tsx`

```tsx
// Change from:
className="border-l !top-16 !h-[calc(100svh-4rem)]"

// Change to:
className="border-l !top-20 !h-[calc(100svh-5rem)]"
```

| Property | Before | After |
|----------|--------|-------|
| `top` | `!top-16` (64px) | `!top-20` (80px) |
| `height` | `100svh - 4rem` | `100svh - 5rem` |

This pushes the sidebar down by an additional 16px, ensuring it starts cleanly below the header buttons and the first "Daily" icon is fully visible.

---

### Visual Result

```text
After fix:
┌─────────────────────────────────────────────────┐
│  Logo  │ Store Dropdown │  Admin │ User Icon    │
├─────────────────────────────────────────────────┼──────┐
│                                                 │ Daily│ ← Now visible!
│                                                 │ Week │
│                                                 │ Month│
```

---

### Files Changed

| File | Change |
|------|--------|
| `src/components/routines/RoutineSidebar.tsx` | Update `top-16` → `top-20` and height calc from `4rem` → `5rem` |

