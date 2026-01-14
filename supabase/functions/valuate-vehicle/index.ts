import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValuationRequest {
  licensePlate?: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
  fuelType: string;
  transmission?: string;
  bodyType?: string;
  power?: {
    kw?: number;
    hp?: number;
  };
  options?: string[];
}

interface Comparable {
  title: string;
  price: number;
  mileage: number;
  daysOnMarket: number;
  soldAt?: string;
  isSold: boolean;
}

interface ValuationResult {
  estimatedValue: number;
  confidence: number;
  priceRange: {
    low: number;
    mid: number;
    high: number;
  };
  comparables: Comparable[];
  marketInsight: string;
  optionsAdjustment: number;
  windowSize: number;
  avgDaysOnMarket: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const request: ValuationRequest = await req.json();
    console.log('Valuating vehicle:', request);

    // Validate required fields
    if (!request.make || !request.model || !request.year || !request.mileage) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: make, model, year, mileage' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get comparable active listings
    const mileageRange = 0.2; // +/- 20%
    const yearRange = 2; // +/- 2 years

    let comparablesQuery = supabase
      .from('listings')
      .select('*')
      .eq('status', 'active')
      .ilike('make', request.make)
      .ilike('model', `%${request.model}%`)
      .gte('year', request.year - yearRange)
      .lte('year', request.year + yearRange)
      .gte('mileage', Math.round(request.mileage * (1 - mileageRange)))
      .lte('mileage', Math.round(request.mileage * (1 + mileageRange)))
      .not('price', 'is', null);

    if (request.fuelType) {
      comparablesQuery = comparablesQuery.ilike('fuel_type', `%${request.fuelType}%`);
    }

    const { data: activeListings, error: listingsError } = await comparablesQuery.limit(50);
    if (listingsError) throw listingsError;

