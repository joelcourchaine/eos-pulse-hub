
## The Core Problem

Looking at the screenshot, the chart is overwhelmingly wide because ALL nodes at the same depth level are placed in a single horizontal row. A large service department with ~30 technicians, 8 advisors, 3 detailers, etc. forces a massive row that's 1500px+ wide.

The fundamental issue: **flat horizontal rows scale with total headcount, not with screen width.**

## The Best Solution: Grouped Role Rows with Collapsible Subtrees

Instead of plotting every individual node at pixel-exact absolute positions, we restructure the layout idea:

**Each "reporting group" is rendered as a cluster**, and the leaf row is replaced with **compact role chips showing name + position** grouped under their manager. This is the most space-efficient org chart pattern used in large service departments.

### Proposed Layout: "Manager → Grouped Reports" Cards

```text
Current (broken for large teams):
Row 1: [Tech][Tech][Tech][Tech][Tech][Tech][Tech][Tech][Tech][Tech][Tech]...  ← 30 nodes wide
Row 2:    [Foreman A]        [Foreman B]        [Foreman C]
Row 3:              [Craig - Service Manager]

New: Collapsible group cards
┌─────────────────────────────────────────────────────────┐
│ Craig Heintzman - Service Manager                       │
│  ├─ [Amanda M - Advisor] [Cory M - Advisor] [Jeff M...] │
│  ├─ Foreman: Garret Willms ───────────────────────────  │
│  │    └─ [Tech][Tech][Tech][Tech][Tech] (collapsed: 9)  │
│  └─ Foreman: Denver Bugera ──────────────────────────── │
│       └─ [Det][Det][Det]                                │
└─────────────────────────────────────────────────────────┘
```

Actually, a more practical incremental fix preserving the existing layout engine but making it much more compact:

### Practical Plan: 3 Key Changes

**1. Compact "pill" node style for leaf nodes (biggest win)**
- Leaf nodes (technicians, detailers, cashiers with no reports) render as tiny pill badges: just name abbreviated to first+last initial, colored by role
- e.g., `[GB]` `[TW]` `[MK]` instead of full name boxes
- On hover → tooltip shows full name and position
- This collapses the widest row from ~2000px to ~400px

**2. Auto-fit zoom on mount**
- On mount, calculate the actual chart width vs container width and auto-set zoom so it fits
- Currently zoom defaults to 1 (100%) regardless of how wide the chart is

**3. Widen the available width calculation**
- Change `AVAILABLE_WIDTH` from 1200 to use `window.innerWidth - 100` so `nodeScale` reflects the actual screen size, not a hardcoded assumption

### Files Changed
- `src/components/team/ReverseOrgChart.tsx`

### Detailed Implementation

**Leaf pill nodes:**
- Detect `node.children.length === 0` (leaf)
- Render as a small rounded pill: `w-8 h-8` circle showing initials, colored by role
- When `showNames` is true: render as compact `px-2 py-1` pill with abbreviated name (first name only, max 8 chars truncated)
- Full name + position shown in a tooltip on hover
- This is the biggest win — technicians especially are always leaf nodes

**Auto-zoom on mount:**
- After layout is computed, `useEffect` reads `containerRef.current.offsetWidth` and computes `fitZoom = containerWidth / (totalWidth * NODE_SLOT_WIDTH * nodeScale)`
- Clamps between 0.25 and 1.0
- Sets as initial zoom

**Node slot width reduction:**
- Change `NODE_SLOT_WIDTH` from 140 to 90 for leaf nodes, 130 for non-leaf
- Or simply reduce the base to 100 and let compact pills benefit from the tighter spacing

The combination of compact leaf pills + auto-fit zoom should make even a 50-person service department fit in a single viewport with all structure visible.
