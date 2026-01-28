

## Daily Outstanding Tasks - Red Circle Indicator

### Overview
Change the "Daily" cadence to display a red circle with the count of outstanding (incomplete) tasks instead of the current "completed/total" badge format. Other cadences (weekly, monthly, quarterly, yearly) will keep the existing badge style.

### Visual Change
- **Before**: Daily shows "1/3" in a gray badge
- **After**: Daily shows a red circle with "2" (the number of incomplete tasks)
- When all daily tasks are complete (0 outstanding), show a green checkmark or no indicator

### Implementation Details

**File: `src/components/routines/RoutineSidebar.tsx`**

1. **Create a helper component for the red circle indicator**
   - A small circular badge with red background and white text
   - Only shows when there are outstanding tasks (greater than 0)
   - When complete, shows a green checkmark badge instead

2. **Update the badge rendering logic (lines 339-346)**
   - For "daily" cadence: render the red circle with outstanding count
   - For other cadences: keep the existing completed/total badge format

### Technical Approach

```text
+--------------------------------------------------+
|  Cadence Badge Logic                              |
+--------------------------------------------------+
|                                                   |
|  if (cadence === "daily")                        |
|    └── if outstanding > 0                        |
|          └── Red circle with outstanding count   |
|    └── if outstanding === 0                      |
|          └── Green checkmark badge               |
|                                                   |
|  else (weekly, monthly, quarterly, yearly)       |
|    └── Current "X/Y" badge format                |
|                                                   |
+--------------------------------------------------+
```

### Styling
- Red circle: `bg-destructive text-destructive-foreground rounded-full min-w-5 h-5 flex items-center justify-center text-xs font-medium`
- Ensures the circle remains properly sized for single and double-digit numbers

