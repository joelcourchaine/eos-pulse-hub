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

  // Create new forecast
  const createForecast = useMutation({
    mutationFn: async (initialWeights: { month_number: number; weight: number }[]) => {
      if (!departmentId) throw new Error('Department ID required');

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

      // Check if entry exists
      const existing = entries?.find(e => e.month === month && e.metric_name === metricName);

      if (existing) {
        const updates: Partial<ForecastEntry> = {};
        if (forecastValue !== undefined) updates.forecast_value = forecastValue;
        if (baselineValue !== undefined) updates.baseline_value = baselineValue;
        if (isLocked !== undefined) updates.is_locked = isLocked;

        const { error } = await supabase
          .from('forecast_entries')
          .update(updates)
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forecast-entries', forecast?.id] });
    },
  });

  // Bulk update entries (for cascade calculations)
  const bulkUpdateEntries = useMutation({
    mutationFn: async (updates: { month: string; metricName: string; forecastValue: number | null; baselineValue?: number | null }[]) => {
      if (!forecast?.id) throw new Error('No forecast');

      for (const update of updates) {
        const existing = entries?.find(e => e.month === update.month && e.metric_name === update.metricName);
        
        if (existing && !existing.is_locked) {
          await supabase
            .from('forecast_entries')
            .update({ 
              forecast_value: update.forecastValue,
              ...(update.baselineValue !== undefined && { baseline_value: update.baselineValue }),
            })
            .eq('id', existing.id);
        } else if (!existing) {
          await supabase
            .from('forecast_entries')
            .insert({
              forecast_id: forecast.id,
              month: update.month,
              metric_name: update.metricName,
              forecast_value: update.forecastValue,
              baseline_value: update.baselineValue ?? null,
              is_locked: false,
            });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forecast-entries', forecast?.id] });
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

  return {
    forecast,
    entries: entries ?? [],
    weights: weights ?? [],
    isLoading: forecastLoading || entriesLoading || weightsLoading,
    createForecast,
    updateEntry,
    bulkUpdateEntries,
    updateWeight,
    resetWeights,
  };
}
