
## What's happening

The Financial Summary has two places where targets can be clicked/edited inline:

1. **Parent metric rows** (`FinancialSummary.tsx` lines 4596–4660): The Q1 Target cell renders an editable `<Input>` when clicked if `canEditTargets()` is true. The span also has `cursor-pointer hover:text-foreground` and an `onClick` tied to `handleTargetEdit`.

2. **Sub-metric rows** (`SubMetricsRow.tsx` lines 722–768): The quarter-target cell has `cursor-pointer hover:bg-primary/10` and an `onClick` calling `handleTargetClick`, which opens an inline `<Input>`.

Since targets are now exclusively managed through the Forecast Drawer, we need to make both cells read-only — no click handler, no inline input, no edit cursor.

## Changes

### 1. `FinancialSummary.tsx` — Parent metric Q1 Target cell (lines ~4596–4660)

- Remove the `canEditTargets() && editingTarget === metric.key` branch that renders an `<Input>` + save button
- Remove the `onClick={() => canEditTargets() && handleTargetEdit(metric.key)}` and `cursor-pointer hover:text-foreground` from the span
- Keep the display logic (forecast vs manual fallback) and the `isForecastTarget` tooltip/styling unchanged

### 2. `SubMetricsRow.tsx` — Sub-metric quarter-target cell (lines ~739–768)

- Remove `cursor-pointer hover:bg-primary/10` from the `TableCell` className
- Remove `onClick={() => !isEditing && handleTargetClick(subMetric.name, quarterlyTargetValue)}` from the `TableCell`
- Remove the `{isEditing ? <Input ... /> : <span>}` conditional — just always render the `<span>` display
- Keep the forecast fallback calculation and `isForecastTarget` styling

### Files to change
- `src/components/financial/FinancialSummary.tsx` — strip edit UI from Q1 Target cell (~lines 4596–4660)
- `src/components/financial/SubMetricsRow.tsx` — strip edit UI from quarter-target cell (~lines 739–768)
