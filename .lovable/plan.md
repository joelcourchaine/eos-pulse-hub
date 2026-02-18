

# Sticky Horizontal Scrollbar for User Management Table

## Problem
The `overflow-x-scroll` change didn't help because the entire dialog scrolls vertically. The horizontal scrollbar sits at the very bottom of the table content, which is off-screen when there are many users. You have to scroll all the way down just to find the horizontal scrollbar.

## Solution
Use the existing `StickyHScrollbar` component (already used on the Scorecard grid) to pin a horizontal scrollbar to the bottom of the viewport. This scrollbar stays visible at all times, regardless of vertical scroll position.

## Implementation

**File: `src/components/users/UserManagementDialog.tsx`**

1. Import the `StickyHScrollbar` component from `@/components/scorecard/StickyHScrollbar`
2. Add a `ref` to the table wrapper div (line 571) to track its scroll metrics (scrollWidth, clientWidth, scrollLeft) and its position on screen (left, width)
3. Wire up a `ResizeObserver` and scroll listener to keep the sticky scrollbar in sync with the table container
4. Render a `<StickyHScrollbar>` pinned to `position="bottom"` with `offsetPx={0}`, passing the container's scroll metrics and an `onSetScrollLeft` callback that updates `scrollLeft` on the real container
5. The `show` prop will be set to `true` whenever the table is wider than its visible area

This gives the same always-visible, viewport-pinned horizontal scrollbar experience that already exists on the Scorecard screen -- no need to scroll to the bottom of the table to find it.

## Technical Details

- The `StickyHScrollbar` component uses `createPortal` to render a fixed-position scrollbar track at the bottom of the viewport
- It handles pointer drag, track click, and stays in sync via `scrollLeft` prop
- A `useRef` + `useEffect` with `ResizeObserver` on the wrapper div will provide the required `left`, `width`, `scrollWidth`, `clientWidth` values
- A scroll event listener on the wrapper keeps `scrollLeft` in sync
- Single file change: `src/components/users/UserManagementDialog.tsx`

