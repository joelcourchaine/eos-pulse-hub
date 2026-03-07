
## Root Cause

The `useForecastTargets` hook has a broken Supabase query. The JS client's dot-notation filter `.eq("department_forecasts.department_id", departmentId)` on an embedded join **only filters the embedded record**, it does NOT filter which `forecast_entries` rows are returned. This means **all 37,000+ forecast entries across every department for 2026** are fetched, and the map gets populated with random values that overwrite each other — the target column ends up showing the wrong data (from whichever department happened to write last for that `metric_name:month` key).

The refetch-on-close works correctly, but since the underlying query is broken, re-running it just refetches the same wrong data.

## Fix

Two-step query in `useForecastTargets`:
1. First, look up the `forecast_id` for `(departmentId, year)` — this is a single cheap row from `department_forecasts`
2. Then fetch `forecast_entries` filtered directly by `forecast_id` — this guarantees only the correct department's entries

This matches the architecture memory note about using single-pass joins but fixes the filter scoping issue.

```ts
// Step 1: get the forecast ID for this specific dept/year
const { data: forecastRow } = await supabase
  .from("department_forecasts")
  .select("id")
  .eq("department_id", departmentId)
  .eq("forecast_year", year)
  .maybeSingle();

if (!forecastRow) return; // No forecast for this dept/year — map stays empty

// Step 2: paginate forecast_entries filtered by that forecast_id
const { data: page } = await supabase
  .from("forecast_entries")
  .select("metric_name, month, forecast_value")
  .eq("forecast_id", forecastRow.id)
  .not("forecast_value", "is", null)
  .range(from, from + pageSize - 1);
```

## File to change

- `src/hooks/useForecastTargets.ts` — replace the paginated query block with the two-step approach above
