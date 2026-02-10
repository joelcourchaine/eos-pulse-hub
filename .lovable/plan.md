
## Fix: Add LY Tooltip Data for Sub-Metrics in Regular Quarter View

### Problem
The `loadPrecedingQuartersData` function has three branches:
1. **Monthly Trend mode** -- stores individual sub-metric M-format keys and synthesizes percentage sub-metrics (working)
2. **Quarter Trend mode** -- stores sub-metric Q-format keys and synthesizes percentage sub-metrics (working)
3. **Regular Quarter mode** (Q1, Q2, Q3, Q4) -- only stores parent metric Q-format averages, completely missing sub-metric storage

When `SubMetricLYTooltip` tries to look up `sub:gp_percent:CUST. MECH. LABOUR-M1-2024`, there's nothing in `precedingQuartersData` because the regular quarter branch never stored it.

### Fix (single file: `src/components/financial/FinancialSummary.tsx`)

After the existing parent metric calculations in the non-trend branch (~line 1876, just before `setPrecedingQuartersData`), add:

1. **Store individual sub-metric M-format entries** for each month in both the previous year quarter and current year quarter, mirroring the logic at lines 1296-1311:
   - Loop through each month's raw data entries
   - For entries starting with `sub:`, extract parent key and sub-name (stripping the order index)
   - Store as `sub:{parentKey}:{subName}-M{month}-{year}`

2. **Synthesize percentage sub-metrics** for the same months, mirroring lines 1313-1337:
   - For each percentage metric with a numerator/denominator calculation, iterate through stored numerator sub-metric keys
   - Calculate `(numerator / denominator) * 100` and store as `sub:{percentageKey}:{subName}-M{month}-{year}`
   - Only synthesize if no direct value is already stored

### Technical Details

The code block to add is essentially a copy of the same pattern used in the Monthly Trend branch, applied to the `allRows` data and `allMonthIds` already loaded in the non-trend branch:

```
// After line ~1876 (after current year quarter averages calculation)
// Store individual sub-metric entries for LY tooltip lookups
for (const monthId of allMonthIds) {
  const monthParts = monthId.split('-');
  const yr = parseInt(monthParts[0], 10);
  const mo = parseInt(monthParts[1], 10);
  const monthEntries = data.filter(e => e.month === monthId);
  
  for (const entry of monthEntries) {
    if (entry.metric_name?.startsWith('sub:') && entry.value != null) {
      const parts = entry.metric_name.split(':');
      if (parts.length >= 4) {
        const parentKey = parts[1];
        const subName = parts.slice(3).join(':');
        averages[`sub:${parentKey}:${subName}-M${mo}-${yr}`] = entry.value;
      }
    }
  }
  
  // Synthesize percentage sub-metrics
  FINANCIAL_METRICS.forEach(metric => {
    if (metric.type === 'percentage' && metric.calculation && 'numerator' in metric.calculation) {
      const { numerator, denominator } = metric.calculation;
      const prefix = `sub:${numerator}:`;
      const suffix = `-M${mo}-${yr}`;
      for (const key of Object.keys(averages)) {
        if (key.startsWith(prefix) && key.endsWith(suffix)) {
          const subName = key.slice(prefix.length, key.length - suffix.length);
          const pctKey = `sub:${metric.key}:${subName}${suffix}`;
          if (averages[pctKey] === undefined) {
            const numVal = averages[key];
            const denKey = `sub:${denominator}:${subName}${suffix}`;
            const denVal = averages[denKey];
            if (numVal !== undefined && denVal !== undefined && denVal !== 0) {
              averages[pctKey] = (numVal / denVal) * 100;
            }
          }
        }
      }
    }
  });
}
```

This ensures that when viewing Q1 2026, the sub-metric LY tooltips can find 2025 data stored with M-format keys matching the lookup pattern used by `SubMetricLYTooltip`.
