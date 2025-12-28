import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SubMetricEntry {
  name: string;
  parentMetricKey: string;
  monthIdentifier: string;
  value: number | null;
}

/**
 * Hook to fetch and manage sub-metrics for a department
 * Sub-metrics are stored with naming convention: sub:{parent_key}:{name}
 */
export const useSubMetrics = (departmentId: string, monthIdentifiers: string[]) => {
  const [subMetrics, setSubMetrics] = useState<SubMetricEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  // Stabilize the month identifiers to prevent unnecessary re-fetches
  const stableMonthIds = useMemo(() => {
    return [...monthIdentifiers].sort().join(',');
  }, [monthIdentifiers]);

  const fetchSubMetrics = useCallback(async () => {
    if (!departmentId || !stableMonthIds) return;
    
    // Prevent duplicate fetches
    if (hasFetched) return;
    
    setLoading(true);
    setHasFetched(true);
    
    try {
      const monthList = stableMonthIds.split(',').filter(Boolean);
      if (monthList.length === 0) return;
      
      // Fetch all financial entries that start with "sub:"
      const { data, error } = await supabase
        .from('financial_entries')
        .select('metric_name, month, value')
        .eq('department_id', departmentId)
        .in('month', monthList)
        .like('metric_name', 'sub:%');

      if (error) {
        console.error('Error fetching sub-metrics:', error);
        return;
      }

      // Parse the sub-metric entries
      const parsed: SubMetricEntry[] = [];
      data?.forEach(entry => {
        // Parse metric_name format: sub:{parent_key}:{name}
        const parts = entry.metric_name.split(':');
        if (parts.length >= 3) {
          const parentKey = parts[1];
          const name = parts.slice(2).join(':'); // Handle names that might contain colons
          parsed.push({
            name,
            parentMetricKey: parentKey,
            monthIdentifier: entry.month,
            value: entry.value,
          });
        }
      });

      setSubMetrics(parsed);
    } finally {
      setLoading(false);
    }
  }, [departmentId, stableMonthIds, hasFetched]);

  // Reset hasFetched when key dependencies change
  useEffect(() => {
    setHasFetched(false);
  }, [departmentId, stableMonthIds]);

  useEffect(() => {
    fetchSubMetrics();
  }, [fetchSubMetrics]);

  // Get unique sub-metric names for a parent metric
  const getSubMetricNames = useCallback((parentMetricKey: string): string[] => {
    const names = new Set<string>();
    subMetrics
      .filter(sm => sm.parentMetricKey === parentMetricKey)
      .forEach(sm => names.add(sm.name));
    return Array.from(names);
  }, [subMetrics]);

  // Get value for a specific sub-metric and month
  const getSubMetricValue = useCallback((parentMetricKey: string, subMetricName: string, monthId: string): number | null => {
    const entry = subMetrics.find(
      sm => sm.parentMetricKey === parentMetricKey && 
            sm.name === subMetricName && 
            sm.monthIdentifier === monthId
    );
    return entry?.value ?? null;
  }, [subMetrics]);

  // Check if a parent metric has any sub-metrics
  const hasSubMetrics = useCallback((parentMetricKey: string): boolean => {
    return subMetrics.some(sm => sm.parentMetricKey === parentMetricKey);
  }, [subMetrics]);

  return {
    subMetrics,
    loading,
    getSubMetricNames,
    getSubMetricValue,
    hasSubMetrics,
    refetch: fetchSubMetrics,
  };
};
