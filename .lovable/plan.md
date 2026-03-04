
## Changes to the bottom stats bar

**What the user wants:**
1. Restore vacant position names (remove the `activePositions` filter — show ALL vacant position labels, not just those matching active roles)
2. Make the card smaller overall
3. Make it responsive/shrinkable on smaller screens

**Current issues:**
- Line 169–170: `vacantPositions` filters to only show positions where an active member exists in the same role. User wants ALL vacant position labels shown.
- The card uses `px-8 py-4` and `text-5xl` — too large
- `fixed bottom-6 left-1/2 -translate-x-1/2` with `overflow-hidden` — no responsive width handling; could overflow on small screens

**Changes to `src/pages/MyTeam.tsx` lines 169–194:**

1. Line 170: Remove the `activePositions.has(m.position)` filter — show all vacant positions:
```ts
const vacantPositions = [...new Set(vacantMembers.map(m => POSITION_LABEL[m.position] || m.position))];
```

2. Shrink the card:
- `px-8 py-4` → `px-4 py-3`
- `text-5xl` → `text-3xl`  
- `text-xs` labels → keep `text-xs`
- `rounded-2xl` → `rounded-xl`
- `shadow-xl` → `shadow-lg`

3. Responsive: add `max-w-[90vw]` and `flex-wrap` so it shrinks and wraps on small screens. Position with `bottom-4` and keep `left-1/2 -translate-x-1/2`.

Single file: `src/pages/MyTeam.tsx`, lines 169–194.
