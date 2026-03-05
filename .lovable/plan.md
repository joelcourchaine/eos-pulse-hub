
## Root Cause — The `entry_type` filter is silently discarded

The Supabase JS query builder is **immutable** — every chained method returns a new object. In the edge function:

```ts
const kpiTargetsQuery = supabase
  .from("kpi_targets")
  .select("kpi_id, target_value")
  .eq("year", year)
  .eq("quarter", quarter)
  .in("kpi_id", kpiIds);

if (isWeeklyMode) kpiTargetsQuery.eq("entry_type", "weekly"); // ← BUG: result is thrown away
const { data: kpiTargets } = await kpiTargetsQuery; // ← runs WITHOUT the entry_type filter
```

Because `kpiTargetsQuery.eq(...)` returns a **new** builder (which is discarded), `kpiTargetsQuery` is still the original unfiltered query. So monthly targets (e.g. 40 hrs for Available Hours) are always included in the map — even in weekly mode — and cells that should be uncolored get colored red.

The fix is one line: reassign the result of `.eq("entry_type", "weekly")`:

```ts
if (isWeeklyMode) kpiTargetsQuery = kpiTargetsQuery.eq("entry_type", "weekly");
```

This requires changing `const` → `let`.

## Fix — `supabase/functions/send-combined-report-email/index.ts`

**Lines ~257-267:** Change `const kpiTargetsQuery` to `let kpiTargetsQuery` and reassign the chained result:

```ts
let kpiTargetsQuery = supabase
  .from("kpi_targets")
  .select("kpi_id, target_value")
  .eq("year", year)
  .eq("quarter", quarter)
  .in("kpi_id", kpiIds);
// Must reassign — Supabase query builder is immutable; chained calls return a new object
if (isWeeklyMode) kpiTargetsQuery = kpiTargetsQuery.eq("entry_type", "weekly");
const { data: kpiTargets } = await kpiTargetsQuery;
```

Also, the UI's `hasTarget` check uses `targetValue !== 0` — cells with a target of exactly `0` are treated as having no target and show no color. The email already handles this correctly via `if (targetValue !== null && targetValue !== 0)`, so no additional change needed there.

## Scope

Single targeted fix: `supabase/functions/send-combined-report-email/index.ts` lines ~257-266 (change `const` to `let`, reassign the `.eq()` result).
