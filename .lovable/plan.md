

# Restyle Right Rail to Match Dark Navy Design System

## Overview
Transform the right sidebar from its current white/light theme to the dark navy design used in the top bar and summary strip, creating visual cohesion across the entire page.

## Changes (single file: `src/components/routines/RoutineSidebar.tsx`)

### 1. Dark navy background on the Sidebar container
Override the sidebar's CSS variables inline to use the primary dark navy for its background and white/light for text. This avoids modifying the shared sidebar component or global CSS. The `border-l` class will be replaced with a subtle dark divider using a semi-transparent white border.

### 2. Restyle the header ("My Routines")
- Make the label uppercase, smaller, with letter-spacing (tracking-widest) and muted opacity -- matching the summary strip label style.
- Icon color changes to white/light instead of `text-primary`.
- Remove the hard `border-b` and replace with a subtle semi-transparent divider.

### 3. Style active cadence menu item as a filled pill
- The active `SidebarMenuButton` gets a solid white background with dark navy text (matching the active pill style on the scorecard toggle bar).
- Non-active items get white/light text with a subtle hover state.
- Override the default sidebar accent colors inline.

### 4. Restyle section labels ("My Processes", "My Resources", "My Team")
- Change from `font-semibold text-sm` to uppercase, smaller (`text-[10px]`), with `tracking-widest` and reduced opacity -- consistent with the summary strip labels.
- The separator line between cadence items and nav links becomes a semi-transparent white line.

### 5. Consistent icon styling
- Remove `text-primary` from nav link icons (Workflow, BookOpen, Users) so they inherit the white/light foreground color.
- Keep icon sizes consistent at `h-4 w-4` to match cadence icons.

### 6. Expanded content area (checklists)
- The scrollable checklist area gets a slightly lighter dark background so the cards/items remain readable.
- Period label and muted text use light colors with reduced opacity.

## Technical Approach
All changes are CSS class overrides on the existing components -- no structural or behavioral changes. The sidebar component's CSS variable system (`--sidebar-background`, `--sidebar-foreground`, etc.) will be overridden at the Sidebar level via inline style, which cascades to all child components automatically.

## Files Changed
- `src/components/routines/RoutineSidebar.tsx` -- class and style overrides only
