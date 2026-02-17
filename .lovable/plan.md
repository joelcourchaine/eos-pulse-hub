
# Fix Inverted Visual Cues for Expense Sub-Metrics

## Problem

Sub-metrics under expense rows (e.g., Sales Expense, Semi Fixed Expense, Total Fixed Expense) show **green when above forecast** and **red when below forecast** -- the opposite of what they should be. These are expenses, so being below forecast is good (green) and above forecast is bad (red).

The parent metrics display correctly because they use the `targetDirection` from the metric config. But the `SubMetricsRow` component has no awareness of the parent's `targetDirection` and **defaults to `'above'`** in three places when no rock target overrides it.

## Root Cause

In `src/components/financial/SubMetricsRow.tsx`, the default direction is hardcoded to `'above'`:

- **Line 566**: `const effectiveDirection = rockTargetValue !== null ? rockDirection : 'above';`
- **Line 833**: `getVarianceStatus(quarterValue, effectiveTarget, 'above')`
- **Line 993**: `const effectiveDirection = rockTargetValue !== null ? rockDirection : 'above';`

## Fix

### 1. Add a `parentTargetDirection` prop to `SubMetricsRow`

Add to the `SubMetricsRowProps` interface:
```typescript
parentTargetDirection?: 'above' | 'below';
```

### 2. Use it as the fallback instead of `'above'`

Replace the three hardcoded `'above'` defaults:
- Line 566: `rockTargetValue !== null ? rockDirection : (parentTargetDirection ?? 'above')`
- Line 833: `getVarianceStatus(quarterValue, effectiveTarget, parentTargetDirection ?? 'above')`
- Line 993: `rockTargetValue !== null ? rockDirection : (parentTargetDirection ?? 'above')`

### 3. Pass the prop from `FinancialSummary.tsx`

In the `SubMetricsRow` usage (~line 4781), add:
```typescript
parentTargetDirection={metric.targetDirection}
```

This ensures expense sub-metrics inherit the parent's `'below'` direction, showing green when under forecast and red when over.
