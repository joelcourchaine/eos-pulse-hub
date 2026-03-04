
## Make Vacant Positions More Visually Obvious

Currently, vacant positions have:
- A dashed border
- 0.7 opacity
- A small "Vacant" italic label (only on larger nodes, very subtle)

**Proposed improvements:**

### OrgNode (larger cards)
- Add a yellow/amber warning stripe or tint overlay
- Replace the subtle italic "Vacant" text with a more prominent amber badge
- Use a stronger amber dashed border instead of the position color

### LeafPill (small circles)
- Add a `?` or `—` character instead of initials to indicate no person assigned
- Use a desaturated/greyed background with amber dashed border instead of the position color
- Remove the name-based initials so it's clearly "no one here"

### Specific changes to `ReverseOrgChart.tsx`:

**LeafPill** (~line 377-386):
- When `isVacant`: use a grey/washed-out background (`hsl(45 20% 88%)` light or `hsl(45 15% 25%)` dark)
- Border: amber dashed `2px dashed hsl(38 92% 50%)`
- Show `?` instead of initials
- Opacity stays at 1 (not dimmed) since the amber signals it clearly enough

**OrgNode** (~line 477-508):
- When `isVacant`: amber dashed border `2px dashed hsl(38 92% 50%)`
- Background: washed grey instead of position color
- The "Vacant" label: render as a small amber pill/badge (`bg amber, text dark, rounded-full px-1.5`) rather than grey italic text

No database or schema changes needed. Single file edit: `src/components/team/ReverseOrgChart.tsx`.
