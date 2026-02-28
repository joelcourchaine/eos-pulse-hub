
## Plan: Suppress Red/Yellow/Green Status Colors When Value is Zero

### Problem
When months have no financial data entered (value = `$0`), the status color logic still runs because `0` is a valid number. It computes variance against the target and marks the cell red (destructive) — but `$0` means "no data" not "bad performance."

### Fix: Treat `value === 0` as no-data (null status) in all status computation blocks

In `src/components/financial/FinancialSummary.tsx`, there are ~5 places where the `status` variable is computed. Each has a guard like:

```ts
if (value !== null && targetValue !== null && targetValue !== 0) {
  // compute variance → set status
}
```

The fix is to also add `&& value !== 0` to these guards — so a zero value produces `status = null` (no color background, just the neutral cell).

### All locations to update (5 spots, same pattern each):

1. **~line 3986** — standard monthly view, first status block  
2. **~line 4062** — standard monthly view, second status block (prev-year month column)  
3. **~line 4374** — quarterly trend view  
4. **~line 4436** — monthly trend view  
5. **~line 4610** — year total / annual view  
6. **~line 4899** — quarter-average view  

Each fix: add `&& mValue !== 0` (or `value !== 0` / `qtrValue !== 0` matching the local variable name) to the outer `if` condition that guards status computation.

This keeps green/yellow/red for months with real data while showing plain neutral cells for months with no data entered yet.

**Single file:** `src/components/financial/FinancialSummary.tsx`
