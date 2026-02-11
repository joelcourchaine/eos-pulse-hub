
## Fix: Enterprise Sub-Metric GP Percentages Showing Raw Dollar Values

### Problem
When viewing a Dealer Comparison report with GP % sub-metrics selected (e.g., CUST. MECH. LABOUR, INTERNAL MECH. LABOUR), the values display as inflated percentages like 24553.0%, 51759.0%, etc. These are actually raw dollar amounts from the `gp_net` sub-metrics being formatted as percentages.

### Root Cause
The Enterprise metric selector correctly identifies that GP % sub-metrics are stored under the `gp_net` parent key in the database (selection ID: `sub:gp_percent:CUST. MECH. LABOUR`, but data key: `sub:gp_net:001:CUST. MECH. LABOUR`). However, the DealerComparison page reads the raw dollar values from the database and passes them straight through to the display layer, which sees the parent type is "percentage" and appends a `%` sign.

The Financial Summary page handles this correctly by **synthesizing** percentage sub-metrics on-the-fly: `sub:gp_percent:NAME = (sub:gp_net:NAME / sub:total_sales:NAME) * 100`. The DealerComparison page is missing this synthesis step entirely.

### Fix

**File: `src/pages/DealerComparison.tsx`**

Add a percentage sub-metric synthesis step that calculates the true percentage value for sub-metrics whose parent is a percentage metric (like GP %, Sales Expense %, etc.). This needs to be applied in **both** processing paths:

1. **Single-month path** (around line 1063): After processing raw entries into `dataMap`, iterate over selected sub-metrics that belong to percentage parents. For each one:
   - Look up the metric definition to find `numerator` and `denominator` keys (e.g., `gp_net` and `total_sales`)
   - Find the matching numerator sub-metric value from the DB (e.g., `sub:gp_net:001:CUST. MECH. LABOUR`)
   - Find the matching denominator sub-metric value (e.g., `sub:total_sales:001:CUST. MECH. LABOUR`), falling back to the parent denominator total if no matching sub-metric denominator exists
   - Calculate: `(numerator_value / denominator_value) * 100`
   - Update the dataMap entry with the calculated percentage

2. **Multi-month aggregation path** (around line 940): Similar logic but applied after aggregation. The percentage sub-metrics are currently being averaged, but they should instead be recalculated from the aggregated dollar sub-metrics.

### Implementation Detail

A helper function will be added that:
- Takes all financial entries for a store/department
- Groups sub-metric values by normalized name (stripping order indices)
- For each selected percentage sub-metric, computes the ratio from the corresponding dollar sub-metrics
- Uses the metric config's `calculation.numerator` and `calculation.denominator` to determine which dollar sub-metrics to use

```text
Example for "CUST. MECH. LABOUR" under GP %:
  GP % calculation = gp_net / total_sales

  numerator = value of sub:gp_net:001:CUST. MECH. LABOUR  = $24,553
  denominator = value of sub:total_sales:001:CUST. MECH. LABOUR  (or parent total_sales if no sub exists)

  Result = (24553 / total_sales_value) * 100 = actual percentage
```

### What This Affects
- DealerComparison page only (the Financial Summary already handles this correctly)
- Both single-month and multi-month/full-year report views
- All percentage-type metrics that have sub-metrics (GP %, Sales Expense %, etc.)
- YOY comparison calculations for sub-metrics will also need the same synthesis

### What Stays the Same
- Dollar sub-metrics (e.g., under Total Sales, GP Net) continue to display raw values
- Parent metric calculations remain unchanged
- The metric selection UI in Enterprise.tsx is unaffected
