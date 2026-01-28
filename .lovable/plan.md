

## Due Date Configuration for Routines - Implementation Plan

Add the ability to configure specific due dates for non-daily routines (weekly, monthly, quarterly, yearly) so managers know exactly when each routine needs to be completed.

---

### Overview

Currently, routines simply track whether items are completed within a period (this week, this month, etc.) but don't specify a due date. This enhancement adds:
- **Due day configuration** in admin templates
- **Visual due date display** in the sidebar
- **Overdue indicators** when past due

---

### Due Date Options by Cadence

| Cadence | Due Day Options |
|---------|-----------------|
| Daily | N/A (always today) |
| Weekly | Day of week: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday |
| Monthly | Day of month: 1st, 2nd, ... 28th, Last Day, or "Last [weekday]" |
| Quarterly | Day of quarter: 1st of quarter, 15th of last month, Last Day of Quarter |
| Yearly | Specific date: Month + Day picker (e.g., December 31st) |

---

### Database Changes

**Add columns to routine_templates:**

```sql
ALTER TABLE routine_templates ADD COLUMN due_day_config jsonb DEFAULT NULL;
```

**Add columns to department_routines:**

```sql
ALTER TABLE department_routines ADD COLUMN due_day_config jsonb DEFAULT NULL;
```

**due_day_config JSONB structure:**

```json
// Weekly - day of week (1-7, Monday=1)
{ "type": "day_of_week", "day": 5 }  // Friday

// Monthly - day of month (1-31 or "last")
{ "type": "day_of_month", "day": 15 }
{ "type": "day_of_month", "day": "last" }
{ "type": "last_weekday", "weekday": 5 }  // Last Friday of month

// Quarterly - relative to quarter
{ "type": "day_of_quarter", "day": "last" }  // Last day
{ "type": "day_of_quarter", "month": 3, "day": 15 }  // 15th of last month

// Yearly - specific month and day
{ "type": "specific_date", "month": 12, "day": 31 }  // Dec 31
```

---

### Admin UI Changes

**RoutineTemplateDialog.tsx - Add Due Date Section:**

When cadence is selected (and not "daily"), show a due date configuration section:

```text
┌─────────────────────────────────────────────────────────┐
│ Cadence *                      │ Department Type        │
│ [Weekly ▼]                     │ [All Departments ▼]    │
├─────────────────────────────────────────────────────────┤
│ Due Date (Optional)                                     │
│ When should this routine be completed each week?        │
│                                                         │
│ [  ] No specific due date (anytime during the period)  │
│ [●] Due every: [ Friday ▼ ]                            │
└─────────────────────────────────────────────────────────┘
```

**Cadence-specific due date pickers:**

- **Weekly**: Simple dropdown of weekdays
- **Monthly**: Dropdown with numbers 1-28 + "Last Day" + "Last [weekday]"
- **Quarterly**: Dropdown with "Last day of quarter", "15th of last month", etc.
- **Yearly**: Month + Day pickers

---

### Display Changes

**RoutineSidebar / RoutineDrawer - Period Label:**

Current:
```text
Week of Jan 27
```

With due date:
```text
Week of Jan 27 • Due Friday
```

Or if overdue:
```text
Week of Jan 27 • ⚠️ Due Friday (Overdue)
```

**RoutineChecklist - Due indicator:**

Add a small due date indicator at the top of each checklist card:
```text
┌────────────────────────────────┐
│ Service Manager Daily   3 / 8 │
│ Due: Friday, Jan 31           │
│ ▓▓▓▓▓▓░░░░░░░░░░░░░░░░        │
├────────────────────────────────┤
│ [ ] Check technician times    │
│ [x] Review RO aging           │
│ ...                           │
└────────────────────────────────┘
```

---

### Due Date Calculation Logic

**New utility function:**

```typescript
function getDueDate(
  cadence: Cadence, 
  periodStart: Date, 
  dueConfig: DueDayConfig | null
): Date | null {
  if (!dueConfig) return null;
  
  switch (cadence) {
    case "weekly":
      // Add days from Monday to the due day
      return addDays(periodStart, dueConfig.day - 1);
      
    case "monthly":
      if (dueConfig.day === "last") {
        return endOfMonth(periodStart);
      }
      return setDate(periodStart, dueConfig.day);
      
    case "quarterly":
      if (dueConfig.day === "last") {
        return endOfQuarter(periodStart);
      }
      // Handle other quarterly configs...
      
    case "yearly":
      return new Date(
        periodStart.getFullYear(),
        dueConfig.month - 1,
        dueConfig.day
      );
  }
}

function isOverdue(dueDate: Date): boolean {
  return new Date() > dueDate;
}
```

---

### File Changes Summary

| File | Change |
|------|--------|
| `supabase/migrations/xxx_add_routine_due_dates.sql` | Add `due_day_config` column to both tables |
| `src/components/admin/RoutineTemplateDialog.tsx` | Add due date configuration UI |
| `src/components/admin/DueDatePicker.tsx` | **New** - Reusable due date picker component |
| `src/components/routines/RoutineSidebar.tsx` | Display due date in period label |
| `src/components/routines/RoutineChecklist.tsx` | Show due date on card, overdue styling |
| `src/components/routines/RoutineDrawer.tsx` | Display due date in period label |
| `src/utils/routineDueDate.ts` | **New** - Due date calculation utilities |

---

### Implementation Phases

**Phase 1: Database & Admin Config**
1. Add `due_day_config` column to both tables via migration
2. Create `DueDatePicker.tsx` component for admin
3. Integrate due date picker into `RoutineTemplateDialog.tsx`
4. Deploy templates inherit due date config to department routines

**Phase 2: Display & Indicators**
1. Create due date calculation utilities
2. Update `RoutineSidebar.tsx` to show due dates
3. Update `RoutineChecklist.tsx` with due badge
4. Add overdue styling (amber/red indicators)

**Phase 3: Polish**
1. Add due date to export/reports if needed
2. Consider notifications for upcoming due dates (future)

---

### Optional Enhancement: Due Time

If needed, we could also add a time component:
- "Due Friday by 5:00 PM"

This would require adding a `due_time` field and more complex logic, but could be added later.

---

### Visual Examples

**Weekly - Due Friday:**
```text
Period: Week of Jan 27
Due: Friday, Jan 31
Status: 2 days remaining
```

**Monthly - Due 15th:**
```text
Period: February 2026
Due: Saturday, Feb 15
Status: Overdue by 3 days (if past due)
```

**Quarterly - Due Last Day:**
```text
Period: Q1 2026
Due: Tuesday, Mar 31
Status: 45 days remaining
```

