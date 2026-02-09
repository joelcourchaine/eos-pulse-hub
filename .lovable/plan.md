

## Add Visual Emphasis to Parent Metrics in Enterprise Reports

### Overview

Parent metrics that have sub-metrics beneath them currently look the same as standalone metrics, making it hard to visually distinguish the hierarchy. This change will add subtle but clear visual emphasis to parent metric rows across all three Enterprise report views plus the DealerComparison page.

### Visual Treatment

**Parent metrics** (any metric that has at least one `sub:parentKey:*` sibling in the selected list) will receive:
- A slightly bolder font weight (`font-semibold`) on the metric name cell
- A subtle left border accent (`border-l-2 border-primary`) to visually anchor the group
- Optionally a very light background tint (`bg-primary/5`) to separate them from sub-metrics

**Sub-metrics** already have:
- `↳` prefix
- Lighter text (`text-muted-foreground`)
- Indented padding (`pl-6`)
- Muted background (`bg-muted/50`)

No changes needed for sub-metric styling -- they already look subordinate. The key is making parents stand out more.

### Implementation

A small helper function will be added to determine if a given metric ID is a "parent" based on whether any subsequent metric in the sorted list starts with `sub:{parentKey}:`.

**Files to modify:**

1. **`src/components/enterprise/FixedCombinedTrendView.tsx`** (lines ~673-678)
   - Add a `parentMetricKeys` set computed via `useMemo` that identifies which metrics have sub-metrics in the sorted list
   - Apply `font-semibold border-l-2 border-primary bg-primary/5` to the `TableRow` and metric name `TableCell` when the metric is a parent

2. **`src/components/enterprise/CombinedTrendView.tsx`** (lines ~884-891)
   - Same logic applied to the financial metrics table rows
   - Add `parentMetricKeys` set from `sortedFinancialMetrics`

3. **`src/pages/DealerComparison.tsx`** (lines ~1989-1995)
   - Add parent detection using the ordered selected metrics list
   - Apply the same visual emphasis to parent rows in both standard and three-column layouts

### Technical Detail

The parent detection logic:

```typescript
const parentMetricKeys = useMemo(() => {
  const parents = new Set<string>();
  const metrics = getMetricsForBrand(brandName);
  const keySet = new Set(sortedMetrics);

  for (const metric of metrics) {
    const key = (metric as any).key;
    const hasSubSelected = sortedMetrics.some(
      id => id.startsWith(`sub:${key}:`)
    );
    if (hasSubSelected && keySet.has(metric.name)) {
      parents.add(metric.name);
    }
  }
  return parents;
}, [sortedMetrics, brandName]);
```

Then in the row rendering:

```tsx
const isParent = parentMetricKeys.has(selectionId);

<TableRow className={`
  ${isSubMetric ? 'bg-muted/50' : ''}
  ${isParent ? 'bg-primary/5' : ''}
`}>
  <TableCell className={`
    font-medium sticky left-0 z-10
    ${isSubMetric ? 'bg-muted pl-6 text-muted-foreground' : 'bg-background'}
    ${isParent ? 'font-semibold border-l-2 border-primary bg-primary/5' : ''}
  `}>
    {displayName}
  </TableCell>
  ...
</TableRow>
```

### Files Modified

1. `src/components/enterprise/FixedCombinedTrendView.tsx` -- parent detection + row styling
2. `src/components/enterprise/CombinedTrendView.tsx` -- parent detection + row styling  
3. `src/pages/DealerComparison.tsx` -- parent detection + row styling

### No database changes required.

