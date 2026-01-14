import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
}

interface CourantheidResponse {
  segments: SegmentCourantheid[];
}

export function useCourantheid(segmentId?: string) {
  return useQuery({
    queryKey: ['courantheid', segmentId],
    queryFn: async (): Promise<CourantheidResponse> => {
      const { data, error } = await supabase.functions.invoke('calculate-courantheid', {
        body: { segmentId, forceRecalculate: false },
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
    mutationFn: async (segmentId?: string) => {
      const { data, error } = await supabase.functions.invoke('calculate-courantheid', {
        body: { segmentId, forceRecalculate: true },
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
