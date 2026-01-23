import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, addMonths, startOfMonth } from "date-fns";

// Color palette for destinations
const COLOR_PALETTE = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#F43F5E', // Rose
  '#8B5CF6', // Violet
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#EC4899', // Pink
];

export interface TravelPeriod {
  id: string;
  destination: string;
  start_date: string;
  end_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface TravelDestination {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export function useTravelPeriods() {
  const queryClient = useQueryClient();

  // Get 12 months starting from current month
  const months = Array.from({ length: 12 }, (_, offset) => {
    const date = addMonths(startOfMonth(new Date()), offset);
    return {
      key: format(date, 'yyyy-MM'),
      date,
    };
  });

  const startDate = format(months[0].date, 'yyyy-MM-01');
  const endDate = format(addMonths(months[11].date, 1), 'yyyy-MM-01');

  // Fetch travel periods within the visible date range
  const { data: travelPeriods, isLoading: periodsLoading } = useQuery({
    queryKey: ['consulting-travel', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consulting_travel')
        .select('*')
        .or(`start_date.lte.${endDate},end_date.gte.${startDate}`)
        .order('start_date');

      if (error) throw error;
      return data as TravelPeriod[];
    },
  });

  // Fetch all travel destinations with their colors
  const { data: destinations, isLoading: destinationsLoading } = useQuery({
    queryKey: ['consulting-travel-destinations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consulting_travel_destinations')
        .select('*')
        .order('created_at');

      if (error) throw error;
      return data as TravelDestination[];
    },
  });

  // Get color for a destination (or next available color for new destination)
  const getDestinationColor = (destinationName: string): string => {
    if (!destinations) return COLOR_PALETTE[0];
    
    const existingDest = destinations.find(
      d => d.name.toLowerCase() === destinationName.toLowerCase()
    );
    
    if (existingDest) {
      return existingDest.color;
    }
    
    // Get next color in palette
    const colorIndex = destinations.length % COLOR_PALETTE.length;
    return COLOR_PALETTE[colorIndex];
  };

  // Create a travel period
  const createTravelPeriod = useMutation({
    mutationFn: async (data: { 
      destination: string; 
      start_date: string; 
      end_date: string; 
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Check if destination already exists, if not create it
      const existingDest = destinations?.find(
        d => d.name.toLowerCase() === data.destination.toLowerCase()
      );
      
      if (!existingDest) {
        const newColor = getDestinationColor(data.destination);
        const { error: destError } = await supabase
          .from('consulting_travel_destinations')
          .insert({
            name: data.destination,
            color: newColor,
          });
        
        if (destError) throw destError;
      }
      
      // Create the travel period
      const { data: newPeriod, error } = await supabase
        .from('consulting_travel')
        .insert({
          destination: data.destination,
          start_date: data.start_date,
          end_date: data.end_date,
          notes: data.notes || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return newPeriod;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consulting-travel'] });
      queryClient.invalidateQueries({ queryKey: ['consulting-travel-destinations'] });
    },
  });

  // Update a travel period
  const updateTravelPeriod = useMutation({
    mutationFn: async (data: {
      id: string;
      destination?: string;
      start_date?: string;
      end_date?: string;
      notes?: string | null;
    }) => {
      // If destination is being changed, ensure the new destination exists
      if (data.destination) {
        const existingDest = destinations?.find(
          d => d.name.toLowerCase() === data.destination!.toLowerCase()
        );
        
        if (!existingDest) {
          const newColor = getDestinationColor(data.destination);
          const { error: destError } = await supabase
            .from('consulting_travel_destinations')
            .insert({
              name: data.destination,
              color: newColor,
            });
          
          if (destError) throw destError;
        }
      }

      const { id, ...updateData } = data;
      const { data: updated, error } = await supabase
        .from('consulting_travel')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consulting-travel'] });
      queryClient.invalidateQueries({ queryKey: ['consulting-travel-destinations'] });
    },
  });

  // Delete a travel period
  const deleteTravelPeriod = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('consulting_travel')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consulting-travel'] });
    },
  });

  return {
    travelPeriods: travelPeriods || [],
    destinations: destinations || [],
    isLoading: periodsLoading || destinationsLoading,
    getDestinationColor,
    createTravelPeriod,
    updateTravelPeriod,
    deleteTravelPeriod,
    months,
  };
}
