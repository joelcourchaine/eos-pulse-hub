

# Ensure Main Content Stops at the Right Rail's Left Edge

## Problem
The main content area can visually extend behind or overlap with the right rail sidebar. Even though the layout uses a flex container with a spacer div, the content doesn't always respect the rail boundary -- particularly with wide content like the scorecard grid or cards with `max-w-[1600px]`.

## Root Cause
The shadcn Sidebar component already uses the correct pattern: a spacer div reserves the rail's width in the flex flow, while the actual sidebar is `position: fixed`. The `SidebarInset` (flex-1) should fill only the remaining space. However, two issues may cause visual overlap:

1. The `<main>` inside `SidebarInset` has `max-w-[1600px]` which, on wide screens, centers content and could visually clash with the rail boundary.
2. Horizontally-scrollable children (like the scorecard grid) may overflow beyond the `SidebarInset` bounds.

## Solution
Add `overflow-x-hidden` (or `overflow-hidden`) to the `SidebarInset` wrapper so that no child content can bleed past its right edge into the rail. Also remove the hardcoded `max-w-[1600px]` on `<main>` so content fills the available space naturally rather than centering at a fixed max width that doesn't account for the rail.

## File Changes

### `src/pages/Dashboard.tsx`
- On the `SidebarInset`, add `overflow-hidden` to its className to hard-clip any content at the rail boundary.
- Change the `<main>` element's `max-w-[1600px]` to `max-w-full` so it fills the available content column width rather than a fixed pixel value. This ensures content stretches to (but never past) the rail's left edge.

These two changes together guarantee the rail's left edge is the right-side boundary for all main content, regardless of screen width or content overflow.
