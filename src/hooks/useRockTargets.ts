import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface RockMonthlyTarget {
  id: string;
  rock_id: string;
  month: string;
  target_value: number;
}

interface RockWithTargets {
  id: string;
  title: string;
  description: string | null;
  linked_metric_key: string | null;
  linked_metric_type: "metric" | "submetric" | null;
  linked_submetric_name: string | null;
  linked_parent_metric_key: string | null;
  target_direction: "above" | "below";
  progress_percentage: number;
  status: string;
  quarter: number;
  year: number;
  department_id: string;
  monthly_targets: RockMonthlyTarget[];
}

interface RockTargetStatus {
  rock: RockWithTargets;
  target: RockMonthlyTarget;
  actualValue: number | null;
  status: "met" | "missed" | "pending" | "close";
}

export function useRockTargets(
  departmentId: string | undefined, 
  quarter: number, 
  year: number,
  allQuarters: boolean = false
) {
  const [rocksWithMetrics, setRocksWithMetrics] = useState<RockWithTargets[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRocksWithTargets = useCallback(async () => {
    if (!departmentId) {
      setRocksWithMetrics([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Fetch rocks with linked metrics for this quarter/year (or all quarters in the year)
      let query = supabase
        .from("rocks")
        .select("*")
        .eq("department_id", departmentId)
        .eq("year", year)
        .not("linked_metric_key", "is", null);
      
      // Only filter by quarter if not fetching all quarters
      if (!allQuarters) {
        query = query.eq("quarter", quarter);
      }
      
      const { data: rocks, error: rocksError } = await query;

      if (rocksError) {
        console.error("Error fetching rocks:", rocksError);
        setRocksWithMetrics([]);
        setLoading(false);
        return;
      }

      if (!rocks || rocks.length === 0) {
        setRocksWithMetrics([]);
        setLoading(false);
        return;
      }

      // Fetch monthly targets for these rocks
      const rockIds = rocks.map((r) => r.id);
      const { data: targets, error: targetsError } = await supabase
        .from("rock_monthly_targets")
        .select("*")
        .in("rock_id", rockIds);

      if (targetsError) {
        console.error("Error fetching rock targets:", targetsError);
      }

      // Combine rocks with their targets
      const rocksWithTargets: RockWithTargets[] = rocks.map((rock) => ({
        id: rock.id,
        title: rock.title,
        description: rock.description,
        linked_metric_key: rock.linked_metric_key,
        linked_metric_type: rock.linked_metric_type as "metric" | "submetric" | null,
        linked_submetric_name: rock.linked_submetric_name,
        linked_parent_metric_key: rock.linked_parent_metric_key,
        target_direction: (rock.target_direction || "above") as "above" | "below",
        progress_percentage: rock.progress_percentage || 0,
        status: rock.status || "on_track",
        quarter: rock.quarter,
        year: rock.year,
        department_id: rock.department_id,
        monthly_targets: (targets || [])
          .filter((t) => t.rock_id === rock.id)
          .map((t) => ({
            id: t.id,
            rock_id: t.rock_id,
            month: t.month,
            target_value: Number(t.target_value),
          })),
      }));

      setRocksWithMetrics(rocksWithTargets);
    } catch (err) {
      console.error("Error in fetchRocksWithTargets:", err);
      setRocksWithMetrics([]);
    } finally {
      setLoading(false);
    }
  }, [departmentId, quarter, year, allQuarters]);

  useEffect(() => {
    fetchRocksWithTargets();
  }, [fetchRocksWithTargets]);

  // Check if a metric has a linked rock
  const hasRockForMetric = useCallback(
    (metricKey: string): boolean => {
      return rocksWithMetrics.some(
        (r) => r.linked_metric_type === "metric" && r.linked_metric_key === metricKey
      );
    },
    [rocksWithMetrics]
  );

  // Check if a sub-metric has a linked rock
  const hasRockForSubMetric = useCallback(
    (parentKey: string, subMetricName: string): boolean => {
      return rocksWithMetrics.some(
        (r) =>
          r.linked_metric_type === "submetric" &&
          r.linked_parent_metric_key === parentKey &&
          r.linked_submetric_name === subMetricName
      );
    },
    [rocksWithMetrics]
  );

  // Get rock for a specific metric
  const getRockForMetric = useCallback(
    (metricKey: string): RockWithTargets | null => {
      return (
        rocksWithMetrics.find(
          (r) => r.linked_metric_type === "metric" && r.linked_metric_key === metricKey
        ) || null
      );
    },
    [rocksWithMetrics]
  );

  // Get rock for a specific sub-metric
  const getRockForSubMetric = useCallback(
    (parentKey: string, subMetricName: string): RockWithTargets | null => {
      return (
        rocksWithMetrics.find(
          (r) =>
            r.linked_metric_type === "submetric" &&
            r.linked_parent_metric_key === parentKey &&
            r.linked_submetric_name === subMetricName
        ) || null
      );
    },
    [rocksWithMetrics]
  );

  // Get target value for a specific metric and month
  const getRockTargetForCell = useCallback(
    (metricKey: string, month: string): number | null => {
      const rock = getRockForMetric(metricKey);
      if (!rock) return null;

      const target = rock.monthly_targets.find((t) => t.month === month);
      return target ? target.target_value : null;
    },
    [getRockForMetric]
  );

  // Get target value for a specific sub-metric and month
  const getRockTargetForSubMetricCell = useCallback(
    (parentKey: string, subMetricName: string, month: string): number | null => {
      const rock = getRockForSubMetric(parentKey, subMetricName);
      if (!rock) return null;

      const target = rock.monthly_targets.find((t) => t.month === month);
      return target ? target.target_value : null;
    },
    [getRockForSubMetric]
  );

  // Calculate status for a rock target based on actual value
  const calculateTargetStatus = useCallback(
    (
      targetValue: number,
      actualValue: number | null,
      direction: "above" | "below"
    ): "met" | "missed" | "pending" | "close" => {
      if (actualValue === null) return "pending";

      const variance = ((actualValue - targetValue) / Math.abs(targetValue)) * 100;

      if (direction === "above") {
        if (actualValue >= targetValue) return "met";
        if (variance >= -10) return "close";
        return "missed";
      } else {
        if (actualValue <= targetValue) return "met";
        if (variance <= 10) return "close";
        return "missed";
      }
    },
    []
  );

  return {
    rocksWithMetrics,
    loading,
    refetch: fetchRocksWithTargets,
    hasRockForMetric,
    hasRockForSubMetric,
    getRockForMetric,
    getRockForSubMetric,
    getRockTargetForCell,
    getRockTargetForSubMetricCell,
    calculateTargetStatus,
  };
}
