
## Show name above the LeafPill for vacant positions with a name

**What:** When a vacant position has a non-default name (i.e. not "Vacant"), display that name as a small label just above the pill circle, similar to how `showNames` works for active members but positioned outside/above the circle rather than inside it.

**Where:** `LeafPill` component in `src/components/team/ReverseOrgChart.tsx`, lines 369–401.

**How:** Wrap the existing `<Tooltip>` in a `<div className="flex flex-col items-center">`. When `isVacant` and `member.name !== "Vacant"`, render a small text label above the pill:

```text
  ┌─────────────────────────┐
  │  [name label, 9px]      │  ← new, only when vacant + has name
  │  [? pill circle]        │
  └─────────────────────────┘
```

The label should be:
- ~9px font, amber color `hsl(38 70% 35%)`, truncated at ~8 chars, `whitespace-nowrap`
- Positioned using `flex-col items-center gap-0.5`

The outer wrapper div needs `flex-col items-center` so the pill + label stack vertically without affecting the pill's own dimensions (the connector line refs point to the pill div, not the wrapper).

**Single file change:** `src/components/team/ReverseOrgChart.tsx`, ~lines 369–401.