    // Get recent sales (sold_confirmed events)
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: recentSales, error: salesError } = await supabase
      .from('vehicle_events')
      .select('*')
      .eq('event_type', 'sold_confirmed')
      .ilike('make', request.make)
      .ilike('model', `%${request.model}%`)
      .gte('year', request.year - yearRange)
      .lte('year', request.year + yearRange)
      .gte('event_at', sixtyDaysAgo)
      .not('price_at_event', 'is', null)
      .limit(30);

    if (salesError) throw salesError;

    // Combine data for analysis
    const allPrices: number[] = [];
    const comparables: Comparable[] = [];

    // Add active listings
    for (const listing of activeListings || []) {
      if (listing.price) {
        allPrices.push(listing.price);
        const daysOnMarket = Math.floor(
          (Date.now() - new Date(listing.first_seen_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        comparables.push({
          title: listing.title || `${listing.make} ${listing.model}`,
          price: listing.price,
          mileage: listing.mileage || 0,
          daysOnMarket,
          isSold: false,
        });
      }
    }

    // Add recent sales
    for (const sale of recentSales || []) {
      if (sale.price_at_event) {
        allPrices.push(sale.price_at_event);
        comparables.push({
          title: `${sale.make} ${sale.model}`,
          price: sale.price_at_event,
          mileage: sale.mileage || 0,
          daysOnMarket: sale.days_on_market || 0,
          soldAt: sale.event_at,
          isSold: true,
        });
      }
    }

    // Sort comparables by relevance (sold first, then by days on market)
    comparables.sort((a, b) => {
      if (a.isSold !== b.isSold) return a.isSold ? -1 : 1;
      return a.daysOnMarket - b.daysOnMarket;
    });

    // Calculate statistics
    if (allPrices.length === 0) {
      return new Response(JSON.stringify({
        error: 'No comparable vehicles found in database',
        suggestion: 'Try broadening search criteria or waiting for more data',
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sortedPrices = [...allPrices].sort((a, b) => a - b);
    const p10 = sortedPrices[Math.floor(sortedPrices.length * 0.1)];
    const median = sortedPrices[Math.floor(sortedPrices.length * 0.5)];
    const p90 = sortedPrices[Math.floor(sortedPrices.length * 0.9)];
    const avgPrice = Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length);

    // Calculate average days on market
    const daysOnMarketValues = comparables
      .filter(c => c.isSold)
      .map(c => c.daysOnMarket);
    const avgDaysOnMarket = daysOnMarketValues.length > 0
      ? Math.round(daysOnMarketValues.reduce((a, b) => a + b, 0) / daysOnMarketValues.length)
      : 30;

    // Calculate confidence based on sample size and data quality
    const confidence = calculateConfidence(allPrices.length, recentSales?.length || 0);

    // Get AI market insight if options are provided
    let marketInsight = '';
    let optionsAdjustment = 0;

    if (request.options && request.options.length > 0) {
      try {
        const aiResult = await getAIValuationInsight(
          lovableApiKey,
          request,
          { avgPrice, median, p10, p90, sampleSize: allPrices.length, avgDaysOnMarket }
        );
        marketInsight = aiResult.insight;
        optionsAdjustment = aiResult.adjustment;
      } catch (aiError) {
        console.error('AI insight error:', aiError);
        marketInsight = `Gebaseerd op ${allPrices.length} vergelijkbare voertuigen in de markt.`;
      }
    } else {
      marketInsight = generateBasicInsight(request, { avgPrice, median, sampleSize: allPrices.length, avgDaysOnMarket });
    }

    // Calculate final value (no condition adjustment)
    const baseValue = median;
    const adjustedValue = Math.round(baseValue + optionsAdjustment);

    const result: ValuationResult = {
      estimatedValue: adjustedValue,
      confidence,
      priceRange: {
        low: p10,
        mid: adjustedValue,
        high: p90,
      },
      comparables: comparables.slice(0, 10),
      marketInsight,
      optionsAdjustment,
      windowSize: allPrices.length,
      avgDaysOnMarket,
    };

    console.log('Valuation complete:', { 
      vehicle: `${request.make} ${request.model} ${request.year}`,
      value: result.estimatedValue,
      confidence: result.confidence,
      comparables: result.windowSize,
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in valuate-vehicle:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function calculateConfidence(totalSamples: number, soldSamples: number): number {
  const sampleScore = Math.min(totalSamples / 50, 1) * 60;
  const soldScore = Math.min(soldSamples / 20, 1) * 40;
  return Math.round(sampleScore + soldScore);
}

function generateBasicInsight(
  request: ValuationRequest,
  stats: { avgPrice: number; median: number; sampleSize: number; avgDaysOnMarket: number }
): string {
  const kmCategory = request.mileage < 50000 ? 'lage' : request.mileage < 100000 ? 'gemiddelde' : 'hoge';
  
  return `Deze ${request.year} ${request.make} ${request.model} met ${kmCategory} kilometerstand ` +
    `wordt getaxeerd op basis van ${stats.sampleSize} vergelijkbare voertuigen. ` +
    `De gemiddelde doorlooptijd in dit segment is ${stats.avgDaysOnMarket} dagen.`;
}

async function getAIValuationInsight(
  apiKey: string,
  request: ValuationRequest,
  stats: { avgPrice: number; median: number; p10: number; p90: number; sampleSize: number; avgDaysOnMarket: number }
): Promise<{ insight: string; adjustment: number }> {
  const prompt = `Je bent een Nederlandse automotive waarde-expert. Analyseer dit voertuig en geef een kort marktinzicht.

Voertuig:
- ${request.make} ${request.model} (${request.year})
- Kilometerstand: ${request.mileage.toLocaleString()} km
- Brandstof: ${request.fuelType}
- Transmissie: ${request.transmission || 'onbekend'}
- Vermogen: ${request.power?.hp ? `${request.power.hp} PK` : 'onbekend'}
- Opties: ${request.options?.join(', ') || 'geen specifieke opties'}

Marktdata:
- Aantal vergelijkbare voertuigen: ${stats.sampleSize}
- Gemiddelde prijs: €${stats.avgPrice.toLocaleString()}
- Mediaan prijs: €${stats.median.toLocaleString()}
- Prijsrange: €${stats.p10.toLocaleString()} - €${stats.p90.toLocaleString()}
- Gem. doorlooptijd: ${stats.avgDaysOnMarket} dagen

Geef in JSON format:
{
  "insight": "2-3 zinnen marktinzicht in het Nederlands",
  "optionsValue": <geschatte meerwaarde van opties in euros, 0 als geen relevante opties>
}`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: 'Je bent een Nederlandse automotive expert. Antwoord altijd in valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  try {
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        insight: parsed.insight || '',
        adjustment: parsed.optionsValue || 0,
      };
    }
  } catch (e) {
    console.error('Failed to parse AI response:', e);
  }

  return { insight: content, adjustment: 0 };
}
