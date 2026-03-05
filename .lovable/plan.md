
## Problem Analysis

The email's current single `Σ Totals` row doesn't match the UI's 4-row totals section:

**UI structure at the bottom:**
```
Row 1: [Σ Totals] [empty] [empty x 13] [empty]   ← navy separator
Row 2: [Available Hours] [target] [sum/wk x 13] [Q-Total sum]
Row 3: [Sold Hours] [target] [sum/wk x 13] [Q-Total sum]
Row 4: [Productivity] [target%] [sold/avail% x 13] [Q-Total%] ← color-coded
```

**Email currently has:**
```
Row 1: [Σ Totals] [—] [naive sum of all KPIs x 13] [grand total]
```

Three fixes needed:

### 1. Fix the Totals section (4 rows matching UI)

The email needs to:
- Identify which KPIs are "Available Hours" type vs "Sold Hours" type by checking `kpi.name` (same logic as UI — `availIds` = kpis containing "available", `soldIds` = kpis containing "sold")
- Render a **navy separator** row with "Σ Totals"
- Render **Available Hours row** — per-week sums across all owners, Q-Total = sum
- Render **Sold Hours row** — per-week sums across all owners, Q-Total = sum
- Render **Productivity row** — per-week = (totalSold / totalAvail * 100), Q-Total = (sumSold / sumAvail * 100), with green/amber/red color cells (using the same thresholds as UI)

### 2. Add color indicators to Q-Total column

The current `qtotalCellStyle` is plain gray. For each KPI row's Q-Total, compute the variance vs target and apply the same green/amber/red background as weekly cells. The Productivity row's Q-Total specifically needs the `calcProductiveStatus` logic.

### 3. Shrink font size further

Reduce `baseFontSize` for weekly from `"9px"` to `"8px"` and tighten `padding` in cell styles from `5px 6px` to `3px 4px` to make the table more compact overall.

---

## Changes to `supabase/functions/send-scorecard-email/index.ts`

### A. Shrink font/padding (~lines 623, 628-633)
- `baseFontSize` weekly: `"9px"` → `"8px"`
- `navyHeaderStyle`, `navyTargetStyle` padding: `5px 6px` → `3px 4px`
- `kpiNameStyle` padding: `5px 8px` → `3px 5px`

### B. Color Q-Total cells for KPI rows (~line 775)
Change the Q-Total cell from always using `qtotalCellStyle` (plain gray) to computing color based on variance, same as weekly cells but calling `getCellStyle(qCellClass, baseFontSize, true)`.

### C. Replace the single Σ Totals row with the 4-row UI-matching section (~lines 779-787)

**New logic:**
```typescript
// Before the forEach loop, also track per-week sums for avail/sold KPIs
// Detect avail/sold KPI IDs by name matching (same as ScorecardGrid)
const allKpis = Array.from(kpisByOwner.values()).flat();
const availKpiIds = allKpis.filter(k => k.name.toLowerCase().includes('available')).map(k => k.id);
const soldKpiIds = allKpis.filter(k => k.name.toLowerCase().includes('sold')).map(k => k.id);

// Accumulate per-week totals separately for avail and sold
const weekAvailTotals: (number|null)[] = periods.map(() => null);
const weekSoldTotals: (number|null)[] = periods.map(() => null);
// ... fill during the KPI loop (check if kpi.id in availKpiIds/soldKpiIds)

// After the owner forEach loop, render 4-row totals:
// Row 1: navy "Σ Totals" separator
// Row 2: Available Hours — per-week sums, Q-Total sum, no color (or green if above target)
// Row 3: Sold Hours — per-week sums, Q-Total sum
// Row 4: Productivity — (sold/avail*100) per week, color-coded
```

The productive target comes from the existing `productiveTarget` value found in `kpis` — find a KPI with `metric_type === 'percentage'` and name containing 'product' to get its target.
