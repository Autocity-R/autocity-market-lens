import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TopItem {
  name: string;
  count: number;
  avgPrice: number;
}

export interface RecentSale {
  title: string;
  price: number;
  soldAt: string;
  daysOnMarket: number;
}

export interface DealerAnalysis {
  dealer: {
    id: string;
    name: string;
    city: string;
    activeListings: number;
    totalSold: number;
  };
  performance: {
    avgDaysOnMarket: number;
    marketAvgDaysOnMarket: number;
    avgPrice: number;
    marketAvgPrice: number;
    sellThroughRate: number;
    priceStrategy: 'aggressive' | 'market' | 'premium';
  };
  topMakes: TopItem[];
  topModels: TopItem[];
  recentSales: RecentSale[];
  inventory: {
    total: number;
    byPriceBucket: Record<string, number>;
    byFuelType: Record<string, number>;
  };
}

interface AnalyzeDealerParams {
  dealerId: string;
  periodStart?: string;
  periodEnd?: string;
}

export function useDealerAnalysis(params?: AnalyzeDealerParams) {
  return useQuery({
    queryKey: ['dealer-analysis', params?.dealerId, params?.periodStart, params?.periodEnd],
    queryFn: async (): Promise<DealerAnalysis> => {
      if (!params?.dealerId) {
        throw new Error('Dealer ID is required');
      }

      const { data, error } = await supabase.functions.invoke('analyze-dealer', {
        body: params,
      });

      if (error) throw error;
      
      if (data.error) {
        throw new Error(data.error);
      }

      return data as DealerAnalysis;
    },
    enabled: !!params?.dealerId,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function useAnalyzeDealerMutation() {
  return useMutation({
    mutationFn: async (params: AnalyzeDealerParams): Promise<DealerAnalysis> => {
      const { data, error } = await supabase.functions.invoke('analyze-dealer', {
        body: params,
      });

      if (error) throw error;
      
      if (data.error) {
        throw new Error(data.error);
      }

      return data as DealerAnalysis;
    },
  });
}

export function useDealersList() {
  return useQuery({
    queryKey: ['dealers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dealers')
        .select('id, name_raw, name_normalized, city, active_listings_count')
        .order('active_listings_count', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
