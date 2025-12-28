import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SubMetricTarget {
  metricName: string; // Full metric name: sub:{parent_key}:{order_index}:{name}
  parentMetricKey: string;
  subMetricName: string;
  quarter: number;
  year: number;
  targetValue: number;
  targetDirection: "above" | "below";
}

/**
 * Hook to fetch and manage sub-metric targets for a department
 */
export const useSubMetricTargets = (departmentId: string) => {
  const [subMetricTargets, setSubMetricTargets] = useState<SubMetricTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const isMountedRef = useRef(true);

  const fetchSubMetricTargets = useCallback(async () => {
    if (!departmentId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('financial_targets')
        .select('*')
        .eq('department_id', departmentId)
        .like('metric_name', 'sub:%');

      if (error) {
        console.error('Error fetching sub-metric targets:', error);
        return;
      }

      if (!isMountedRef.current) return;

      const parsed: SubMetricTarget[] = [];
      data?.forEach((entry) => {
        // Format: sub:{parent_key}:{order_index}:{name}
        const parts = entry.metric_name.split(':');
        if (parts.length >= 4) {
          const parentKey = parts[1];
          const name = parts.slice(3).join(':');
          parsed.push({
            metricName: entry.metric_name,
            parentMetricKey: parentKey,
            subMetricName: name,
            quarter: entry.quarter,
            year: entry.year,
            targetValue: entry.target_value || 0,
            targetDirection: (entry.target_direction as "above" | "below") || "above",
          });
        } else if (parts.length >= 3) {
          // Legacy format without order index
          const parentKey = parts[1];
          const name = parts.slice(2).join(':');
          parsed.push({
            metricName: entry.metric_name,
            parentMetricKey: parentKey,
            subMetricName: name,
            quarter: entry.quarter,
            year: entry.year,
            targetValue: entry.target_value || 0,
            targetDirection: (entry.target_direction as "above" | "below") || "above",
          });
        }
      });

      setSubMetricTargets(parsed);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [departmentId]);

  // Track mount state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch whenever department changes
  useEffect(() => {
    fetchSubMetricTargets();
  }, [fetchSubMetricTargets]);

  const getSubMetricTarget = useCallback(
    (parentMetricKey: string, subMetricName: string, quarter: number, year: number): number | null => {
      const entry = subMetricTargets.find(
        (t) =>
          t.parentMetricKey === parentMetricKey && 
          t.subMetricName === subMetricName && 
          t.quarter === quarter &&
          t.year === year
      );
      return entry?.targetValue ?? null;
    },
    [subMetricTargets]
  );

  const saveSubMetricTarget = useCallback(
    async (
      parentMetricKey: string,
      subMetricName: string,
      orderIndex: number,
      quarter: number,
      year: number,
      targetValue: number,
      targetDirection: "above" | "below" = "above"
    ): Promise<boolean> => {
      if (!departmentId) return false;

      const metricName = `sub:${parentMetricKey}:${orderIndex}:${subMetricName}`;

      const { error } = await supabase
        .from('financial_targets')
        .upsert({
          department_id: departmentId,
          metric_name: metricName,
          quarter,
          year,
          target_value: targetValue,
          target_direction: targetDirection,
        }, {
          onConflict: "department_id,metric_name,quarter,year",
        });

      if (error) {
        console.error('Error saving sub-metric target:', error);
        return false;
      }

      // Refresh targets
      await fetchSubMetricTargets();
      return true;
    },
    [departmentId, fetchSubMetricTargets]
  );

  return {
    subMetricTargets,
    loading,
    getSubMetricTarget,
    saveSubMetricTarget,
    refetch: fetchSubMetricTargets,
  };
};
