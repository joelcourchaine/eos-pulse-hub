
## Problem

The `buildScorecardSection` in `send-combined-report-email/index.ts` is a stripped-down version that:
1. Never fetches `profiles` — so it can't look up technician names for owner separator rows
2. Never groups KPIs by owner — shows a flat list with no name headers
3. Never adds a Q-Total column
4. Never renders the Σ Totals section with color-coded Productivity rows

The full implementation in `send-scorecard-email/index.ts` has all of this (lines 558–853 there). We need to port it into the combined report's `buildScorecardSection`.

## Fix — `supabase/functions/send-combined-report-email/index.ts`

Replace the current `buildScorecardSection` function (~lines 207–319) with a full-featured version that mirrors `send-scorecard-email`'s weekly rendering logic:

**1. Fetch profiles** to resolve `assigned_to` IDs to names:
```ts
const { data: profiles } = await supabase.from("profiles").select("id, full_name");
const profilesMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);
```

**2. Fetch KPI targets** for the quarter:
```ts
const { data: kpiTargets } = await supabase
  .from("kpi_targets")
  .select("kpi_id, target_value")
  .eq("year", year).eq("quarter", quarter)
  .in("kpi_id", kpiIds);
const kpiTargetsMap = new Map(kpiTargets?.map((t: any) => [t.kpi_id, t.target_value]) || []);
```

**3. Group KPIs by owner** and apply `roleFilter` (keep existing role filtering logic).

**4. Weekly mode rendering** — mirror `send-scorecard-email` exactly:
- Single table with one header row (KPI + Target + WK1…WK13 + Q-Total)
- Navy owner separator rows with technician names
- Per-KPI rows with color-coded weekly cells and a Q-Total cell
- Σ Totals section: Available Hours row, Open and Closed Hours row, Productivity row (all color-coded vs target)

**Helper functions to port** (already exist in combined email file, just need to sync):
- `formatScorecardValue` → use the richer `formatValue` from send-scorecard-email (handles special KPI names)
- `getCellStyle` → add weekly saturated colors (green=#059669, yellow=#d97706, red=#dc2626)

The non-weekly (monthly/quarterly/yearly) path can remain as-is since the screenshot only shows weekly mode issues.

## Scope

Single file change: `supabase/functions/send-combined-report-email/index.ts`
- Replace lines 160–319 (the `formatScorecardValue` helper + `buildScorecardSection` function) with the full implementation
