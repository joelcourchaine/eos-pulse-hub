
## Fix: Return on Gross Percentages Not Showing for Nissan in Enterprise Report

### Problem
"Return on Gross" shows as blank/missing for Nissan brand stores in the Dealer Comparison table (accessed from the Enterprise report). Other percentage metrics like "GP %" work fine.

### Root Cause
The single-month derived metric calculation loop (lines 1376-1468 in `DealerComparison.tsx`) has two issues:

1. **Only iterates selected metrics**: It loops over `selectedMetricNames` to calculate derived values. If intermediate metrics like `Department Profit` or `Net Selling Gross` are not selected by the user, they are never calculated -- even though they are needed as inputs for `Return on Gross`.

2. **Insufficient passes for deep dependency chains**: Nissan has a 3-level dependency chain:
   - `net_selling_gross` = `gp_net - total_direct_expenses` (Level 1)
   - `department_profit` = `net_selling_gross - total_fixed_expense` (Level 2)
   - `return_on_gross` = `department_profit / gp_net` (Level 3)

   The loop does 2 passes and rebuilds `allValues` from `dataMap` between passes, but does not update `allValues` inline. So even with 2 passes, Return on Gross still can't find `department_profit` if it was only just calculated in the same pass.

   GMC doesn't have this problem because its `department_profit` formula references only base DB metrics (no intermediate derived metric), so it resolves in 1 pass.

### Fix

**File: `src/pages/DealerComparison.tsx`**

Replace the 2-pass loop (lines 1376-1468) with a single pass that:
1. Iterates **all brand metrics** in config order (not just selected ones) -- the config order naturally respects dependencies (base metrics come before derived ones)
2. Updates `allValues` immediately after each calculation (inline), so downstream metrics in the same pass can see upstream results
3. Only creates `dataMap` entries for metrics that are in `selectedMetricNames` (to avoid displaying unselected intermediate metrics)

```text
Before (lines 1376-1468):
  // Calculate derived metrics for each store+dept (do this in 2 passes to handle dependencies)
  for (let pass = 0; pass < 2; pass++) {
    storeDeptPairs.forEach(pair => {
      ...
      // Get all values (including previously calculated ones) for this store+dept
      const allValues = new Map<string, number>();
      Object.entries(dataMap).forEach(([key, data]) => { ... });
      
      // Calculate each selected metric that has a calculation formula
      selectedMetricNames.forEach(metricName => {
        ...
        if (dataMap[key]) return; // Already exists
        ...
      });
    });
  }

After:
  // Calculate derived metrics for each store+dept
  // Use a single pass over ALL brand metrics in config order (which respects dependencies).
  // Update allValues inline so downstream metrics (e.g., Return on Gross) can see
  // upstream derived metrics (e.g., Department Profit) calculated earlier in the same pass.
  storeDeptPairs.forEach(pair => {
    const [storeId, deptId] = pair.split('|');
    const storeBrand = storeBrands.get(storeId) || null;
    
    // Get all existing values for this store+dept
    const allValues = new Map<string, number>();
    Object.entries(dataMap).forEach(([key, data]) => {
      if (data.storeId === storeId && data.departmentId === deptId && data.value !== null) {
        const metricKey = nameToKey.get(data.metricName);
        if (metricKey) allValues.set(metricKey, data.value);
      }
    });
    
    const sampleEntry = Object.values(dataMap).find(
      d => d.storeId === storeId && d.departmentId === deptId
    );
    if (!sampleEntry) return;
    
    // Iterate ALL brand metrics in config order (ensures dependencies resolve naturally)
    const storeBrandMetrics = getMetricsForBrand(storeBrand);
    storeBrandMetrics.forEach((metricDef: any) => {
      if (!metricDef.calculation) return;
      
      const metricKey = metricDef.key;
      // Skip if already has a value from DB
      if (allValues.has(metricKey)) return;
      
      // Calculate the value
      let value: number | null = null;
      const calc = metricDef.calculation;
      
      if ('numerator' in calc && 'denominator' in calc) {
        const num = allValues.get(calc.numerator);
        const denom = allValues.get(calc.denominator);
        if (num !== undefined && denom !== undefined && denom !== 0) {
          value = (num / denom) * 100;
        }
      } else if (calc.type === 'subtract') {
        const base = allValues.get(calc.base);
        if (base !== undefined) {
          value = base;
          calc.deductions.forEach((d: string) => {
            const val = allValues.get(d);
            if (val !== undefined) value! -= val;
          });
        }
      } else if (calc.type === 'complex') {
        const base = allValues.get(calc.base);
        if (base !== undefined) {
          value = base;
          calc.deductions.forEach((d: string) => {
            const val = allValues.get(d);
            if (val !== undefined) value! -= val;
          });
          calc.additions.forEach((a: string) => {
            const val = allValues.get(a);
            if (val !== undefined) value! += val;
          });
        }
      }
      
      if (value !== null) {
        // Always update allValues so downstream metrics can use this result
        allValues.set(metricKey, value);
        
        // Only add to dataMap if this metric is selected for display
        const metricName = metricDef.name;
        if (selectedMetricNames.includes(metricName)) {
          const key = `${storeId}-${deptId}-${metricKey}`;
          if (!dataMap[key]) {
            const comparisonKey = `${deptId}-${metricKey}`;
            const comparisonInfo = comparisonMap.get(comparisonKey);
            
            dataMap[key] = {
              storeId,
              storeName: sampleEntry.storeName,
              departmentId: deptId,
              departmentName: sampleEntry.departmentName,
              metricName,
              value,
              target: comparisonInfo?.value || null,
              variance: null,
            };
            
            if (comparisonInfo && comparisonInfo.value !== 0) {
              const variance = ((value - comparisonInfo.value) / Math.abs(comparisonInfo.value)) * 100;
              const shouldReverse = comparisonMode === "targets" && metricDef.targetDirection === 'below';
              dataMap[key].variance = shouldReverse ? -variance : variance;
            }
          }
        }
      }
    });
  });
```

### What This Fixes
- Return on Gross now correctly calculates for Nissan (and any brand with deep dependency chains)
- Intermediate metrics (Net Selling Gross, Department Profit) are calculated even when not selected, so percentage metrics that depend on them work
- Single pass is sufficient because brand config order naturally respects dependencies

### What Stays the Same
- Multi-month path already works (it iterates all brand metrics at lines 1088-1123)
- Values, formatting, and display logic are unchanged
- Other brands continue to work (GMC, Ford, etc. have shallower dependency chains that already resolved)
