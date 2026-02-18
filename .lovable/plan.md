

# My Team - Reverse Org Chart Feature

## Overview
Add a "My Team" page accessible from the left sidebar, directly under "My Resources." Users fill in a simple form to add team members; the app auto-generates a bottom-up (reverse pyramid) org chart with the Service Manager anchored at the bottom.

---

## 1. Database

Create a `team_members` table:

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | default gen_random_uuid() |
| store_id | uuid (FK to stores) | NOT NULL |
| created_by | uuid | auth.uid() at insert |
| name | text | NOT NULL |
| position | text | NOT NULL, one of: service_manager, foreman, dispatcher, advisor, technician, porter, warranty_admin, detailer |
| reports_to | uuid (FK to team_members, nullable) | NULL for root (Service Manager) |
| status | text | 'active' or 'vacant', default 'active' |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

RLS policies:
- SELECT: users can read team_members where `store_id` matches their store (via profile lookup)
- INSERT / UPDATE / DELETE: store_gm, department_manager, fixed_ops_manager, super_admin for their store(s)

Enable realtime for live updates if multiple managers edit simultaneously.

---

## 2. Navigation

**File: `src/components/routines/RoutineSidebar.tsx`**

Add a "My Team" entry directly below "My Resources" in the bottom nav section (around line 416-422), using the `Users` icon from lucide-react, navigating to `/my-team`.

```
My Processes
My Resources
My Team       <-- NEW
```

Same styling: `flex items-center gap-2 cursor-pointer hover:bg-accent rounded-md transition-colors whitespace-nowrap p-1` with `Users` icon.

---

## 3. Routing

**File: `src/App.tsx`**

Add route: `<Route path="/my-team" element={<MyTeam />} />`

---

## 4. New Page: `src/pages/MyTeam.tsx`

Page layout matching existing pages (Dashboard pattern with sidebar):
- Wrapped in `SidebarProvider` + `RoutineSidebar` + `SidebarInset`
- Header with `Users` icon and "My Team" title
- Two sections:
  1. **Team Members List** -- a simple table/card list of current members with edit/delete actions
  2. **Org Chart Visualization** -- the reverse pyramid rendered below

---

## 5. New Components

### `src/components/team/AddTeamMemberDialog.tsx`
- Dialog with fields: Name (text), Position (dropdown), Reports To (dropdown of existing members), Status (Active/Vacant toggle)
- Position dropdown options: Service Manager, Foreman / Shop Foreman, Dispatcher, Advisor, Technician, Porter, Warranty Admin, Detailer
- "Reports To" auto-populated from current team_members for this store
- On save, inserts into `team_members` table

### `src/components/team/TeamMemberDetailPanel.tsx`
- Slide-out sheet (using existing Sheet component) showing member details
- Edit position, reporting line, status, name
- Delete member button

### `src/components/team/ReverseOrgChart.tsx`
Core visualization component:
- Reads team_members for the current store
- Builds a tree from `reports_to` relationships
- Renders bottom-up: Service Manager at the bottom, direct reports above, their reports above that
- Each node is a colored card based on position type:

| Position | Color |
|---|---|
| Service Manager | Dark Blue (#1e3a5f) |
| Foreman / Shop Foreman | Teal (#0d9488) |
| Dispatcher | Light Teal (#5eead4) |
| Advisor | Green (#22c55e) |
| Technician | Orange (#f97316) |
| Porter | Grey (#9ca3af) |
| Warranty Admin | Purple (#a855f7) |
| Detailer | Yellow (#eab308) |

- Vacant members get `border-dashed` styling
- Connecting lines between parent-child nodes drawn with SVG paths

### Span of Control Warnings
- 7-9 direct reports: yellow ring/outline around that leader's card
- 10+ direct reports: red ring + warning text "Span of control exceeds recommended leadership capacity."
- Calculated dynamically from the tree data

### Toggles (in page header area)
- "Show Names" ON/OFF -- hides names, shows only position + color
- "Show Headcount Only" -- replaces cards with count badges per level

### Zoom
- Simple CSS `transform: scale()` with +/- buttons
- Container with `overflow: auto` for panning

---

## 6. File Summary

| Action | File |
|---|---|
| Create | `supabase/migrations/...team_members.sql` |
| Create | `src/pages/MyTeam.tsx` |
| Create | `src/components/team/AddTeamMemberDialog.tsx` |
| Create | `src/components/team/TeamMemberDetailPanel.tsx` |
| Create | `src/components/team/ReverseOrgChart.tsx` |
| Edit | `src/components/routines/RoutineSidebar.tsx` (add nav item) |
| Edit | `src/App.tsx` (add route) |

No external libraries needed -- the chart is built with CSS flexbox/grid and SVG lines. All existing UI components (Dialog, Sheet, Select, Badge, Button, Switch) are reused.

