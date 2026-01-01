import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ForecastSubMetricNote {
  id: string;
  department_id: string;
  forecast_year: number;
  sub_metric_key: string;
  parent_metric_key: string;
  note: string | null;
  is_resolved: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
}

export function useForecastSubMetricNotes(departmentId: string | undefined, forecastYear: number) {
  const [notes, setNotes] = useState<Map<string, ForecastSubMetricNote>>(new Map());
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchNotes = useCallback(async () => {
    if (!departmentId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('forecast_submetric_notes')
        .select('*')
        .eq('department_id', departmentId)
        .eq('forecast_year', forecastYear);

      if (error) throw error;

      const noteMap = new Map<string, ForecastSubMetricNote>();
      data?.forEach((note) => {
        noteMap.set(note.sub_metric_key, note as ForecastSubMetricNote);
      });
      setNotes(noteMap);
    } catch (error) {
      console.error('Error fetching forecast sub-metric notes:', error);
    } finally {
      setLoading(false);
    }
  }, [departmentId, forecastYear]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const saveNote = useCallback(async (
    subMetricKey: string,
    parentMetricKey: string,
    noteText: string
  ): Promise<boolean> => {
    if (!departmentId) return false;

    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;

      const { error } = await supabase
        .from('forecast_submetric_notes')
        .upsert({
          department_id: departmentId,
          forecast_year: forecastYear,
          sub_metric_key: subMetricKey,
          parent_metric_key: parentMetricKey,
          note: noteText || null,
          is_resolved: false,
          created_by: userId,
        }, {
          onConflict: 'department_id,forecast_year,sub_metric_key'
        });

      if (error) throw error;

      // Refetch to get updated data
      await fetchNotes();

      toast({
        title: 'Success',
        description: 'Note saved successfully',
      });

      return true;
    } catch (error) {
      console.error('Error saving forecast sub-metric note:', error);
      toast({
        title: 'Error',
        description: 'Failed to save note',
        variant: 'destructive',
      });
      return false;
    }
  }, [departmentId, forecastYear, fetchNotes, toast]);

  const resolveNote = useCallback(async (subMetricKey: string): Promise<boolean> => {
    if (!departmentId) return false;

    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;

      const { error } = await supabase
        .from('forecast_submetric_notes')
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: userId,
        })
        .eq('department_id', departmentId)
        .eq('forecast_year', forecastYear)
        .eq('sub_metric_key', subMetricKey);

      if (error) throw error;

      // Refetch to get updated data
      await fetchNotes();

      toast({
        title: 'Success',
        description: 'Note resolved',
      });

      return true;
    } catch (error) {
      console.error('Error resolving forecast sub-metric note:', error);
      toast({
        title: 'Error',
        description: 'Failed to resolve note',
        variant: 'destructive',
      });
      return false;
    }
  }, [departmentId, forecastYear, fetchNotes, toast]);

  const getNote = useCallback((subMetricKey: string): ForecastSubMetricNote | undefined => {
    return notes.get(subMetricKey);
  }, [notes]);

  const hasActiveNote = useCallback((subMetricKey: string): boolean => {
    const note = notes.get(subMetricKey);
    return !!note && !note.is_resolved && !!note.note;
  }, [notes]);

  return {
    notes,
    loading,
    saveNote,
    resolveNote,
    getNote,
    hasActiveNote,
    refetch: fetchNotes,
  };
}
