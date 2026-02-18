

# Add Always-Visible Horizontal Scrollbar to User Management Table

## Problem
The User Management dialog has a very wide table with many columns. While `overflow-x-auto` is set on the table wrapper, the native horizontal scrollbar sits at the very bottom of the table content, making it hard to reach -- especially with many users listed.

## Solution
Wrap the table's scrollable container in a way that ensures the horizontal scrollbar is always pinned/visible at the bottom of the viewport (or dialog), not buried beneath hundreds of rows.

## Implementation

**File: `src/components/users/UserManagementDialog.tsx`**

1. Change the table wrapper (line 571) from a plain `div` with `overflow-x-auto` to a structure that keeps a horizontal scrollbar visible at all times.
2. Use a `ScrollArea` with a horizontal `ScrollBar` from the existing Radix scroll-area component (`@/components/ui/scroll-area`), which renders a visible scrollbar track. Alternatively, use CSS `overflow-x: scroll` (instead of `auto`) to force the scrollbar to always render.
3. The simplest and most consistent approach: change `overflow-x-auto` to `overflow-x-scroll` on the table wrapper div, which forces the scrollbar to always be visible. Combined with the existing global CSS that styles `::-webkit-scrollbar` to always show, this will ensure the scrollbar is always present.

### Technical Detail
- On line 571, change `overflow-x-auto` to `overflow-x-scroll` so the scrollbar is always rendered (not just when hovering or scrolling).
- This works with the existing global scrollbar styles in `index.css` (lines 120-132) that already make scrollbars always visible with custom styling.

Single-line change in one file.
