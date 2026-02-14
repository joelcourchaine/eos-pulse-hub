
## Fix: Enterprise Report Sub-Metric Ordering for Ford

### Problem
Sub-metrics in Enterprise reporting (Dealer Comparison, Trend views) don't appear in the same order as they do on the financial statement. The ordering is arbitrary because the sort utility doesn't extract and sort by the order index embedded in the sub-metric keys.

### Root Cause
The `sortMetricsWithSubMetrics` utility groups sub-metrics under their parent but preserves whatever order they appear in the input array. Sub-metric IDs contain an order index from the original Excel statement (e.g., `sub:sales_expense:001:Commissions`, `sub:sales_expense:002:Delivery`), but that index is never used for sorting.

### Fix
**File: `src/utils/sortMetricsWithSubMetrics.ts`**

After collecting the `selectedSubs` array for each parent metric (line 29-31), sort them by extracting the numeric order index from the key before pushing into the result.

The sort logic will:
1. Parse the sub-metric ID format `sub:{parentKey}:{orderIndex}:{name}`
2. Extract the order index (the third segment)
3. Sort numerically by that index
4. Fall back to alphabetical name comparison for legacy keys without an order index

This single change ensures all three enterprise views (CombinedTrendView, FixedCombinedTrendView, MetricComparisonTable) display sub-metrics in statement order since they all use this shared utility.
