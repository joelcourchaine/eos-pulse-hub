
# Make the Right Rail the Right Edge of the Page

## Problem
The top navigation bar spans the full width and overlaps the right rail because it has a higher z-index (z-50 vs z-5). The user wants the nav bar to stop at the left edge of the rail, so the rail owns the entire right column from top to bottom.

## Approach
Constrain the header so it does not extend under the right rail. The sidebar width is `28rem` when expanded and roughly `10rem` when collapsed (icon mode). The header lives inside `SidebarInset`, which already accounts for the sidebar width automatically -- so this should mostly be handled already.

The real issue is that the sidebar starts at `top: 5.5rem` leaving a gap at the top where the nav bar background shows through. To make the rail "own" the right edge:

1. **Move the sidebar back to `top: 0` and `h-svh`** so it spans the full viewport height, including the area behind the nav bar.
2. **Raise the sidebar z-index above the nav bar** -- set it to `z-[51]` (nav is z-50) so nothing overlaps it.
3. **Add top padding to the sidebar content** equal to the nav bar height (~5.5rem) so the "My Routines" header and cadence items start visually below the nav bar, even though the dark background extends all the way up.

This way the dark navy background fills the entire right column from the very top of the viewport to the bottom, and the nav bar naturally ends at the rail's left edge visually.

## File Changes

### `src/components/routines/RoutineSidebar.tsx`
- Change `className` on `<Sidebar>`: replace `!top-[5.5rem] !h-[calc(100svh-5.5rem)] !z-[5]` with `!top-0 !h-svh !z-[51]`
- Add `pt-[5.5rem]` (top padding) to the `<SidebarContent>` wrapper so content starts below the nav bar height, while the dark background extends behind/above the nav area
