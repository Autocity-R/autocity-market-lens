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
  make?: string;
  model?: string;
  year?: number;
  mileage?: number;
  fuelType?: string;
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
  soldListings: RecentSale[];
  inventory: {
    total: number;
    byPriceBucket: Record<string, number>;
    byFuelType: Record<string, number>;
    byYear: Record<string, number>;
  };
}

interface AnalyzeDealerParams {
  dealerId: string;
  periodStart?: string;
  periodEnd?: string;
  yearFrom?: number;
  yearTo?: number;
}

export interface DealersFilters {
  search?: string;
  city?: string;
  yearFrom?: number;
  yearTo?: number;
  sortBy?: 'sales' | 'listings' | 'name' | 'dom';
  sortOrder?: 'asc' | 'desc';
}

export interface DealerListItem {
  id: string;
  name: string;
  city: string | null;
  activeListings: number;
  soldCount: number;
  avgDaysOnMarket: number | null;
  avgPrice: number | null;
  priceStrategy: string | null;
}

export function useDealerAnalysis(params?: AnalyzeDealerParams) {
  return useQuery({
    queryKey: ['dealer-analysis', params?.dealerId, params?.periodStart, params?.periodEnd, params?.yearFrom, params?.yearTo],
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

export function useDealersList(filters?: DealersFilters) {
  return useQuery({
    queryKey: ['dealers-list', filters],
    queryFn: async (): Promise<DealerListItem[]> => {
      // Get all dealers with their stats
      const { data: dealers, error: dealersError } = await supabase
        .from('dealers')
        .select('id, name_raw, name_normalized, city, active_listings_count')
        .order('active_listings_count', { ascending: false })
        .limit(500);

      if (dealersError) throw dealersError;

      if (!dealers || dealers.length === 0) {
        return [];
      }

      // Get dealer stats for the current period
      const dealerIds = dealers.map(d => d.id);
      
      const { data: stats, error: statsError } = await supabase
        .from('dealer_stats')
        .select('dealer_id, sold_count, avg_days_on_market, avg_price, price_strategy')
        .in('dealer_id', dealerIds);

      if (statsError) {
        console.error('Error fetching dealer stats:', statsError);
      }

      // Create a map of stats by dealer_id
      const statsMap = new Map<string, typeof stats[0]>();
      for (const stat of stats || []) {
        if (stat.dealer_id) {
          // Keep the most recent stat for each dealer
          statsMap.set(stat.dealer_id, stat);
        }
      }

      // Get sales count from vehicle_events for more accurate data
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      
      // Build sales query with optional year filter
      let salesQuery = supabase
        .from('vehicle_events')
        .select('listing_id, make, model, year')
        .eq('event_type', 'sold_confirmed')
        .gte('event_at', thirtyDaysAgo);

      if (filters?.yearFrom) {
        salesQuery = salesQuery.gte('year', filters.yearFrom);
      }
      if (filters?.yearTo) {
        salesQuery = salesQuery.lte('year', filters.yearTo);
      }

      const { data: sales } = await salesQuery;

      // Get listing to dealer mapping
      const salesListingIds = sales?.map(s => s.listing_id) || [];
      const { data: salesListings } = await supabase
        .from('listings')
        .select('id, dealer_id')
        .in('id', salesListingIds.slice(0, 1000)); // Limit for performance

      // Count sales per dealer
      const salesCountByDealer = new Map<string, number>();
      for (const listing of salesListings || []) {
        if (listing.dealer_id) {
          salesCountByDealer.set(
            listing.dealer_id, 
            (salesCountByDealer.get(listing.dealer_id) || 0) + 1
          );
        }
      }

      // Build result list
      let result: DealerListItem[] = dealers.map(dealer => {
        const stat = statsMap.get(dealer.id);
        const salesCount = salesCountByDealer.get(dealer.id) || stat?.sold_count || 0;
        
        return {
          id: dealer.id,
          name: dealer.name_raw || dealer.name_normalized || 'Unknown',
          city: dealer.city,
          activeListings: dealer.active_listings_count || 0,
          soldCount: salesCount,
          avgDaysOnMarket: stat?.avg_days_on_market ? Number(stat.avg_days_on_market) : null,
          avgPrice: stat?.avg_price || null,
          priceStrategy: stat?.price_strategy || null,
        };
      });

      // Apply search filter
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        result = result.filter(d => 
          d.name.toLowerCase().includes(searchLower) ||
          (d.city && d.city.toLowerCase().includes(searchLower))
        );
      }

      // Apply city filter
      if (filters?.city) {
        result = result.filter(d => d.city === filters.city);
      }

      // Apply sorting
      const sortBy = filters?.sortBy || 'sales';
      const sortOrder = filters?.sortOrder || 'desc';

      result.sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'sales':
            comparison = a.soldCount - b.soldCount;
            break;
          case 'listings':
            comparison = a.activeListings - b.activeListings;
            break;
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'dom':
            comparison = (a.avgDaysOnMarket || 999) - (b.avgDaysOnMarket || 999);
            break;
        }
        return sortOrder === 'desc' ? -comparison : comparison;
      });

      return result;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useDealerCities() {
  return useQuery({
    queryKey: ['dealer-cities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dealers')
        .select('city')
        .not('city', 'is', null)
        .limit(1000);

      if (error) throw error;

      // Get unique cities and sort
      const cities = [...new Set(data?.map(d => d.city).filter(Boolean) as string[])];
      return cities.sort();
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}

export function useDealerStats() {
  return useQuery({
    queryKey: ['dealer-global-stats'],
    queryFn: async () => {
      // Get total dealers count
      const { count: dealersCount } = await supabase
        .from('dealers')
        .select('*', { count: 'exact', head: true });

      // Get total active listings
      const { count: listingsCount } = await supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Get average days on market from recent sales
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentSales } = await supabase
        .from('vehicle_events')
        .select('days_on_market')
        .eq('event_type', 'sold_confirmed')
        .gte('event_at', thirtyDaysAgo)
        .not('days_on_market', 'is', null)
        .limit(1000);

      const daysOnMarket = recentSales?.map(s => s.days_on_market).filter(Boolean) as number[] || [];
      const avgDaysOnMarket = daysOnMarket.length > 0
        ? Math.round(daysOnMarket.reduce((a, b) => a + b, 0) / daysOnMarket.length)
        : 32;

      // Total sales last 30 days
      const { count: salesCount } = await supabase
        .from('vehicle_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'sold_confirmed')
        .gte('event_at', thirtyDaysAgo);

      return {
        totalDealers: dealersCount || 0,
        totalListings: listingsCount || 0,
        avgDaysOnMarket,
        totalSales: salesCount || 0,
      };
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}
