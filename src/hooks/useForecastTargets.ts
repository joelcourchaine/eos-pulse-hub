import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ForecastTargetResult {
  value: number;
  direction: "above" | "below";
  source: "manual" | "forecast";
}

/**
 * Hook to fetch forecast entries for use as fallback targets on the Financial Summary.
 * Returns a Map keyed by `{metricName}:{monthIdentifier}` → forecast_value.
 */
export const useForecastTargets = (departmentId: string, year: number) => {
  const [forecastTargets, setForecastTargets] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);

  const fetchForecastTargets = useCallback(async () => {
    if (!departmentId || !year) return;

    setLoading(true);
    try {
      // Step 1: Get forecast for this department + year
      const { data: forecasts, error: forecastError } = await supabase
        .from("department_forecasts")
        .select("id")
        .eq("department_id", departmentId)
        .eq("forecast_year", year)
        .limit(1);

      if (forecastError || !forecasts || forecasts.length === 0) {
        setForecastTargets(new Map());
        return;
      }

      const forecastId = forecasts[0].id;

      // Step 2: Get all forecast entries with non-null forecast_value
      const allRows: { metric_name: string; month: string; forecast_value: number }[] = [];
      let from = 0;
      const pageSize = 1000;

      while (true) {
        const { data: page, error: pageError } = await supabase
          .from("forecast_entries")
          .select("metric_name, month, forecast_value")
          .eq("forecast_id", forecastId)
          .not("forecast_value", "is", null)
          .range(from, from + pageSize - 1);

        if (pageError) {
          console.error("Error fetching forecast entries:", pageError);
          break;
        }
        if (!page || page.length === 0) break;

        allRows.push(...(page as { metric_name: string; month: string; forecast_value: number }[]));
        if (page.length < pageSize) break;
        from += pageSize;
      }

      // Build the map
      const map = new Map<string, number>();
      for (const row of allRows) {
        if (row.forecast_value !== null && row.forecast_value !== undefined) {
          map.set(`${row.metric_name}:${row.month}`, row.forecast_value);
        }
      }

      setForecastTargets(map);
    } finally {
      setLoading(false);
    }
  }, [departmentId, year]);

  useEffect(() => {
    fetchForecastTargets();
  }, [fetchForecastTargets]);

  /**
   * Get the forecast target value for a given metric and month.
   */
  const getForecastTarget = useCallback(
    (metricKey: string, monthId: string): number | null => {
      return forecastTargets.get(`${metricKey}:${monthId}`) ?? null;
    },
    [forecastTargets]
  );

  /**
   * Check if forecast targets are available (i.e., a forecast exists for this dept/year).
   */
  const hasForecastTargets = useMemo(() => forecastTargets.size > 0, [forecastTargets]);

  return {
    forecastTargets,
    getForecastTarget,
    hasForecastTargets,
    loading,
    refetch: fetchForecastTargets,
  };
};
