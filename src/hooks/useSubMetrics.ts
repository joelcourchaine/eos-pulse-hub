import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SubMetricEntry {
  name: string;
  parentMetricKey: string;
  monthIdentifier: string;
  value: number | null;
  orderIndex: number; // Preserves Excel statement order
}

/**
 * Hook to fetch and manage sub-metrics for a department
 * Sub-metrics are stored with naming convention: sub:{parent_key}:{name}
 */
export const useSubMetrics = (departmentId: string, monthIdentifiers: string[]) => {
  const [subMetrics, setSubMetrics] = useState<SubMetricEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const isMountedRef = useRef(true);

  // Stabilize the month identifiers to prevent unnecessary re-fetches
  const stableMonthIds = useMemo(() => {
    return [...monthIdentifiers].sort().join(',');
  }, [monthIdentifiers]);

  const fetchSubMetrics = useCallback(async () => {
    if (!departmentId || !stableMonthIds) return;

    setLoading(true);
    try {
      const monthList = stableMonthIds.split(',').filter(Boolean);
      if (monthList.length === 0) return;

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

      if (!isMountedRef.current) return;

      const parsed: SubMetricEntry[] = [];
      data?.forEach((entry) => {
        // Format: sub:{parent_key}:{order_index}:{name}
        // Legacy format (no order): sub:{parent_key}:{name}
        const parts = entry.metric_name.split(':');
        if (parts.length >= 4) {
          // New format with order index
          const parentKey = parts[1];
          const orderIndex = parseInt(parts[2], 10) || 0;
          const name = parts.slice(3).join(':');
          parsed.push({
            name,
            parentMetricKey: parentKey,
            monthIdentifier: entry.month,
            value: entry.value,
            orderIndex,
          });
        } else if (parts.length >= 3) {
          // Legacy format without order index
          const parentKey = parts[1];
          const name = parts.slice(2).join(':');
          parsed.push({
            name,
            parentMetricKey: parentKey,
            monthIdentifier: entry.month,
            value: entry.value,
            orderIndex: 999, // Put legacy entries at the end
          });
        }
      });

      // Sort by order index
      parsed.sort((a, b) => a.orderIndex - b.orderIndex);

      setSubMetrics(parsed);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [departmentId, stableMonthIds]);

  // Track mount state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch whenever department/month-range changes
  useEffect(() => {
    fetchSubMetrics();
  }, [fetchSubMetrics]);

  // Live-update whenever sub-metrics are imported/changed
  useEffect(() => {
    if (!departmentId) return;

    const channel = supabase
      .channel(`sub-metrics:${departmentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'financial_entries',
          filter: `department_id=eq.${departmentId}`,
        },
        (payload) => {
          if (!isMountedRef.current) return;

          const rowNew = payload.new as any;
          const rowOld = payload.old as any;

          if (payload.eventType === 'DELETE') {
            if (!rowOld?.metric_name?.startsWith('sub:')) return;
            const parts = rowOld.metric_name.split(':');
            if (parts.length < 3) return;
            const parentKey = parts[1];
            const name = parts.length >= 4 ? parts.slice(3).join(':') : parts.slice(2).join(':');
            setSubMetrics((prev) =>
              prev.filter(
                (sm) => !(sm.parentMetricKey === parentKey && sm.name === name && sm.monthIdentifier === rowOld.month)
              )
            );
          } else {
            if (!rowNew?.metric_name?.startsWith('sub:')) return;
            const parts = rowNew.metric_name.split(':');
            if (parts.length < 3) return;
            const parentKey = parts[1];
            const orderIndex = parts.length >= 4 ? (parseInt(parts[2], 10) || 0) : 999;
            const name = parts.length >= 4 ? parts.slice(3).join(':') : parts.slice(2).join(':');
            const entry: SubMetricEntry = {
              parentMetricKey: parentKey,
              name,
              monthIdentifier: rowNew.month,
              value: rowNew.value ?? null,
              orderIndex,
            };
            setSubMetrics((prev) => {
              const idx = prev.findIndex(
                (sm) => sm.parentMetricKey === parentKey && sm.name === name && sm.monthIdentifier === rowNew.month
              );
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = entry;
                return next;
              }
              return [...prev, entry];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [departmentId]);

  const getSubMetricNames = useCallback(
    (parentMetricKey: string): string[] => {
      // Filter to parent, dedupe by name while preserving order
      const filtered = subMetrics.filter((sm) => sm.parentMetricKey === parentMetricKey);
      const seen = new Set<string>();
      const orderedNames: string[] = [];
      for (const sm of filtered) {
        if (!seen.has(sm.name)) {
          seen.add(sm.name);
          orderedNames.push(sm.name);
        }
      }
      return orderedNames;
    },
    [subMetrics]
  );

  const getSubMetricValue = useCallback(
    (parentMetricKey: string, subMetricName: string, monthId: string): number | null => {
      const entry = subMetrics.find(
        (sm) =>
          sm.parentMetricKey === parentMetricKey && sm.name === subMetricName && sm.monthIdentifier === monthId
      );
      return entry?.value ?? null;
    },
    [subMetrics]
  );

  const hasSubMetrics = useCallback(
    (parentMetricKey: string): boolean => {
      return subMetrics.some((sm) => sm.parentMetricKey === parentMetricKey);
    },
    [subMetrics]
  );

  return {
    subMetrics,
    loading,
    getSubMetricNames,
    getSubMetricValue,
    hasSubMetrics,
    refetch: fetchSubMetrics,
  };
};
