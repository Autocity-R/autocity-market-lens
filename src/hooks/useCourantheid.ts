import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BestsellersFilters {
  make?: string;
  model?: string;
  fuelType?: string;
  transmission?: string;
  yearFrom?: number;
  yearTo?: number;
  mileageMin?: number;
  mileageMax?: number;
}

export interface SegmentCourantheid {
  id: string;
  name: string;
  score: number;
  trend: 'up' | 'down' | 'stable';
  salesLast30Days: number;
  avgDaysOnMarket: number;
  windowSize: number;
  avgPrice: number;
  medianPrice: number;
  filters?: {
    make?: string;
    model?: string;
    yearFrom?: number;
    yearTo?: number;
    fuelTypes?: string[];
    mileageMin?: number;
    mileageMax?: number;
    transmission?: string;
  };
}

interface CourantheidResponse {
  segments: SegmentCourantheid[];
}

export function useCourantheid(filters?: BestsellersFilters, segmentId?: string) {
  return useQuery({
    queryKey: ['courantheid', filters, segmentId],
    queryFn: async (): Promise<CourantheidResponse> => {
      const { data, error } = await supabase.functions.invoke('calculate-courantheid', {
        body: { 
          segmentId, 
          forceRecalculate: false,
          filters,
        },
      });

      if (error) throw error;
      return data as CourantheidResponse;
    },
    staleTime: 1000 * 60 * 15, // 15 minutes
  });
}

export function useRecalculateCourantheid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params?: { segmentId?: string; filters?: BestsellersFilters }) => {
      const { data, error } = await supabase.functions.invoke('calculate-courantheid', {
        body: { 
          segmentId: params?.segmentId, 
          forceRecalculate: true,
          filters: params?.filters,
        },
      });

      if (error) throw error;
      return data as CourantheidResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courantheid'] });
    },
  });
}

export function useMarketSegments() {
  return useQuery({
    queryKey: ['market-segments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_segments')
        .select('*')
        .order('courantheid_score', { ascending: false });

      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
