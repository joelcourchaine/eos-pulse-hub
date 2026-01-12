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

      // IMPORTANT: financial_entries can easily exceed the default 1000 row query limit
      // when sub-metrics are present across many months. We must paginate.
      const pageSize = 1000;
      let from = 0;
      const allRows: Array<{ metric_name: string; month: string; value: number | null }> = [];

      while (true) {
        const { data: pageData, error: pageError } = await supabase
          .from('financial_entries')
          .select('metric_name, month, value')
          .eq('department_id', departmentId)
          .in('month', monthList)
          .like('metric_name', 'sub:%')
          // Use deterministic ordering so pagination doesn't miss/duplicate rows
          .order('month', { ascending: true })
          .order('metric_name', { ascending: true })
          .range(from, from + pageSize - 1);

        if (pageError) {
          console.error('Error fetching sub-metrics:', pageError);
          return;
        }

        if (!pageData || pageData.length === 0) break;
        allRows.push(...pageData);

        if (pageData.length < pageSize) break;
        from += pageSize;
      }

      if (!isMountedRef.current) return;

      const parsed: SubMetricEntry[] = [];
      allRows.forEach((entry) => {
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

      // Sort by order index (and keep a stable order for same orderIndex)
      parsed.sort((a, b) => {
        if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
        if (a.parentMetricKey !== b.parentMetricKey) return a.parentMetricKey.localeCompare(b.parentMetricKey);
        if (a.name !== b.name) return a.name.localeCompare(b.name);
        return a.monthIdentifier.localeCompare(b.monthIdentifier);
      });

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
  // Track the months we're watching for realtime updates
  const watchedMonthsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    watchedMonthsRef.current = new Set(stableMonthIds.split(',').filter(Boolean));
  }, [stableMonthIds]);

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
            // Only process deletes for months we're currently watching
            // This prevents stale events from other import operations affecting our view
            if (!watchedMonthsRef.current.has(rowOld.month)) return;
            
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
            // Only process inserts/updates for months we're currently watching
            if (!watchedMonthsRef.current.has(rowNew.month)) return;
            
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
      
      // Special case: For gp_percent, include "Unapplied Time" if it exists in gp_net
      // This enables calculated sub-metrics that derive from other parent metrics
      if (parentMetricKey === 'gp_percent') {
        const gpNetSubMetrics = subMetrics.filter((sm) => sm.parentMetricKey === 'gp_net');
        for (const sm of gpNetSubMetrics) {
          if (sm.name === 'Unapplied Time' && !seen.has(sm.name)) {
            seen.add(sm.name);
            orderedNames.push(sm.name);
          }
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

  /**
   * Sum all sub-metric values for a given parent metric and month.
   * Returns null if no sub-metrics exist for that parent/month combination.
   */
  const getSubMetricSum = useCallback(
    (parentMetricKey: string, monthId: string): number | null => {
      const relevantSubMetrics = subMetrics.filter(
        (sm) => sm.parentMetricKey === parentMetricKey && sm.monthIdentifier === monthId
      );
      if (relevantSubMetrics.length === 0) return null;
      
      let sum = 0;
      for (const sm of relevantSubMetrics) {
        if (sm.value !== null && sm.value !== undefined) {
          sum += sm.value;
        }
      }
      return sum;
    },
    [subMetrics]
  );

  /**
   * Get a calculated sub-metric value (e.g., Unapplied Time GP % = Unapplied Time GP Net / Total Sales)
   * This handles special cases where sub-metrics need to be derived from other values.
   */
  const getCalculatedSubMetricValue = useCallback(
    (
      parentMetricKey: string,
      subMetricName: string,
      monthId: string,
      getFinancialValue: (metricKey: string, monthId: string) => number | null
    ): number | null => {
      // Special case: Unapplied Time GP % = Unapplied Time GP Net / Total Sales
      if (parentMetricKey === 'gp_percent' && subMetricName === 'Unapplied Time') {
        const unappliedTimeGpNet = getSubMetricValue('gp_net', 'Unapplied Time', monthId);
        const totalSales = getFinancialValue('total_sales', monthId);
        
        if (unappliedTimeGpNet !== null && totalSales !== null && totalSales !== 0) {
          return (unappliedTimeGpNet / totalSales) * 100; // Return as percentage
        }
        return null;
      }
      
      // Default: return the actual stored value
      return getSubMetricValue(parentMetricKey, subMetricName, monthId);
    },
    [getSubMetricValue]
  );

  /**
   * Save a sub-metric value to the database.
   * Creates or updates the entry using upsert.
   * When a statement is uploaded, it will override these manual entries.
   */
  const saveSubMetricValue = useCallback(
    async (
      parentMetricKey: string,
      subMetricName: string,
      monthId: string,
      value: number | null,
      orderIndex: number = 999
    ): Promise<boolean> => {
      if (!departmentId) return false;

      const metricName = `sub:${parentMetricKey}:${String(orderIndex).padStart(3, '0')}:${subMetricName}`;

      try {
        const { data: session } = await supabase.auth.getSession();
        const userId = session.session?.user?.id;

        if (value === null) {
          // Delete the entry if value is null
          const { error } = await supabase
            .from('financial_entries')
            .delete()
            .eq('department_id', departmentId)
            .eq('month', monthId)
            .eq('metric_name', metricName);

          if (error) {
            console.error('Error deleting sub-metric:', error);
            return false;
          }
        } else {
          // Upsert the entry
          const { error } = await supabase
            .from('financial_entries')
            .upsert(
              {
                department_id: departmentId,
                month: monthId,
                metric_name: metricName,
                value: value,
                created_by: userId,
              },
              {
                onConflict: 'department_id,month,metric_name',
              }
            );

          if (error) {
            console.error('Error saving sub-metric:', error);
            return false;
          }
        }

        return true;
      } catch (err) {
        console.error('Error in saveSubMetricValue:', err);
        return false;
      }
    },
    [departmentId]
  );

  /**
   * Create a new sub-metric entry (for when user adds a new sub-metric manually).
   */
  const addSubMetric = useCallback(
    async (
      parentMetricKey: string,
      subMetricName: string,
      monthId: string,
      value: number | null
    ): Promise<boolean> => {
      if (!departmentId) return false;

      // Find the next order index for this parent metric
      const existingForParent = subMetrics.filter(sm => sm.parentMetricKey === parentMetricKey);
      const maxOrderIndex = existingForParent.length > 0 
        ? Math.max(...existingForParent.map(sm => sm.orderIndex))
        : -1;
      const newOrderIndex = maxOrderIndex + 1;

      return saveSubMetricValue(parentMetricKey, subMetricName, monthId, value, newOrderIndex);
    },
    [departmentId, subMetrics, saveSubMetricValue]
  );

  return {
    subMetrics,
    loading,
    getSubMetricNames,
    getSubMetricValue,
    hasSubMetrics,
    getSubMetricSum,
    getCalculatedSubMetricValue,
    saveSubMetricValue,
    addSubMetric,
    refetch: fetchSubMetrics,
  };
};
