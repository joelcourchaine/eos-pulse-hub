
## Fix: Quarter average cells should divide by month count, not sum

### Problem
The two Q TOTAL IIFE cells compute `total` (sum across 3 months) and assign it directly as `qValue`. The user wants the **average** of the 3 months, so the result should be `total / monthCount`.

The `productive` row is already correct — `(totalSold / totalAvail) * 100` is inherently a weighted average.

Only the `avail` and `sold` rows need fixing in both blocks.

### Fix — 4 one-line changes in `ScorecardGrid.tsx`

**Block 1 — Previous year (lines 5827 and 5831):**
```ts
// avail — line 5827
qValue = hasData ? total / previousYearMonths.length : null;

// sold — line 5831  
qValue = hasData ? total / previousYearMonths.length : null;
```

**Block 2 — Current quarter (lines 5888 and 5892):**
```ts
// avail — line 5888
qValue = hasData ? total / months.length : null;

// sold — line 5892
qValue = hasData ? total / months.length : null;
```

Using `.length` of the month arrays (3 for a full quarter) keeps it correct even for partial quarters.

### Files changed
- **`src/components/scorecard/ScorecardGrid.tsx`** — 4 lines changed (5827, 5831, 5888, 5892)
