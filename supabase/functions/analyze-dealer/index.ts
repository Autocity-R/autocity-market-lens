import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DealerAnalysisRequest {
  dealerId: string;
  periodStart?: string;
  periodEnd?: string;
}

interface TopItem {
  name: string;
  count: number;
  avgPrice: number;
}

interface RecentSale {
  title: string;
  price: number;
  soldAt: string;
  daysOnMarket: number;
}

interface DealerAnalysis {
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const request: DealerAnalysisRequest = await req.json();
    console.log('Analyzing dealer:', request);

    if (!request.dealerId) {
      return new Response(JSON.stringify({ error: 'Missing dealerId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Default period: last 90 days
    const periodStart = request.periodStart || 
      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const periodEnd = request.periodEnd || 
      new Date().toISOString().split('T')[0];

    // Get dealer info
    const { data: dealer, error: dealerError } = await supabase
      .from('dealers')
      .select('*')
      .eq('id', request.dealerId)
      .single();

    if (dealerError || !dealer) {
      return new Response(JSON.stringify({ error: 'Dealer not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get dealer's active listings
    const { data: activeListings, error: listingsError } = await supabase
      .from('listings')
      .select('*')
      .eq('dealer_id', request.dealerId)
      .eq('status', 'active');

    if (listingsError) throw listingsError;

    // Get dealer's sales in period
    const { data: sales, error: salesError } = await supabase
      .from('vehicle_events')
      .select('*')
      .eq('event_type', 'sold_confirmed')
      .gte('event_at', periodStart)
      .lte('event_at', periodEnd);

    if (salesError) throw salesError;

    // Filter sales by dealer (need to join with listings)
    const { data: dealerListings, error: allListingsError } = await supabase
      .from('listings')
      .select('id')
      .eq('dealer_id', request.dealerId);

    if (allListingsError) throw allListingsError;

    const dealerListingIds = new Set(dealerListings?.map(l => l.id) || []);
    const dealerSales = sales?.filter(s => dealerListingIds.has(s.listing_id)) || [];

    // Get market averages for comparison
    const { data: marketSales } = await supabase
      .from('vehicle_events')
      .select('days_on_market, price_at_event')
      .eq('event_type', 'sold_confirmed')
      .gte('event_at', periodStart)
      .not('days_on_market', 'is', null)
      .not('price_at_event', 'is', null);

    const marketDaysOnMarket = marketSales?.map(s => s.days_on_market) || [];
    const marketPrices = marketSales?.map(s => s.price_at_event) || [];

    const marketAvgDaysOnMarket = marketDaysOnMarket.length > 0
      ? Math.round(marketDaysOnMarket.reduce((a, b) => a + b, 0) / marketDaysOnMarket.length)
      : 35;

    const marketAvgPrice = marketPrices.length > 0
      ? Math.round(marketPrices.reduce((a, b) => a + b, 0) / marketPrices.length)
      : 25000;

    // Calculate dealer performance
    const dealerDaysOnMarket = dealerSales
      .map(s => s.days_on_market)
      .filter((d): d is number => d !== null);
    
    const dealerPrices = dealerSales
      .map(s => s.price_at_event)
      .filter((p): p is number => p !== null);

    const avgDaysOnMarket = dealerDaysOnMarket.length > 0
      ? Math.round(dealerDaysOnMarket.reduce((a, b) => a + b, 0) / dealerDaysOnMarket.length)
      : 0;

    const avgPrice = dealerPrices.length > 0
      ? Math.round(dealerPrices.reduce((a, b) => a + b, 0) / dealerPrices.length)
      : 0;

    // Determine price strategy
    const priceRatio = avgPrice / marketAvgPrice;
    const priceStrategy: 'aggressive' | 'market' | 'premium' = 
      priceRatio < 0.95 ? 'aggressive' :
      priceRatio > 1.05 ? 'premium' : 'market';

    // Calculate sell-through rate
    const totalListingsInPeriod = (activeListings?.length || 0) + dealerSales.length;
    const sellThroughRate = totalListingsInPeriod > 0
      ? Math.round((dealerSales.length / totalListingsInPeriod) * 100)
      : 0;

    // Get top makes and models
    const makeCounts: Record<string, { count: number; totalPrice: number }> = {};
    const modelCounts: Record<string, { count: number; totalPrice: number }> = {};

    for (const listing of activeListings || []) {
      if (listing.make) {
        if (!makeCounts[listing.make]) {
          makeCounts[listing.make] = { count: 0, totalPrice: 0 };
        }
        makeCounts[listing.make].count++;
        makeCounts[listing.make].totalPrice += listing.price || 0;
      }
      if (listing.model) {
        if (!modelCounts[listing.model]) {
          modelCounts[listing.model] = { count: 0, totalPrice: 0 };
        }
        modelCounts[listing.model].count++;
        modelCounts[listing.model].totalPrice += listing.price || 0;
      }
    }

    const topMakes: TopItem[] = Object.entries(makeCounts)
      .map(([name, data]) => ({
        name,
        count: data.count,
        avgPrice: data.count > 0 ? Math.round(data.totalPrice / data.count) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topModels: TopItem[] = Object.entries(modelCounts)
      .map(([name, data]) => ({
        name,
        count: data.count,
        avgPrice: data.count > 0 ? Math.round(data.totalPrice / data.count) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Recent sales
    const recentSales: RecentSale[] = dealerSales
      .sort((a, b) => new Date(b.event_at).getTime() - new Date(a.event_at).getTime())
      .slice(0, 10)
      .map(s => ({
        title: `${s.make || ''} ${s.model || ''}`.trim() || 'Unknown',
        price: s.price_at_event || 0,
        soldAt: s.event_at,
        daysOnMarket: s.days_on_market || 0,
      }));

    // Inventory breakdown
    const byPriceBucket: Record<string, number> = {};
    const byFuelType: Record<string, number> = {};

    for (const listing of activeListings || []) {
      const bucket = listing.price 
        ? `€${Math.floor(listing.price / 10000) * 10}k-${Math.floor(listing.price / 10000) * 10 + 10}k`
        : 'Unknown';
      byPriceBucket[bucket] = (byPriceBucket[bucket] || 0) + 1;

      const fuel = listing.fuel_type || 'Unknown';
      byFuelType[fuel] = (byFuelType[fuel] || 0) + 1;
    }

    // Save stats to dealer_stats table
    await supabase.from('dealer_stats').upsert({
      dealer_id: request.dealerId,
      period_start: periodStart,
      period_end: periodEnd,
      listings_count: activeListings?.length || 0,
      sold_count: dealerSales.length,
      avg_days_on_market: avgDaysOnMarket,
      avg_price: avgPrice,
      total_revenue: dealerPrices.reduce((a, b) => a + b, 0),
      top_makes: topMakes,
      top_models: topModels,
      price_strategy: priceStrategy,
    }, {
      onConflict: 'dealer_id,period_start,period_end',
    });

    const result: DealerAnalysis = {
      dealer: {
        id: dealer.id,
        name: dealer.name_raw || dealer.name_normalized || 'Unknown',
        city: dealer.city || 'Unknown',
        activeListings: activeListings?.length || 0,
        totalSold: dealerSales.length,
      },
      performance: {
        avgDaysOnMarket,
        marketAvgDaysOnMarket,
        avgPrice,
        marketAvgPrice,
        sellThroughRate,
        priceStrategy,
      },
      topMakes,
      topModels,
      recentSales,
      inventory: {
        total: activeListings?.length || 0,
        byPriceBucket,
        byFuelType,
      },
    };

    console.log('Dealer analysis complete:', {
      dealer: dealer.name_raw,
      activeListings: result.dealer.activeListings,
      totalSold: result.dealer.totalSold,
      priceStrategy: result.performance.priceStrategy,
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-dealer:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
