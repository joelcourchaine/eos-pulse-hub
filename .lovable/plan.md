

# My Processes -- Department Standard Work (Phase 1)

## Overview

A full-page workspace where departments define and follow standard operating procedures. Accessed from the right sidebar ("My Processes") between My Routines and My Resources. Automatically filtered by the user's current store and department.

---

## Database Schema

### New Tables

**`process_categories`** (lookup/seed table)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | "Serve the Customer", "Run the Department", "Grow the Business" |
| display_order | int | 1, 2, 3 |
| created_at | timestamptz | |

**`processes`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| department_id | uuid | FK to departments |
| category_id | uuid | FK to process_categories |
| title | text | |
| description | text | nullable |
| owner_id | uuid | FK to profiles (nullable) |
| is_active | boolean | default true |
| display_order | int | ordering within category |
| created_by | uuid | |
| created_at / updated_at | timestamptz | |

**`process_stages`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| process_id | uuid | FK to processes |
| title | text | |
| display_order | int | |
| created_at / updated_at | timestamptz | |

**`process_steps`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| stage_id | uuid | FK to process_stages |
| title | text | |
| instructions | text | nullable, rich text / bullets |
| definition_of_done | text | nullable |
| owner_role | text | nullable, role responsible |
| estimated_minutes | int | nullable |
| display_order | int | |
| is_sub_process | boolean | default false (collapsible sub-step) |
| parent_step_id | uuid | nullable, FK to self for sub-processes |
| created_at / updated_at | timestamptz | |

**`process_step_attachments`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| step_id | uuid | FK to process_steps |
| file_path | text | storage path |
| file_name | text | display name |
| file_type | text | image/png etc. |
| display_order | int | |
| created_at | timestamptz | |

### RLS Policies

All tables follow the existing department-based access pattern:
- **SELECT**: Users in the same store group can view (matching `departments -> stores -> store_groups` chain), plus super_admins
- **INSERT/UPDATE/DELETE**: Department managers (via `user_department_access`), store GMs (via store group), and super_admins

### Storage

Create a `process-attachments` storage bucket (private) for step images/screenshots. RLS on the bucket mirrors the table policies.

### Seed Data

Insert the three fixed categories: "Serve the Customer" (1), "Run the Department" (2), "Grow the Business" (3).

---

## Routing

| Route | Component | Purpose |
|-------|-----------|---------|
| `/processes` | `ProcessesPage` | Category view (3 tiles) |
| `/processes/:processId` | `ProcessDetailPage` | Full process view with stages/steps |

Both routes added to `src/App.tsx` above the catch-all.

---

## Right Sidebar Changes

**File: `src/components/routines/RoutineSidebar.tsx`**

Add a "My Processes" link between the cadence menu and the existing "My Resources" link (currently at line 408). Uses the `Workflow` icon from lucide-react:

```
My Routines (existing header)
  [cadence items]
  ---
  My Processes (NEW)
  My Resources (existing)
```

Clicking navigates to `/processes` with the current `departmentId` passed as a query param (e.g., `/processes?dept=<id>`).

---

## New Pages

### ProcessesPage (`src/pages/Processes.tsx`)

- Header with back arrow, "My Processes" title, department name
- Reads `dept` query param; if missing, redirects to `/dashboard`
- Fetches processes for the department grouped by category
- Displays **three large card tiles** (one per category) in a responsive grid (3 columns desktop, 1 column mobile)
- Each tile lists processes with: title, owner name, "Updated X ago"
- Each tile has a "+ Create Process" button at the bottom (permission-gated)
- Clicking a process navigates to `/processes/:processId`

### ProcessDetailPage (`src/pages/ProcessDetail.tsx`)

**Header Area:**
- Process name (large), description below
- Right side: Favorite (local/localStorage for Phase 1), Print (window.print), Edit button (permission-gated)
- Breadcrumb: My Processes > [Category] > [Process Name]

**Stages as Horizontal Tabs:**
- Uses the existing `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` components
- Each tab = one stage
- Active tab shows its steps

**Steps List (inside active stage):**
- Card-based layout, each step is a card with:
  - Step number + title (bold)
  - Instructions (rendered as bullet list)
  - Definition of Done (highlighted box)
  - Owner role (badge)
  - Estimated time (if set)
  - Attachments (thumbnail grid, click to enlarge in a dialog)
  - Collapsible sub-processes (using existing `Collapsible` component)

### Process Builder (Edit Mode)

Toggled via the Edit button on `ProcessDetailPage`. Same page, different mode:

- **Add Stage** button in tab bar
- **Add Step** button at bottom of step list
- Inline editing: click step title/instructions/definition-of-done to edit
- Each field uses simple `<Input>` or `<Textarea>` (no rich text needed for Phase 1, keep it lean)
- Owner assignment via a `<Select>` dropdown
- Attachment upload via file input (uploads to `process-attachments` bucket)
- **Drag and drop** for reordering stages and steps using HTML5 drag events (no extra library needed for simple reorder)
- Auto-save on blur / debounced

### Create Process Dialog (`src/components/processes/CreateProcessDialog.tsx`)

Simple dialog asking for:
- Process name (required)
- Category (select from 3 options)
- Owner (select from department users)
- Description (optional textarea)

On submit: creates the process record and navigates to the process detail page in edit mode.

---

## New Components

```
src/components/processes/
  CreateProcessDialog.tsx
  ProcessCategoryTile.tsx
  ProcessStageTab.tsx
  ProcessStepCard.tsx
  ProcessStepEditor.tsx
  StepAttachmentUpload.tsx
  SubProcessSection.tsx
```

---

## Deployment Across Stores

On the Create Process dialog (or a separate "Deploy" action visible to super_admins and store GMs):
- Option to copy a process to all departments of the same type across the store group
- This mirrors the existing "Deploy Routine" pattern in `src/components/admin/DeployRoutineDialog.tsx`
- Implementation: a "Copy to Group" button that duplicates the process (and its stages/steps) to matching departments

---

## Permissions Model

| Action | Who |
|--------|-----|
| View processes | Anyone with department access (same store group) |
| Create/Edit/Delete | Department managers, Fixed Ops managers, Store GMs, Super Admins |
| Deploy across group | Store GMs, Super Admins |

---

## Design Direction

- Uses existing UI primitives: `Card`, `Tabs`, `Badge`, `Button`, `Dialog`, `Collapsible`, `ScrollArea`
- White space, card-based, clean -- matches the existing dashboard aesthetic
- Category tiles use subtle color accents (muted primary variants) to differentiate the three buckets
- Step cards have clear visual hierarchy: number > title > instructions > definition of done

---

## Technical Summary

| Area | Files |
|------|-------|
| Database | 1 migration (5 tables + RLS + seed + storage bucket) |
| Routing | `src/App.tsx` (2 new routes) |
| Sidebar | `src/components/routines/RoutineSidebar.tsx` (add link) |
| Pages | `src/pages/Processes.tsx`, `src/pages/ProcessDetail.tsx` |
| Components | 7 new files in `src/components/processes/` |
| No changes to | Existing dashboard, routines, or resources functionality |

