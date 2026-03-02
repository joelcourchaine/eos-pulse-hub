
## Plan: Add "Totals" row to the technician scorecard

### What it needs to do
- After all owner groups are rendered, append a **"Totals"** section styled exactly like an owner header row followed by three KPI rows: "Available Hours", "Sold Hours" (or however it's named), and "Productive" (calculated as total Sold / total Available).
- Only show the Totals section when the **role filter is set to "Service Technician"** (or when the visible KPIs are technician KPIs — specifically when the filtered KPI set contains all three technician KPI names). This avoids polluting other scorecards.
- For each period column (weekly, monthly, quarterly, yearly), sum the values of all `filteredKpis` with that KPI name across all owners, then display the sum (or ratio for Productive).

### How to detect "technician view"
Check if `filteredKpis` contains KPIs named "Available Hours" and (any variation of Sold Hours). Use a simple set intersection: `filteredKpis.some(k => k.name === "Available Hours")`.

### Implementation location
`src/components/scorecard/ScorecardGrid.tsx` — just before the closing `</TableBody>` at line 5374.

### Logic for totals computation (inline, no new state)

For each distinct KPI name in `["Available Hours", "Sold Hours", "Productive"]`:
- Get all `filteredKpis` where `k.name === kpiName` (these are all technicians' individual KPI rows)
- For **weekly** view: for each week, sum `entries[kpiId + weekDate]?.actual_value` across all those KPIs
- For **monthly** view: for each month, sum `monthlyViewEntries[kpiId + monthId]?.actual_value`
- For **Productive**: don't sum — instead compute `totalSold / totalAvailable` for each period
- Display using the same `formatValue`/`formatTarget` helpers already used inline

### Rows to render
1. **Owner header row** — shows a "Σ Totals" label with a distinct background (e.g., `bg-slate-700` dark navy), styled like a regular owner header but not draggable.
2. **"Available Hours" KPI row** — sums Available Hours across all technicians per period
3. **"Sold Hours" KPI row** — sums Sold Hours (find by name matching "Sold Hours" in filtered KPIs)
4. **"Productive" KPI row** — calculates Sold / Available ratio as a percentage, colored green/yellow/red if a target exists

### Files to change
- **`src/components/scorecard/ScorecardGrid.tsx`** — add the totals section (owner header + 3 KPI rows) immediately before `</TableBody>` (~line 5374). All computation is inline within the JSX since it uses the same `entries`/`monthlyViewEntries` lookups already present in the file.

### Key details
- The Totals rows are **read-only** — no input editing, no drag handles, no context menu
- The "Productive" total row displays as a percentage (`metric_type = "percentage"`)
- The totals section only renders when `filteredKpis.some(k => k.name === "Available Hours")` — otherwise invisible
- All column spans and sticky positioning mirror the existing owner header row structure to align correctly across all view modes (weekly, monthly, quarterly, yearly)
