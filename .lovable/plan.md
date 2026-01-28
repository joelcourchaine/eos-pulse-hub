

## Routine Cadence System - Enhanced Implementation Plan

A comprehensive system for admins to create routine checklists (daily/weekly/monthly/quarterly/yearly) with rich descriptions, report navigation hints, and deployment capabilities. Department managers can check off items and customize routines to fit their rhythm.

---

### Overview

This feature adds:
1. **Admin Routines Tab** in SuperAdminDashboard for template management
2. **Rich Item Metadata** with "why we do it" descriptions and optional report navigation
3. **Routine Drawer** for managers to check off tasks organized by cadence
4. **Deploy Functionality** similar to existing Top 10 template deployment

---

### Database Schema

**1. routine_templates** - Admin-managed master templates

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| title | text | Template name (e.g., "Service Manager Daily") |
| description | text | Optional template description |
| cadence | text | daily, weekly, monthly, quarterly, yearly |
| items | jsonb | Array of items (see structure below) |
| department_type_id | uuid | Target department type (nullable = all) |
| created_by | uuid | Admin who created it |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last update |

**Item Structure in JSONB:**
```json
{
  "id": "item_123",
  "title": "Check technician punch times",
  "description": "Ensures all techs are clocking in on time and identifies attendance patterns",
  "order": 1,
  "report_info": {
    "type": "internal",
    "path": "/dashboard",
    "instructions": "Navigate to Dashboard > Scorecard > View Technician Metrics"
  }
}
```

**report_info options:**
- `type: "internal"` - Links to an app route with path and instructions
- `type: "external"` - Links to external system (e.g., DMS) with URL and instructions
- `type: "manual"` - Just instructions text, no link

**2. department_routines** - Department-specific instances

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| department_id | uuid | FK to departments |
| template_id | uuid | FK to routine_templates (nullable if custom) |
| title | text | Routine name |
| cadence | text | daily, weekly, monthly, quarterly, yearly |
| items | jsonb | Array of items (same structure as templates) |
| is_active | boolean | Whether routine is active |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last update |

**3. routine_completions** - Tracks check-offs per period

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| routine_id | uuid | FK to department_routines |
| item_id | text | The item ID within the routine |
| period_start | date | Start of the period (calculated based on cadence) |
| completed_by | uuid | User who checked it |
| completed_at | timestamp | When it was checked |

---

### RLS Policies

**routine_templates:**
- SELECT: All authenticated users
- INSERT/UPDATE/DELETE: Super admins only

**department_routines:**
- SELECT: Users in same store group + super admins
- ALL: Super admins, store GMs, department managers with access

**routine_completions:**
- SELECT: Users in same store group + super admins
- INSERT/DELETE: Users with department access

---

### File Structure

```text
src/components/routines/
├── RoutineDrawer.tsx           # Main drawer with cadence tabs
├── RoutineChecklist.tsx        # Checklist with progress ring
├── RoutineItemRow.tsx          # Checkable item with hover tooltip
├── RoutineItemTooltip.tsx      # Rich hover with why + report nav
├── RoutineManagementDialog.tsx # Manager add/edit custom items
└── index.ts

src/components/admin/
├── AdminRoutinesTab.tsx        # New tab in admin dashboard
├── RoutineTemplateDialog.tsx   # Create/edit templates with items
├── RoutineItemEditor.tsx       # Inline item editor with rich fields
└── DeployRoutineDialog.tsx     # Deploy to store groups
```

---

### Component Details

#### 1. AdminRoutinesTab.tsx (follows AdminTop10Tab pattern)

- Table listing all routine templates
- Columns: Title, Cadence, Department Type, Items Count, Created
- Actions dropdown: Edit, Deploy to Group, View Deployments, Delete
- "Create Template" button
- Filter by cadence type

#### 2. RoutineTemplateDialog.tsx

Form with:
- **Title** - Template name
- **Description** - Optional overview
- **Cadence** - Dropdown: Daily, Weekly, Monthly, Quarterly, Yearly
- **Department Type** - Dropdown (All or specific type)
- **Items Section** - Drag-and-drop list with inline editing

For each item:
- **Title** (required) - What to do
- **Description** (optional) - Why we do it
- **Report Info** (optional) - Expandable section with:
  - Type: Internal App Route / External System / Manual Instructions
  - Path/URL (if applicable)
  - Instructions text

#### 3. RoutineItemTooltip.tsx (similar to SubMetricQuestionTooltip)

