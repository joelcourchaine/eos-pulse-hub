

# Add Chevron Flow Arrows Between Stage Tabs

## Overview

Replace the plain tab list with a stepped flow indicator where each stage tab is separated by a chevron arrow (e.g., `Stage 1 › Stage 2 › Stage 3`), visually communicating the sequential nature of the process stages.

## Changes

### `src/pages/ProcessDetail.tsx`

1. Import `ChevronRight` from lucide-react (already have `ChevronDown` imported).
2. In the `TabsList` rendering loop (around line 510), insert a `ChevronRight` icon between each `TabsTrigger` -- rendered after every tab except the last one.

```tsx
{stages.map((stage, idx) => (
  <React.Fragment key={stage.id}>
    <TabsTrigger ...>
      {/* existing content */}
    </TabsTrigger>
    {idx < stages.length - 1 && (
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mx-1" />
    )}
  </React.Fragment>
))}
```

This is a small, self-contained UI change -- no database or logic changes needed.

