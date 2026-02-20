

# Fix: Missing Labels for My Processes, Resources, and Team in Sidebar

## Problem

The sidebar bottom links (My Processes, My Resources, My Team) only show icons without text labels when the sidebar is in its "collapsed" state. The cadence items above (Daily, Weekly, etc.) display correctly because they have an explicit CSS override.

## Root Cause

The sidebar uses `collapsible="icon"` mode. When collapsed, `SidebarMenuButton` hides text by default, showing only icons. The cadence buttons override this with:

```
group-data-[collapsible=icon]:!size-auto
group-data-[collapsible=icon]:!h-10
group-data-[collapsible=icon]:!w-full
```

The three navigation buttons at the bottom are missing these overrides.

## Fix

**File: `src/components/routines/RoutineSidebar.tsx`** (lines 411, 417, 423)

Add the same CSS class override to all three `SidebarMenuButton` components:

```tsx
// My Processes (line 411)
<SidebarMenuButton
  tooltip="My Processes"
  onClick={() => navigate(`/processes?dept=${departmentId}`)}
  className="group-data-[collapsible=icon]:!size-auto group-data-[collapsible=icon]:!h-10 group-data-[collapsible=icon]:!w-full"
>

// My Resources (line 417)
<SidebarMenuButton
  tooltip="My Resources"
  onClick={() => navigate("/resources")}
  className="group-data-[collapsible=icon]:!size-auto group-data-[collapsible=icon]:!h-10 group-data-[collapsible=icon]:!w-full"
>

// My Team (line 423)
<SidebarMenuButton
  tooltip="My Team"
  onClick={() => navigate("/my-team")}
  className="group-data-[collapsible=icon]:!size-auto group-data-[collapsible=icon]:!h-10 group-data-[collapsible=icon]:!w-full"
>
```

This is a one-line className addition to each of the three buttons -- no other changes needed.
