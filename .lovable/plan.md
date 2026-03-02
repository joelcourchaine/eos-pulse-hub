
## Fix: Infinite loop in forecast for all brands

**Root cause (confirmed):**
- `impliedGrowth` useMemo at line 2046–2054 has `growth` in its dependency array because it uses `growth` as a fallback (`return growth`)
- When `baselineTotalSalesAnnual` is 0 or results in an extreme ratio (Parts Nissan sub-metrics produce near-zero baseline), the returned value is either `growth` itself (creating a circular dep) or an astronomical number like `e+200`
- The sync `useEffect` in `ForecastDrawer.tsx` (line 758) then calls `setGrowth(impliedGrowth)` → changes `growth` → triggers the useMemo → repeat

**Two-line fix in `src/hooks/forecast/useForecastCalculations.ts` (lines 2046–2054):**

1. Return `undefined` instead of `growth` as the fallback — this removes `growth` from the dependency array entirely
2. Clamp the result to a sane range (-99% to 9900%) before returning, preventing extreme IEEE 754 values from any near-zero baseline division

```typescript
const impliedGrowth = useMemo(() => {
  const adjustedTotalSalesAnnual = annualValues.get('total_sales')?.value || 0;
  const baselineTotalSalesAnnual = annualBaseline['total_sales'] || 0;
  
  if (baselineTotalSalesAnnual > 0 && adjustedTotalSalesAnnual > 0) {
    const raw = ((adjustedTotalSalesAnnual / baselineTotalSalesAnnual) - 1) * 100;
    // Clamp to prevent extreme values from near-zero baselines (e.g. Parts Nissan)
    return Math.max(-99, Math.min(9900, raw));
  }
  return undefined; // ← was: return growth (caused circular dependency)
}, [annualValues, annualBaseline]); // ← removed `growth` from deps
```

The existing guard `if (impliedGrowth === undefined) return;` at line 760 of `ForecastDrawer.tsx` already handles the `undefined` case, so no other changes are needed.

This fix applies to **all brands** since it's in shared calculation logic — Parts Nissan triggered it but any brand with a near-zero `total_sales` baseline would have the same issue.

**File:** `src/hooks/forecast/useForecastCalculations.ts` — lines 2046–2054 only.
