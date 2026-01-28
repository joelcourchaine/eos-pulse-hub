

## Persistent Routine Sidebar - Always Visible Tasks

Transform routines from a hidden drawer into a **persistent right-side sidebar** that's always visible on the dashboard - just like the floating support button, but for your routine tasks.

---

### What You'll Get

```text
CURRENT (Drawer - Hidden by Default):
+------------------------------------------+
|              Dashboard                   |
|   [Click "Routines" button to open]      |
|                                          |
+------------------------------------------+
                                    +---------+
                                    | Drawer  |
                                    | slides  |
                                    | in...   |
                                    +---------+

NEW (Sidebar - Always Visible):
+------------------------------------------+------------------+
|              Dashboard                   |  MY ROUTINES  [<]|
|                                          |                  |
|   [All your content here]                |  D  W  M  Q  Y   |
|                                          |  ─────────────── |
|                                          |  [ ] Task 1      |
|   [Content auto-adjusts width]           |  [x] Task 2      |
|                                          |  [ ] Task 3      |
|                                          |                  |
+------------------------------------------+------------------+

COLLAPSED (Icon-only - Max Screen Space):
+-----------------------------------------------+----+
|              Dashboard                        | D  |
|                                               | W  |
|   [Full width content when collapsed]         | M  |
|                                               | Q  |
|                                               | Y  |
+-----------------------------------------------+----+
```

---

### Key Features

**Always There**
- Sidebar is permanently visible on desktop (no button click needed)
- Collapse to icons when you need more screen space
- Expand back to see full checklists

**Quick Toggle**
- Click the collapse arrow to hide/show
- Keyboard shortcut: Ctrl/Cmd + B
- State remembers your preference (cookies)

**Mobile Friendly**
- On mobile, becomes a slide-out sheet (like current drawer)
- Opens via a trigger button

**All 5 Cadences Always Visible**
- Daily, Weekly, Monthly, Quarterly, Yearly tabs always shown
- Even empty cadences display with "No routines assigned" message
- Progress badges show completion (3/8) for each

---

### Implementation

#### 1. Create RoutineSidebar Component

**New file: `src/components/routines/RoutineSidebar.tsx`**

Uses Shadcn Sidebar primitives configured for right-side placement:

```tsx
<Sidebar side="right" collapsible="icon" className="border-l">
  <SidebarHeader>
    <h3>My Routines</h3>
    <SidebarTrigger /> {/* Collapse button */}
  </SidebarHeader>
  
  <SidebarContent>
    {/* Cadence tabs as menu items */}
    <SidebarMenu>
      {cadences.map(c => (
        <SidebarMenuItem>
          <SidebarMenuButton 
            isActive={activeCadence === c.id}
            tooltip={`${c.label}: ${c.completed}/${c.total}`}
          >
            <c.icon />
            <span>{c.label}</span>
            <Badge>{c.completed}/{c.total}</Badge>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
    
    {/* Routine checklists (hidden when collapsed) */}
    <div className="group-data-[collapsible=icon]:hidden">
      <RoutineChecklist ... />
    </div>
  </SidebarContent>
</Sidebar>
```

Key properties:
- `side="right"` - positions on right side
- `collapsible="icon"` - collapses to 48px icon strip
- Tooltips show full info when hovering collapsed state

#### 2. Wrap Dashboard in SidebarProvider

**File: `src/pages/Dashboard.tsx`**

```tsx
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { RoutineSidebar } from "@/components/routines";

const Dashboard = () => {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full">
        {/* Main dashboard content */}
        <SidebarInset className="flex-1 min-w-0">
          <div className="min-h-screen bg-muted/30">
            <header>...</header>
            <main>...</main>
          </div>
        </SidebarInset>
        
        {/* Persistent right sidebar */}
        {selectedDepartment && user && (
          <RoutineSidebar 
            departmentId={selectedDepartment}
            userId={user.id}
          />
        )}
      </div>
    </SidebarProvider>
  );
};
```

The `SidebarInset` component automatically adjusts the main content width when the sidebar expands/collapses.

#### 3. Remove "Routines" Button from Header

Since routines are now always visible:
- Delete the "Routines" button from the header navigation
- Delete the `routineDrawerOpen` state variable
- Remove the `RoutineDrawer` component import and usage

#### 4. Sidebar Content Structure

**Expanded View (320px width):**
```text
┌────────────────────────────────┐
│  MY ROUTINES              [<]  │
├────────────────────────────────┤
│  ● Daily           [3/8]       │
│  ○ Weekly          [2/5]       │
│  ○ Monthly         [0/3]       │
│  ○ Quarterly       [1/2]       │
│  ○ Yearly          [0/1]       │
├────────────────────────────────┤
│  Tuesday, Jan 28               │
│  ─────────────────────────     │
│  Service Manager Daily   3/8   │
│  ▓▓▓▓▓▓░░░░░░░░░░░░░░░        │
│  ──────────────────────────    │
│  [ ] Check technician times    │
│  [x] Review RO aging           │
│  [x] Parts order status        │
│  [x] CSI follow-up calls       │
│  [ ] Warranty claims review    │
│  ...                           │
└────────────────────────────────┘
```

**Collapsed View (48px width):**
```text
┌──┐
│[>│  (expand button)
├──┤
│ D│  (Daily - tooltip shows "Daily: 3/8")
│ W│  (Weekly)
│ M│  (Monthly)
│ Q│  (Quarterly)
│ Y│  (Yearly)
└──┘
```

---

### File Changes Summary

| File | Change |
|------|--------|
| `src/components/routines/RoutineSidebar.tsx` | **New** - Persistent right sidebar component |
| `src/components/routines/index.ts` | Export `RoutineSidebar` |
| `src/pages/Dashboard.tsx` | Wrap in SidebarProvider, add RoutineSidebar, remove Routines button |

---

### Reusing Existing Components

The sidebar will reuse everything already built:
- `RoutineChecklist.tsx` - Fetches data, handles real-time sync, due date display
- `RoutineItemRow.tsx` - Individual checkbox items
- `RoutineItemTooltip.tsx` - Hover cards with "why" explanations
- `routineDueDate.ts` - Due date calculations and formatting

Only the container changes from a Drawer to a persistent Sidebar.

---

### Mobile Behavior

On screens under 768px:
- Sidebar automatically converts to a Sheet (slide-out drawer)
- A small trigger button appears to open it
- Same content, just different interaction pattern
- Prevents taking up valuable mobile screen space

---

### Persistence

- Collapse state saved in cookies (`sidebar:state`)
- Remembers your preference across sessions
- Active cadence tab also preserved

