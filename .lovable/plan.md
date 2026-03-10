
## The Fix

**File:** `src/components/routines/AddRoutineItemInline.tsx` — line 131

The `Input` className currently has:
```
bg-white/10 text-white placeholder:text-white/40 border-white/20
```

This was styled for a dark/navy context, but the routine card in `RoutineChecklist` renders on a **white card** background (as seen in the screenshot). The white text is invisible against the white card.

The fix is to remove the hardcoded white color overrides and let the standard design-system tokens take over (`bg-background`, `text-foreground`, etc.), which already handle both light and dark modes correctly via CSS variables.

**Change:**
```tsx
// Before
className="h-8 text-sm bg-white/10 text-white placeholder:text-white/40 border-white/20"

// After
className="h-8 text-sm"
```

That's the entire change — one line in one file.
