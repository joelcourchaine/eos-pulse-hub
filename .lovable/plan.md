
# Fix Column Minimum Width Constraint

## Problem
The "Customer Last Name" column cannot be resized smaller than 60px because:
1. While `ResizableTableHeader.tsx` allows resizing down to 40px
2. The table cells in `Top10ItemRow.tsx` have `minWidth: '60px'` hardcoded in the inline style

## Solution
Update `Top10ItemRow.tsx` to use the same 40px minimum width that the header uses.

## Changes Required

### File: `src/components/top-10/Top10ItemRow.tsx`
**Line 280** - Change the inline style from:
```typescript
style={colWidth ? { width: `${colWidth}px`, minWidth: '60px' } : undefined}
```
to:
```typescript
style={colWidth ? { width: `${colWidth}px`, minWidth: '40px' } : undefined}
```

This single change will allow columns to shrink to 40px, matching the header resize limit and giving you more flexibility to make "Customer Last Name" narrower and "Status" wider.

## Technical Note
- The 40px minimum ensures column headers remain somewhat readable
- Text will truncate with ellipsis as columns get narrower
- Both header and cells will now respect the same minimum width
