import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SegmentFilters {
  make?: string;
  model?: string;
  yearFrom?: number;
  yearTo?: number;
  fuelTypes?: string[];
  bodyType?: string;
  transmissionType?: string;
  priceMin?: number;
  priceMax?: number;
}

interface SegmentResult {
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { segmentId, forceRecalculate } = await req.json();

    console.log('Starting courantheid calculation', { segmentId, forceRecalculate });

    // Get segments to calculate
    let segmentsQuery = supabase.from('market_segments').select('*');
    if (segmentId) {
      segmentsQuery = segmentsQuery.eq('id', segmentId);
    }
    
    const { data: segments, error: segmentsError } = await segmentsQuery;
    if (segmentsError) throw segmentsError;

    // If no segments exist, auto-generate from listings data
    if (!segments || segments.length === 0) {
      console.log('No segments found, auto-generating from listings data');
      const autoSegments = await autoGenerateSegments(supabase);
      segments?.push(...autoSegments);
    }

    const results: SegmentResult[] = [];

    for (const segment of segments || []) {
      const filters: SegmentFilters = segment.filters || {};
      
      // Skip if recently calculated (unless forced)
      if (!forceRecalculate && segment.last_calculated_at) {
        const lastCalc = new Date(segment.last_calculated_at);
        const hoursSinceCalc = (Date.now() - lastCalc.getTime()) / (1000 * 60 * 60);
        if (hoursSinceCalc < 4) {
          results.push({
            id: segment.id,
            name: segment.name,
            score: segment.courantheid_score || 0,
            trend: segment.trend || 'stable',
            salesLast30Days: segment.sales_last_30_days || 0,
            avgDaysOnMarket: segment.avg_days_on_market || 0,
            windowSize: segment.window_size || 0,
            avgPrice: segment.avg_price || 0,
            medianPrice: segment.median_price || 0,
          });
          continue;
        }
      }

      // Build query for active listings in segment
      let listingsQuery = supabase
        .from('listings')
        .select('id, price, first_seen_at, status')
        .eq('status', 'active');

      // Apply filters
      if (filters.make) listingsQuery = listingsQuery.ilike('make', filters.make);
      if (filters.model) listingsQuery = listingsQuery.ilike('model', `%${filters.model}%`);
      if (filters.yearFrom) listingsQuery = listingsQuery.gte('year', filters.yearFrom);
      if (filters.yearTo) listingsQuery = listingsQuery.lte('year', filters.yearTo);
      if (filters.fuelTypes?.length) listingsQuery = listingsQuery.in('fuel_type', filters.fuelTypes);
      if (filters.bodyType) listingsQuery = listingsQuery.eq('body_type', filters.bodyType);
      if (filters.transmissionType) listingsQuery = listingsQuery.eq('transmission', filters.transmissionType);
      if (filters.priceMin) listingsQuery = listingsQuery.gte('price', filters.priceMin);
      if (filters.priceMax) listingsQuery = listingsQuery.lte('price', filters.priceMax);

      const { data: activeListings, error: listingsError } = await listingsQuery;
      if (listingsError) {
        console.error('Error fetching listings for segment', segment.name, listingsError);
        continue;
      }

      const windowSize = activeListings?.length || 0;

      // Get sales (sold_confirmed events) in last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      
      let salesQuery = supabase
        .from('vehicle_events')
        .select('*')
        .eq('event_type', 'sold_confirmed')
        .gte('event_at', thirtyDaysAgo);

      if (filters.make) salesQuery = salesQuery.ilike('make', filters.make);
      if (filters.model) salesQuery = salesQuery.ilike('model', `%${filters.model}%`);
      if (filters.yearFrom) salesQuery = salesQuery.gte('year', filters.yearFrom);
      if (filters.yearTo) salesQuery = salesQuery.lte('year', filters.yearTo);
      if (filters.fuelTypes?.length) salesQuery = salesQuery.in('fuel_type', filters.fuelTypes);

      const { data: sales, error: salesError } = await salesQuery;
      if (salesError) {
        console.error('Error fetching sales for segment', segment.name, salesError);
        continue;
      }

      const salesCount = sales?.length || 0;
      
      // Calculate average days on market from sales
      const daysOnMarketValues = sales
        ?.map(s => s.days_on_market)
        .filter((d): d is number => d !== null && d !== undefined) || [];
      
      const avgDaysOnMarket = daysOnMarketValues.length > 0
        ? daysOnMarketValues.reduce((a, b) => a + b, 0) / daysOnMarketValues.length
        : 45; // Default if no data

      // Calculate prices
      const prices = activeListings?.map(l => l.price).filter((p): p is number => p !== null) || [];
      const avgPrice = prices.length > 0 
        ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
        : 0;
      
      const sortedPrices = [...prices].sort((a, b) => a - b);
      const medianPrice = sortedPrices.length > 0
        ? sortedPrices[Math.floor(sortedPrices.length / 2)]
        : 0;

      // Calculate courantheid score (0-100)
      // Based on: sales velocity, days on market, market size
      const score = calculateCourantheidScore(salesCount, avgDaysOnMarket, windowSize);

      // Determine trend by comparing with previous calculation
      const previousScore = segment.courantheid_score || score;
      const trend: 'up' | 'down' | 'stable' = 
        score > previousScore + 3 ? 'up' :
        score < previousScore - 3 ? 'down' : 'stable';

      // Update segment in database
      const { error: updateError } = await supabase
        .from('market_segments')
        .update({
          courantheid_score: score,
          trend,
          sales_last_30_days: salesCount,
          avg_days_on_market: avgDaysOnMarket,
          window_size: windowSize,
          avg_price: avgPrice,
          median_price: medianPrice,
          last_calculated_at: new Date().toISOString(),
        })
        .eq('id', segment.id);

      if (updateError) {
        console.error('Error updating segment', segment.name, updateError);
      }

      results.push({
        id: segment.id,
        name: segment.name,
        score,
        trend,
        salesLast30Days: salesCount,
        avgDaysOnMarket,
        windowSize,
        avgPrice,
        medianPrice,
      });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    console.log(`Calculated courantheid for ${results.length} segments`);

    return new Response(JSON.stringify({ segments: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in calculate-courantheid:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function calculateCourantheidScore(salesCount: number, avgDaysOnMarket: number, windowSize: number): number {
  // Sales velocity component (40% weight)
  // Baseline: 10 sales/month is good, 30+ is excellent
  const salesVelocity = Math.min(salesCount / 30, 1) * 40;

  // Days on market component (35% weight)
  // Baseline: 20 days is excellent, 60+ days is poor
  const domScore = Math.max(0, 1 - (avgDaysOnMarket - 20) / 60) * 35;

  // Market size component (25% weight)
  // Baseline: 50+ listings indicates healthy market
  const marketSizeScore = Math.min(windowSize / 100, 1) * 25;

  const totalScore = Math.round(salesVelocity + domScore + marketSizeScore);
  return Math.min(100, Math.max(0, totalScore));
}

async function autoGenerateSegments(supabase: any): Promise<any[]> {
  // Get top make/model combinations by count
  const { data: topCombos, error } = await supabase
    .from('listings')
    .select('make, model')
    .eq('status', 'active')
    .not('make', 'is', null)
    .not('model', 'is', null);

  if (error || !topCombos) return [];

  // Count combinations
  const comboCounts: Record<string, number> = {};
  for (const listing of topCombos) {
    const key = `${listing.make}|${listing.model}`;
    comboCounts[key] = (comboCounts[key] || 0) + 1;
  }

  // Get top 20 combinations with at least 10 listings
  const topKeys = Object.entries(comboCounts)
    .filter(([_, count]) => count >= 10)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  const segments: any[] = [];
  for (const [key, count] of topKeys) {
    const [make, model] = key.split('|');
    const segmentName = `${make} ${model}`;
    
    // Check if segment already exists
    const { data: existing } = await supabase
      .from('market_segments')
      .select('id')
      .eq('name', segmentName)
      .single();

    if (!existing) {
      const { data: newSegment, error: insertError } = await supabase
        .from('market_segments')
        .insert({
          name: segmentName,
          filters: { make, model },
        })
        .select()
        .single();

      if (!insertError && newSegment) {
        segments.push(newSegment);
      }
    }
  }

  return segments;
}
