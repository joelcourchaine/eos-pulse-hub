
## Fix: LY Tooltips for Percentage Sub-Metrics with Non-Matching Denominators

### Problem
The LY tooltip synthesis for percentage sub-metrics only works when the numerator and denominator have matching sub-metric names (e.g., GP %: `sub:gp_net:CUST. MECH. LABOUR` / `sub:total_sales:CUST. MECH. LABOUR`).

For metrics like **Sales Expense %**, **Semi Fixed Expense %**, and **Total Fixed Expense %**, the denominator is `gp_net` but the sub-metric names are completely different (e.g., "ADVERTISING" under `sales_expense` has no corresponding "ADVERTISING" under `gp_net`). The synthesis fails silently because it tries to find `sub:gp_net:ADVERTISING-M1-2025` which doesn't exist.

### Fix (single file: `src/components/financial/FinancialSummary.tsx`)

Update the percentage synthesis blocks in **both** the Monthly Trend branch and the Non-trend (Regular Quarter) branch to add a fallback: when a matching denominator sub-metric doesn't exist, use the parent-level denominator total instead.

The change applies in **two locations** (same logic in both):
1. Monthly Trend branch (~line 1326-1332)
2. Non-trend branch (~line 1906-1912)

### Technical Details

Current logic (fails for non-matching denominators):
```text
numerator = sub:sales_expense:ADVERTISING-M1-2025
denominator = sub:gp_net:ADVERTISING-M1-2025   <-- doesn't exist!
result = undefined (no tooltip)
```

Updated logic (falls back to parent denominator):
```text
numerator = sub:sales_expense:ADVERTISING-M1-2025
denominator = sub:gp_net:ADVERTISING-M1-2025   <-- doesn't exist
fallback  = gp_net-M1-2025                     <-- parent total exists!
result = (numerator / fallback) * 100
```

In both synthesis blocks, after the existing denominator lookup fails, add a fallback to the parent-level denominator:

```
// Existing: try sub-metric denominator
const denVal = averages[denKey];
if (numVal !== undefined && denVal !== undefined && denVal !== 0) {
  averages[pctKey] = (numVal / denVal) * 100;
} else if (numVal !== undefined) {
  // Fallback: use parent-level denominator total
  const parentDenKey = `${denominator}${suffix}`;
  const parentDenVal = averages[parentDenKey];
  if (parentDenVal !== undefined && parentDenVal !== 0) {
    averages[pctKey] = (numVal / parentDenVal) * 100;
  }
}
```

This mirrors the runtime calculation logic already used in `SubMetricsRow` (lines 547-553) where it falls back to the parent denominator total when no matching sub-metric denominator exists.
