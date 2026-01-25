import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Forecast {
  id: string;
  department_id: string;
  forecast_year: number;
  name: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ForecastEntry {
  id: string;
  forecast_id: string;
  month: string;
  metric_name: string;
  baseline_value: number | null;
  forecast_value: number | null;
  is_locked: boolean;
}

export interface ForecastWeight {
  id: string;
  forecast_id: string;
  month_number: number;
  original_weight: number;
  adjusted_weight: number;
  is_locked: boolean;
}

export interface ForecastDriverSettings {
  id: string;
  forecast_id: string;
  growth_percent: number | null;
  sales_expense: number | null;
  fixed_expense: number | null;
}

export interface ForecastSubMetricOverride {
  id: string;
  forecast_id: string;
  sub_metric_key: string;
  parent_metric_key: string;
  overridden_annual_value: number;
}

export function useForecast(departmentId: string | undefined, year: number) {
  const queryClient = useQueryClient();

  // Fetch existing forecast for department and year
  const { data: forecast, isLoading: forecastLoading } = useQuery({
    queryKey: ['forecast', departmentId, year],
    queryFn: async () => {
      if (!departmentId) return null;
      
      const { data, error } = await supabase
        .from('department_forecasts')
        .select('*')
        .eq('department_id', departmentId)
        .eq('forecast_year', year)
        .maybeSingle();
      
      if (error) throw error;
      return data as Forecast | null;
    },
    enabled: !!departmentId,
  });

  // Fetch forecast entries
  const { data: entries, isLoading: entriesLoading } = useQuery({
    queryKey: ['forecast-entries', forecast?.id],
    queryFn: async () => {
      if (!forecast?.id) return [];
      
      const { data, error } = await supabase
        .from('forecast_entries')
        .select('*')
        .eq('forecast_id', forecast.id);
      
      if (error) throw error;
      return data as ForecastEntry[];
    },
    enabled: !!forecast?.id,
  });

  // Fetch forecast weights
  const { data: weights, isLoading: weightsLoading } = useQuery({
    queryKey: ['forecast-weights', forecast?.id],
    queryFn: async () => {
      if (!forecast?.id) return [];
      
      const { data, error } = await supabase
        .from('forecast_weights')
        .select('*')
        .eq('forecast_id', forecast.id)
        .order('month_number');
      
      if (error) throw error;
      return data as ForecastWeight[];
    },
    enabled: !!forecast?.id,
  });

  // Fetch driver settings
  const { data: driverSettings, isLoading: driverSettingsLoading } = useQuery({
    queryKey: ['forecast-driver-settings', forecast?.id],
    queryFn: async () => {
      if (!forecast?.id) return null;
      
      const { data, error } = await supabase
        .from('forecast_driver_settings')
        .select('*')
        .eq('forecast_id', forecast.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as ForecastDriverSettings | null;
    },
    enabled: !!forecast?.id,
  });

  // Fetch sub-metric overrides
  const { data: subMetricOverrides, isLoading: subMetricOverridesLoading } = useQuery({
    queryKey: ['forecast-submetric-overrides', forecast?.id],
    queryFn: async () => {
      if (!forecast?.id) return [];
      
      const { data, error } = await supabase
        .from('forecast_submetric_overrides')
        .select('*')
        .eq('forecast_id', forecast.id);
      
      if (error) throw error;
      return data as ForecastSubMetricOverride[];
    },
    enabled: !!forecast?.id,
  });

  // Create new forecast (or return existing one)
  const createForecast = useMutation({
    mutationFn: async (initialWeights: { month_number: number; weight: number }[]) => {
      if (!departmentId) throw new Error('Department ID required');

      // Check if forecast already exists to avoid duplicate key error
      const { data: existingForecast } = await supabase
        .from('department_forecasts')
        .select('*')
        .eq('department_id', departmentId)
        .eq('forecast_year', year)
        .maybeSingle();
      
      if (existingForecast) {
        // Forecast already exists, just return it
        return existingForecast as Forecast;
      }

      const { data: user } = await supabase.auth.getUser();
      
      // Create forecast
      const { data: newForecast, error: forecastError } = await supabase
        .from('department_forecasts')
        .insert({
          department_id: departmentId,
          forecast_year: year,
          created_by: user.user?.id,
        })
        .select()
        .single();
      
      if (forecastError) throw forecastError;

      // Create weights
      const weightInserts = initialWeights.map(w => ({
        forecast_id: newForecast.id,
        month_number: w.month_number,
        original_weight: w.weight,
        adjusted_weight: w.weight,
        is_locked: false,
      }));

      const { error: weightsError } = await supabase
        .from('forecast_weights')
        .insert(weightInserts);
      
      if (weightsError) throw weightsError;

      return newForecast as Forecast;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forecast', departmentId, year] });
      toast.success('Forecast created');
    },
    onError: (error) => {
      toast.error('Failed to create forecast: ' + error.message);
    },
  });

  // Update forecast entry
  const updateEntry = useMutation({
    mutationFn: async ({ 
      month, 
      metricName, 
      forecastValue,
      baselineValue,
      isLocked 
    }: { 
      month: string; 
      metricName: string; 
      forecastValue?: number | null;
      baselineValue?: number | null;
      isLocked?: boolean;
    }) => {
      if (!forecast?.id) throw new Error('No forecast');

      console.log('[updateEntry] called with:', { month, metricName, forecastValue, isLocked });

      // Check if entry exists
      const existing = entries?.find(e => e.month === month && e.metric_name === metricName);
      console.log('[updateEntry] existing entry:', existing ? { id: existing.id, is_locked: existing.is_locked } : 'none');

      if (existing) {
        const updates: Partial<ForecastEntry> = {};
        if (forecastValue !== undefined) updates.forecast_value = forecastValue;
        if (baselineValue !== undefined) updates.baseline_value = baselineValue;
        if (isLocked !== undefined) updates.is_locked = isLocked;

        console.log('[updateEntry] updating with:', updates);

        const { error } = await supabase
          .from('forecast_entries')
          .update(updates)
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        console.log('[updateEntry] inserting new entry with is_locked:', isLocked ?? false);
        const { error } = await supabase
          .from('forecast_entries')
          .insert({
            forecast_id: forecast.id,
            month,
            metric_name: metricName,
            forecast_value: forecastValue ?? null,
            baseline_value: baselineValue ?? null,
            is_locked: isLocked ?? false,
          });
        
        if (error) throw error;
      }
      
      return { month, metricName, isLocked };
    },
    onSuccess: (result) => {
      console.log('[updateEntry] success, result:', result);
      queryClient.invalidateQueries({ queryKey: ['forecast-entries', forecast?.id] });
    },
  });

  // Bulk update entries (for cascade calculations)
  // Important: do NOT invalidate+refetch on success, otherwise the recalculation layer
  // will often re-trigger autosaves due to identity changes in computed Maps.
  const bulkUpdateEntries = useMutation({
    mutationFn: async (updates: { month: string; metricName: string; forecastValue: number | null; baselineValue?: number | null; isLocked?: boolean }[]) => {
      if (!forecast?.id) throw new Error('No forecast');
      
      console.log('[bulkUpdateEntries] Starting mutation with', updates.length, 'updates');

      // Separate updates and inserts
      const updateOps: Promise<void>[] = [];
      const insertRows: {
        forecast_id: string;
        month: string;
        metric_name: string;
        forecast_value: number | null;
        baseline_value: number | null;
        is_locked: boolean;
      }[] = [];

      const existingEntries = entries ?? [];
      console.log('[bulkUpdateEntries] existingEntries count:', existingEntries.length);

      for (const update of updates) {
        const existing = existingEntries.find((e) => e.month === update.month && e.metric_name === update.metricName);

        if (existing) {
          // Allow update if:
          // 1. Entry is not locked, OR
          // 2. The update is explicitly setting isLocked: true (overwriting with a new locked value)
          const canUpdate = !existing.is_locked || update.isLocked === true;
          
          if (canUpdate) {
            const op = (async () => {
              const { error } = await supabase
                .from('forecast_entries')
                .update({
                  forecast_value: update.forecastValue,
                  ...(update.baselineValue !== undefined && { baseline_value: update.baselineValue }),
                  ...(update.isLocked !== undefined && { is_locked: update.isLocked }),
                })
                .eq('id', existing.id);
              if (error) throw error;
            })();
            updateOps.push(op);
          }
        } else {
          insertRows.push({
            forecast_id: forecast.id,
            month: update.month,
            metric_name: update.metricName,
            forecast_value: update.forecastValue,
            baseline_value: update.baselineValue ?? null,
            is_locked: update.isLocked ?? false,
          });
        }
      }

      console.log('[bulkUpdateEntries] Executing', updateOps.length, 'updates and inserting', insertRows.length, 'rows');
      await Promise.all(updateOps);

      if (insertRows.length > 0) {
        const { error } = await supabase.from('forecast_entries').insert(insertRows);
        if (error) throw error;
      }

      console.log('[bulkUpdateEntries] Mutation completed successfully');
      return { updates, insertRows };
    },
    onSuccess: (payload) => {
      console.log('[bulkUpdateEntries] onSuccess called with', payload.updates.length, 'updates');
      
      // Update cache in-place to prevent refetch loops
      const key = ['forecast-entries', forecast?.id] as const;
      queryClient.setQueryData(key, (prev: ForecastEntry[] | undefined) => {
        const current = prev ?? [];
        const map = new Map<string, ForecastEntry>(
          current.map((e) => [`${e.month}::${e.metric_name}`, e])
        );

        for (const u of payload.updates) {
          const k = `${u.month}::${u.metricName}`;
          const existing = map.get(k);
          if (existing) {
            map.set(k, {
              ...existing,
              forecast_value: u.forecastValue,
              baseline_value: u.baselineValue ?? existing.baseline_value,
              is_locked: u.isLocked ?? existing.is_locked,
            });
          } else {
            // Entry doesn't exist in cache but update was requested
            // This can happen if cache is stale - add it to ensure UI consistency
            map.set(k, {
              id: `temp_update_${u.month}_${u.metricName}`,
              forecast_id: forecast?.id ?? '',
              month: u.month,
              metric_name: u.metricName,
              forecast_value: u.forecastValue,
              baseline_value: u.baselineValue ?? null,
              is_locked: u.isLocked ?? false,
            });
          }
        }

        // We don't have IDs for inserted rows here (DB generated), but we also don't need them
        // for calculations. Add placeholder IDs so UI stays consistent until next real fetch.
        for (const ins of payload.insertRows) {
          const k = `${ins.month}::${ins.metric_name}`;
          if (!map.has(k)) {
            map.set(k, {
              id: `temp_${ins.month}_${ins.metric_name}`,
              forecast_id: ins.forecast_id,
              month: ins.month,
              metric_name: ins.metric_name,
              forecast_value: ins.forecast_value,
              baseline_value: ins.baseline_value,
              is_locked: ins.is_locked,
            });
          }
        }

        return Array.from(map.values());
      });

      // NOTE: Do NOT invalidate/refetch here - the in-place cache update above is sufficient
      // Invalidating causes a race condition where the refetch overwrites the cache before
      // the calculation engine can read the updated values
    },
  });

  // Update weight
  const updateWeight = useMutation({
    mutationFn: async ({ monthNumber, adjustedWeight, isLocked }: { monthNumber: number; adjustedWeight?: number; isLocked?: boolean }) => {
      if (!forecast?.id) throw new Error('No forecast');

      const weight = weights?.find(w => w.month_number === monthNumber);
      if (!weight) throw new Error('Weight not found');

      const updates: Partial<ForecastWeight> = {};
      if (adjustedWeight !== undefined) updates.adjusted_weight = adjustedWeight;
      if (isLocked !== undefined) updates.is_locked = isLocked;

      const { error } = await supabase
        .from('forecast_weights')
        .update(updates)
        .eq('id', weight.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forecast-weights', forecast?.id] });
    },
  });

  // Reset weights to original
  const resetWeights = useMutation({
    mutationFn: async () => {
      if (!forecast?.id || !weights) throw new Error('No forecast or weights');

      for (const weight of weights) {
        await supabase
          .from('forecast_weights')
          .update({ 
            adjusted_weight: weight.original_weight,
            is_locked: false,
          })
          .eq('id', weight.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forecast-weights', forecast?.id] });
      toast.success('Weights reset to original');
    },
  });

  // Save/update driver settings
  const saveDriverSettings = useMutation({
    mutationFn: async ({ 
      growthPercent, 
      salesExpense, 
      fixedExpense 
    }: { 
      growthPercent: number; 
      salesExpense: number; 
      fixedExpense: number;
    }) => {
      if (!forecast?.id) throw new Error('No forecast');

      const { error } = await supabase
        .from('forecast_driver_settings')
        .upsert({
          forecast_id: forecast.id,
          growth_percent: growthPercent,
          sales_expense: salesExpense,
          fixed_expense: fixedExpense,
        }, {
          onConflict: 'forecast_id',
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forecast-driver-settings', forecast?.id] });
    },
  });

  // Save/update sub-metric override
  const saveSubMetricOverride = useMutation({
    mutationFn: async ({ 
      subMetricKey, 
      parentMetricKey, 
      overriddenAnnualValue 
    }: { 
      subMetricKey: string; 
      parentMetricKey: string; 
      overriddenAnnualValue: number;
    }) => {
      if (!forecast?.id) throw new Error('No forecast');

      const { error } = await supabase
        .from('forecast_submetric_overrides')
        .upsert({
          forecast_id: forecast.id,
          sub_metric_key: subMetricKey,
          parent_metric_key: parentMetricKey,
          overridden_annual_value: overriddenAnnualValue,
        }, {
          onConflict: 'forecast_id,sub_metric_key',
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forecast-submetric-overrides', forecast?.id] });
    },
  });

  // Bulk save sub-metric overrides
  const bulkSaveSubMetricOverrides = useMutation({
    mutationFn: async (overrides: { subMetricKey: string; parentMetricKey: string; overriddenAnnualValue: number }[]) => {
      if (!forecast?.id) throw new Error('No forecast');

      if (overrides.length === 0) return;

      const upsertData = overrides.map(o => ({
        forecast_id: forecast.id,
        sub_metric_key: o.subMetricKey,
        parent_metric_key: o.parentMetricKey,
        overridden_annual_value: o.overriddenAnnualValue,
      }));

      const { error } = await supabase
        .from('forecast_submetric_overrides')
        .upsert(upsertData, {
          onConflict: 'forecast_id,sub_metric_key',
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forecast-submetric-overrides', forecast?.id] });
    },
  });

  // Delete all sub-metric overrides (for reset)
  const deleteAllSubMetricOverrides = useMutation({
    mutationFn: async () => {
      if (!forecast?.id) throw new Error('No forecast');

      const { error } = await supabase
        .from('forecast_submetric_overrides')
        .delete()
        .eq('forecast_id', forecast.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forecast-submetric-overrides', forecast?.id] });
    },
  });

  // Delete driver settings (for reset)
  const deleteDriverSettings = useMutation({
    mutationFn: async () => {
      if (!forecast?.id) throw new Error('No forecast');

      const { error } = await supabase
        .from('forecast_driver_settings')
        .delete()
        .eq('forecast_id', forecast.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forecast-driver-settings', forecast?.id] });
    },
  });

  // Reset all forecast entries (unlock all and clear forecast values)
  const resetAllEntries = useMutation({
    mutationFn: async () => {
      if (!forecast?.id) throw new Error('No forecast');

      // Update all entries to be unlocked and clear forecast_value
      const { error } = await supabase
        .from('forecast_entries')
        .update({ is_locked: false, forecast_value: null })
        .eq('forecast_id', forecast.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forecast-entries', forecast?.id] });
    },
  });

  return {
    forecast,
    entries: entries ?? [],
    weights: weights ?? [],
    driverSettings,
    subMetricOverrides: subMetricOverrides ?? [],
    isLoading: forecastLoading || entriesLoading || weightsLoading || driverSettingsLoading || subMetricOverridesLoading,
    createForecast,
    updateEntry,
    bulkUpdateEntries,
    updateWeight,
    resetWeights,
    saveDriverSettings,
    saveSubMetricOverride,
    bulkSaveSubMetricOverrides,
    deleteAllSubMetricOverrides,
    deleteDriverSettings,
    resetAllEntries,
  };
}