Uses HoverCard to show on hover:
```text
┌─────────────────────────────────────┐
│ ⓘ Check technician punch times      │
├─────────────────────────────────────┤
│ WHY WE DO THIS                      │
│ Ensures all techs are clocking in   │
│ on time and identifies attendance   │
│ patterns that need addressing.      │
├─────────────────────────────────────┤
│ 📍 HOW TO ACCESS                    │
│ Navigate to Dashboard > Scorecard   │
│ > View Technician Metrics           │
│                                     │
│ [Go to Report →]                    │
└─────────────────────────────────────┘
```

The "Go to Report" button uses `navigate()` for internal routes or opens new tab for external URLs.

#### 4. RoutineDrawer.tsx

- Triggered by "My Routines" button in dashboard header
- Cadence tabs: Daily | Weekly | Monthly | Quarterly | Yearly
- Each tab shows:
  - Progress ring (X of Y complete)
  - Period label (e.g., "Monday, Jan 27" for daily)
  - List of routine checklists

#### 5. RoutineChecklist.tsx

- Card for each department_routine
- Progress bar at top
- List of RoutineItemRow components
- "Add Item" button for managers (adds custom item)
- Real-time updates via Supabase subscription

#### 6. RoutineItemRow.tsx

- Checkbox + Title
- Info icon that triggers RoutineItemTooltip
- Strikethrough animation on complete
- Edit/Delete buttons on hover (for custom items only)

---

### DeployRoutineDialog.tsx (follows DeployTop10Dialog pattern)

1. Select store group
2. Shows preview of target departments
3. Options:
   - Replace existing routines (same title)
   - Skip existing (only create new)
4. Deploy button

---

### Dashboard Integration

Add button to Dashboard header (next to existing controls):

```tsx
<Button variant="outline" onClick={() => setRoutineDrawerOpen(true)}>
  <CheckSquare className="h-4 w-4 mr-2" />
  My Routines
  <Badge variant="secondary" className="ml-2">3/8</Badge>
</Button>
```

Badge shows current cadence completion (e.g., 3 of 8 daily items done).

---

### SuperAdminDashboard Update

Add new tab to the TabsList:

```tsx
<TabsTrigger value="routines" className="flex items-center gap-1.5">
  <CheckSquare className="h-4 w-4" />
  Routines
</TabsTrigger>

<TabsContent value="routines">
  <AdminRoutinesTab />
</TabsContent>
```

---

### Technical Notes

**Period Calculation:**
```typescript
import { startOfDay, startOfWeek, startOfMonth, startOfQuarter, startOfYear } from "date-fns";

function getCurrentPeriodStart(cadence: string): Date {
  const now = new Date();
  switch (cadence) {
    case 'daily': return startOfDay(now);
    case 'weekly': return startOfWeek(now, { weekStartsOn: 1 });
    case 'monthly': return startOfMonth(now);
    case 'quarterly': return startOfQuarter(now);
    case 'yearly': return startOfYear(now);
  }
}
```

**Realtime Updates:**
```typescript
// Subscribe to completions for live checkbox sync
const channel = supabase
  .channel('routine-completions')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'routine_completions',
    filter: `routine_id=eq.${routineId}`
  }, handleCompletionChange)
  .subscribe();
```

---

### Implementation Phases

**Phase 1: Database & Admin Tab**
1. Create database tables with migration
2. Set up RLS policies
3. Build AdminRoutinesTab component
4. Build RoutineTemplateDialog with item editor

**Phase 2: Template Rich Features**
1. Add RoutineItemEditor with description and report info fields
2. Build RoutineItemTooltip component
3. Implement DeployRoutineDialog

**Phase 3: Manager Drawer Experience**
1. Build RoutineDrawer component
2. Implement RoutineChecklist with real-time sync
3. Add RoutineItemRow with tooltips
4. Integrate into Dashboard header

**Phase 4: Customization**
1. RoutineManagementDialog for adding custom items
2. Edit/delete custom items
3. Optional: Progress history view

---

### Example Admin Template

**Service Manager Daily Routine:**

| Title | Why | Report Access |
|-------|-----|---------------|
| Check technician punch times | Ensures all techs are clocking in on time | Dashboard > Scorecard > Tech Metrics |
| Review RO aging report (>3 days) | Prevents work from stalling and customer complaints | DMS > Service Reports > RO Aging |
| 10-minute lot walk | Catch issues before customers complain, verify completed work | Manual - Walk the service drive |
| Check parts special orders status | Prevent delays and keep customers informed | DMS > Parts > Special Orders |
| Review CSI callbacks scheduled | Proactive service recovery opportunity | Dashboard > Issues Panel |
| Check appointment board for tomorrow | Prepare capacity and identify potential conflicts | DMS > Service Schedule |
| Daily huddle with advisors | Alignment, roadblocks, and wins | Manual - 8:00 AM standup |

