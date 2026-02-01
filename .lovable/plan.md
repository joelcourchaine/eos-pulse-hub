
# Fix: Style "My Resources" Link Like Header

## Goal
Display "My Resources" below the "Yearly" cadence with:
- Same styling as "My Routines" header (BookOpen icon + font-semibold text-sm)
- Visual separation from the cadence items
- Visible in both collapsed and expanded states

## Changes to `src/components/routines/RoutineSidebar.tsx`

### 1. Move "My Resources" Inside the Cadence Menu
Move the link from the bottom of `SidebarContent` to after the cadence items loop, adding a separator/spacing above it.

### 2. Apply Header-Style Formatting
Match the "My Routines" header styling:
- Icon: `BookOpen` with `h-5 w-5 text-primary`
- Text: `font-semibold text-sm`
- Layout: `flex items-center gap-2`

### 3. Add Visual Separation
Add `mt-4 pt-4 border-t` to create clear visual distinction from the cadence list.

## Visual Result (Collapsed State)

```text
+---------------------------+
| [x] My Routines      [<]  |
+---------------------------+
| [ ] Daily            (3)  |
| [ ] Weekly           2/4  |
| [ ] Monthly          0/2  |
| [ ] Quarterly        1/1  |
| [ ] Yearly           0/0  |
|                           |
| ─────────────────────     |  <-- separator
| [ ] My Resources          |  <-- header style
+---------------------------+
```

## Technical Details

**Location**: Lines 460-470 (current "My Resources" div)

**Before**:
```tsx
<div className="mt-auto border-t p-2">
  <SidebarMenuButton ...>
    <BookOpen className="h-4 w-4" />
    <span>My Resources</span>
  </SidebarMenuButton>
</div>
```

**After** (moved inside SidebarMenu, after cadence loop):
```tsx
{/* My Resources - styled like header */}
<div className="mt-4 pt-4 border-t mx-2">
  <div 
    className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent rounded-md transition-colors"
    onClick={() => navigate("/resources")}
  >
    <BookOpen className="h-5 w-5 text-primary" />
    <span className="font-semibold text-sm">My Resources</span>
  </div>
</div>
```

This places "My Resources" directly in the visible menu area with consistent header-level styling and proper separation.
