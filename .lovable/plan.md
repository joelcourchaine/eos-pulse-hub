
# Highlight Stores with No Calls Scheduled

## Overview
Add visual highlighting to the Consulting Scheduler grid to make it easy to identify stores/clients that have no calls scheduled across all visible months.

## Implementation Approach

### 1. Calculate "No Calls" Status
In the `DisplayRowComponent`, we'll check if the row has any scheduled calls by iterating through the `calls` Map and checking if all values are null.

### 2. Apply Visual Highlighting
Apply a subtle but noticeable background color to rows with no scheduled calls. This will use a red/warning tint to draw attention to these stores that need scheduling attention.

## Technical Details

### File to Modify
- `src/components/consulting/ConsultingGrid.tsx`

### Changes

**1. Add logic to detect rows with no calls**
Inside `DisplayRowComponent`, add a computed value to check if the row has any calls:
```typescript
const hasNoCalls = useMemo(() => {
  let callCount = 0;
  row.calls.forEach((call) => { if (call) callCount++; });
  return callCount === 0;
}, [row.calls]);
```

**2. Apply conditional styling to the TableRow**
Update the `TableRow` className to include highlighting when `hasNoCalls` is true:
```typescript
<TableRow className={cn(
  "h-8",
  row.client.is_adhoc && "bg-amber-50/50 dark:bg-amber-950/20",
  hasNoCalls && !row.client.is_adhoc && "bg-red-50/50 dark:bg-red-950/20"
)}>
```

**3. Update the sticky Dealership cell background**
The sticky left cell needs matching background to maintain visual consistency:
```typescript
<TableCell className={cn(
  "sticky left-0 z-10 py-0.5",
  hasNoCalls && !row.client.is_adhoc 
    ? "bg-red-50/50 dark:bg-red-950/20" 
    : "bg-background"
)}>
```

## Visual Result
- Stores with no scheduled calls will have a subtle red/pink tinted background
- Ad-hoc clients retain their amber highlighting (takes priority)
- The highlighting will be visible across the entire row, including the sticky dealership column
- This makes it immediately obvious which stores need attention for scheduling
