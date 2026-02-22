

# Unify Right Rail Color to Match Scorecard Dark Navy

## What's Changing
The right rail sidebar currently uses a different shade of dark navy (`hsl(217, 91%, 20%)`) than the scorecard's quarter tabs and summary strip (`hsl(222, 47%, 16%)`). This update will make the right rail match the scorecard's darker, more muted navy color for visual consistency.

## File Changes

### `src/components/routines/RoutineSidebar.tsx`

Update the CSS custom properties on the `<Sidebar>` component and the ScrollArea background to use the scorecard's navy color:

- **Line 351**: Change `--sidebar-background` from `217 91% 20%` to `222 47% 16%`
- **Line 353**: Change `--sidebar-accent` from `217 91% 28%` to `222 47% 24%` (proportionally adjusted for hover/active states)
- **Line 357**: Change `--sidebar-primary-foreground` from `217 91% 20%` to `222 47% 16%` (used for inverted text on active buttons)
- **Line 442**: Change `bg-[hsl(217,91%,24%)]` to `bg-[hsl(222,47%,16%)]` on the ScrollArea so the checklist area matches

These four changes ensure every part of the right rail uses the same dark navy as the scorecard header.

