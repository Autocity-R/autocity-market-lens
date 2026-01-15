import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============ INTERFACES ============

interface ValuationRequest {
  licensePlate?: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
  fuelType: string;
  transmission?: string;
  bodyType?: string;
  power?: { kw?: number; hp?: number };
  options?: string[];
}

interface Comparable {
  id: string;
  title: string;
  price: number;
  mileage: number;
  daysOnMarket: number;
  soldAt?: string;
  isSold: boolean;
  optionsMatchScore?: number;
  isOutlier?: boolean;
}

interface CourantheidResult {
  score: number;
  label: string;
  sellThroughRate: number;
  avgDaysToSell: number;
  priceImpact: number;
}

interface MarketTrend {
  percentage: number;
  direction: 'rising' | 'falling' | 'stable';
  period: string;
}

interface OptionsAnalysis {
  matchScore: number;
  adjustments: { option: string; label: string; value: number }[];
  totalAdjustment: number;
}

interface PriceBreakdown {
  livePriceMedian: number;
  soldPriceMedian: number;
  weightedSalesPrice: number;
  clusterMedian: number;
  lowestRealistic: number;
  optionsAdjustment: number;
  courantheidAdjustment: number;
  trendAdjustment: number;
  baseValue: number;
  finalValue: number;
}

interface QualityAssessment {
  quality: 'excellent' | 'good' | 'fair' | 'limited';
  warnings: string[];
  cohortCriteria: { yearRange: number; mileageRange: number };
}

interface ValuationResult {
  estimatedValue: number;
  confidence: number;
  priceBreakdown: PriceBreakdown;
  priceRange: { low: number; mid: number; high: number };
  courantheid: CourantheidResult;
  marketTrend: MarketTrend;
  comparables: Comparable[];
  outliers: Comparable[];
  optionsAnalysis: OptionsAnalysis;
  marketInsight: string;
  risks: string[];
  cohortSize: number;
  salesCount: number;
  dataQuality: QualityAssessment;
}

// ============ OPTION VALUE MAP ============

const OPTION_VALUE_MAP: Record<string, { baseValue: number; label: string; category: string }> = {
  // Sport packages - brand specific
  'amg_line': { baseValue: 2500, label: 'AMG Line', category: 'sport' },
  'amg_styling': { baseValue: 1800, label: 'AMG Styling', category: 'sport' },
  'm_sport': { baseValue: 2000, label: 'M Sport', category: 'sport' },
  'm_pakket': { baseValue: 1800, label: 'M Pakket', category: 'sport' },
  's_line': { baseValue: 1800, label: 'S-Line', category: 'sport' },
  'rs_line': { baseValue: 1500, label: 'RS Line', category: 'sport' },
  'st_line': { baseValue: 1200, label: 'ST-Line', category: 'sport' },
  'r_design': { baseValue: 1500, label: 'R-Design', category: 'sport' },
  'f_sport': { baseValue: 1500, label: 'F Sport', category: 'sport' },
  'gtd_gte': { baseValue: 2000, label: 'GTD/GTE', category: 'sport' },
  'gti': { baseValue: 2500, label: 'GTI', category: 'sport' },
  
  // Premium comfort
  'panoramadak': { baseValue: 1500, label: 'Panoramadak', category: 'comfort' },
  'schuifdak': { baseValue: 800, label: 'Schuifdak', category: 'comfort' },
  'leder': { baseValue: 800, label: 'Lederen bekleding', category: 'comfort' },
  'leder_volledig': { baseValue: 1200, label: 'Volledig leder', category: 'comfort' },
  'stoelverwarming': { baseValue: 300, label: 'Stoelverwarming', category: 'comfort' },
  'stuurverwarming': { baseValue: 200, label: 'Stuurverwarming', category: 'comfort' },
  'stoelventilatie': { baseValue: 500, label: 'Stoelventilatie', category: 'comfort' },
  'massagestoelen': { baseValue: 800, label: 'Massagestoelen', category: 'comfort' },
  'elektrische_stoelen': { baseValue: 400, label: 'Elektrische stoelen', category: 'comfort' },
  'memory_seats': { baseValue: 300, label: 'Memory stoelen', category: 'comfort' },
  'head_up_display': { baseValue: 800, label: 'Head-up display', category: 'tech' },
  'keyless_entry': { baseValue: 400, label: 'Keyless entry', category: 'comfort' },
  'elektrische_achterklep': { baseValue: 350, label: 'Elektrische achterklep', category: 'comfort' },
  'sfeerverlichting': { baseValue: 200, label: 'Sfeerverlichting', category: 'comfort' },
  
  // Audio systems
  'burmester': { baseValue: 1200, label: 'Burmester audio', category: 'audio' },
  'harman_kardon': { baseValue: 1000, label: 'Harman Kardon', category: 'audio' },
  'bang_olufsen': { baseValue: 1500, label: 'Bang & Olufsen', category: 'audio' },
  'bowers_wilkins': { baseValue: 2000, label: 'Bowers & Wilkins', category: 'audio' },
  'jbl': { baseValue: 600, label: 'JBL audio', category: 'audio' },
  'bose': { baseValue: 800, label: 'Bose audio', category: 'audio' },
  'meridian': { baseValue: 1200, label: 'Meridian audio', category: 'audio' },
  'mark_levinson': { baseValue: 1500, label: 'Mark Levinson', category: 'audio' },
  
  // Safety & driver assist
  'adaptieve_cruise': { baseValue: 600, label: 'Adaptieve cruise control', category: 'safety' },
  'lane_assist': { baseValue: 300, label: 'Lane assist', category: 'safety' },
  'dodehoek': { baseValue: 400, label: 'Dodehoek detectie', category: 'safety' },
  'parkeer_assist': { baseValue: 500, label: 'Parkeer assistent', category: 'safety' },
  'camera_360': { baseValue: 600, label: '360° camera', category: 'safety' },
  'nachtzicht': { baseValue: 1000, label: 'Nachtzicht camera', category: 'safety' },
  'matrix_led': { baseValue: 800, label: 'Matrix LED koplampen', category: 'safety' },
  'laser_led': { baseValue: 1200, label: 'Laser LED verlichting', category: 'safety' },
  
  // Wheels & exterior
  'lichtmetaal_19': { baseValue: 400, label: '19" velgen', category: 'exterior' },
  'lichtmetaal_20': { baseValue: 600, label: '20" velgen', category: 'exterior' },
  'lichtmetaal_21': { baseValue: 800, label: '21"+ velgen', category: 'exterior' },
  
  // EV specific
  'warmtepomp': { baseValue: 1000, label: 'Warmtepomp', category: 'electric' },
  'fsd': { baseValue: 5000, label: 'Full Self-Driving', category: 'electric' },
  'enhanced_autopilot': { baseValue: 3000, label: 'Enhanced Autopilot', category: 'electric' },
  'grote_batterij': { baseValue: 3000, label: 'Grote batterij', category: 'electric' },
  'snelladen': { baseValue: 500, label: 'Snelladen upgrade', category: 'electric' },
  
  // Tow & practicality
  'trekhaak': { baseValue: 400, label: 'Trekhaak', category: 'practical' },
  'trekhaak_elektrisch': { baseValue: 600, label: 'Elektrische trekhaak', category: 'practical' },
  'dakrails': { baseValue: 200, label: 'Dakrails', category: 'practical' },
};

// ============ HELPER FUNCTIONS ============

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.floor(sorted.length * p);
  return sorted[Math.min(index, sorted.length - 1)];
}

function median(arr: number[]): number {
  return percentile(arr, 0.5);
}

// Stap 2: Cluster Analyse (IQR Outlier Detectie)
function findRealisticCluster(prices: number[]): {
  clusterPrices: number[];
  outlierPrices: number[];
  clusterMedian: number;
  clusterP10: number;
  clusterP90: number;
} {
  if (prices.length === 0) {
    return { clusterPrices: [], outlierPrices: [], clusterMedian: 0, clusterP10: 0, clusterP90: 0 };
  }

  const sorted = [...prices].sort((a, b) => a - b);
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  const iqr = q3 - q1;

  // IQR bounds (1.5x)
  const lowerBound = q1 - (iqr * 1.5);
  const upperBound = q3 + (iqr * 1.5);

  const clusterPrices = sorted.filter(p => p >= lowerBound && p <= upperBound);
  const outlierPrices = sorted.filter(p => p < lowerBound || p > upperBound);

  return {
    clusterPrices,
    outlierPrices,
    clusterMedian: median(clusterPrices),
    clusterP10: percentile(clusterPrices, 0.10),
    clusterP90: percentile(clusterPrices, 0.90),
  };
}

// Stap 3: Tijdsgewogen Verkopen (50 dagen, exponential decay)
function calculateTimeWeight(soldDate: Date): number {
  const daysAgo = Math.floor((Date.now() - soldDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysAgo > 50) return 0;
  // Exponential decay: dag 0 = 1.0, dag 25 = 0.5, dag 50 = 0.1
  return Math.exp(-daysAgo / 20);
}

function calculateWeightedSalesPrice(sales: { price: number; eventAt: string }[]): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const sale of sales) {
    const weight = calculateTimeWeight(new Date(sale.eventAt));
    if (weight > 0) {
      weightedSum += sale.price * weight;
      totalWeight += weight;
    }
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

// Stap 4: Courantheid Scoring
function calculateCourantheid(
  activeCount: number,
  soldLast30Days: number,
  avgDaysOnMarket: number
): CourantheidResult {
  const sellThroughRate = activeCount > 0 ? soldLast30Days / activeCount : 0;

  // Score 0-100 met twee componenten
  let score = 0;

  // Sell-through rate (max 50 punten)
  if (sellThroughRate >= 0.8) score += 50;
  else if (sellThroughRate >= 0.5) score += 35;
  else if (sellThroughRate >= 0.3) score += 20;
  else if (sellThroughRate >= 0.1) score += 10;

  // Dagen op markt (max 50 punten)
  if (avgDaysOnMarket <= 14) score += 50;
  else if (avgDaysOnMarket <= 30) score += 35;
  else if (avgDaysOnMarket <= 60) score += 20;
  else if (avgDaysOnMarket <= 90) score += 10;

  // Label bepalen
  let label = 'Zeer incourant';
  if (score >= 80) label = 'Zeer courant';
  else if (score >= 60) label = 'Courant';
  else if (score >= 40) label = 'Gemiddeld';
  else if (score >= 20) label = 'Incourant';

  // Prijs impact: incourant = lagere waarde (max -6%)
  const priceImpact = score >= 60 ? 0 : -(60 - score) / 100 * 0.06;

  return { score, label, sellThroughRate, avgDaysToSell: avgDaysOnMarket, priceImpact };
}

// Stap 5: Markt Trend Berekening
async function calculateMarketTrend(
  supabase: any,
  make: string,
  model: string
): Promise<MarketTrend> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Mediaan van afgelopen 7 dagen
  const { data: recent7d } = await supabase
    .from('listings')
    .select('price')
    .eq('status', 'active')
    .ilike('make', make)
    .ilike('model', `%${model}%`)
    .gte('first_seen_at', sevenDaysAgo.toISOString())
    .not('price', 'is', null);

  // Mediaan van 8-30 dagen geleden
  const { data: older30d } = await supabase
    .from('listings')
    .select('price')
    .eq('status', 'active')
    .ilike('make', make)
    .ilike('model', `%${model}%`)
    .gte('first_seen_at', thirtyDaysAgo.toISOString())
    .lt('first_seen_at', sevenDaysAgo.toISOString())
    .not('price', 'is', null);

  if (!recent7d?.length || !older30d?.length) {
    return { percentage: 0, direction: 'stable', period: '7d vs 30d' };
  }

  const median7d = median(recent7d.map((r: any) => r.price));
  const median30d = median(older30d.map((r: any) => r.price));
  
  if (median30d === 0) {
    return { percentage: 0, direction: 'stable', period: '7d vs 30d' };
  }

  const change = ((median7d - median30d) / median30d) * 100;

  let direction: 'rising' | 'falling' | 'stable' = 'stable';
  if (change > 3) direction = 'rising';
  else if (change < -3) direction = 'falling';

  return { percentage: Math.round(change * 10) / 10, direction, period: '7d vs 30d' };
}

// Stap 6: Opties Matching & Premies
function calculateOptionsAdjustment(
  subjectOptions: string[],
  comparableOptionsRaw: (string | null)[]
): OptionsAnalysis {
  const adjustments: { option: string; label: string; value: number }[] = [];
  let totalAdjustment = 0;

  // Parse comparable options (from options_raw column)
  const comparableOptionSets = comparableOptionsRaw.map(raw => {
    if (!raw) return [];
    // Try to extract option keywords from raw text
    const lowerRaw = raw.toLowerCase();
    const found: string[] = [];
    for (const [key, data] of Object.entries(OPTION_VALUE_MAP)) {
      if (lowerRaw.includes(key.replace(/_/g, ' ')) || 
          lowerRaw.includes(data.label.toLowerCase())) {
        found.push(key);
      }
    }
    return found;
  });

  for (const option of subjectOptions) {
    const optionData = OPTION_VALUE_MAP[option];
    if (optionData) {
      // Check hoeveel comparables deze optie hebben
      const withOption = comparableOptionSets.filter(opts => opts.includes(option)).length;
      const withoutOption = comparableOptionSets.length - withOption;

      // Als meeste comparables de optie NIET hebben, voeg premie toe
      if (withoutOption > withOption) {
        const adjustedValue = Math.round(optionData.baseValue * 0.7); // 70% of full value
        adjustments.push({ option, label: optionData.label, value: adjustedValue });
        totalAdjustment += adjustedValue;
      }
    }
  }

  // Match score: hoeveel van subject's opties zitten in comparables?
  let matchedValue = 0;
  let totalValue = 0;

  for (const option of subjectOptions) {
    const optionData = OPTION_VALUE_MAP[option];
    if (optionData) {
      totalValue += optionData.baseValue;
      const avgHasOption = comparableOptionSets.length > 0
        ? comparableOptionSets.filter(opts => opts.includes(option)).length / comparableOptionSets.length
        : 0;
      matchedValue += optionData.baseValue * avgHasOption;
    }
  }

  const matchScore = totalValue > 0 ? Math.round((matchedValue / totalValue) * 100) : 100;

  return { matchScore, adjustments, totalAdjustment };
}

// Stap 8: Quality Checks & Warnings
function assessDataQuality(
  cohortSize: number,
  salesCount: number,
  avgDataAgeDays: number,
  criteriaUsed: { yearRange: number; mileageRange: number }
): QualityAssessment {
  const warnings: string[] = [];
  let quality: 'excellent' | 'good' | 'fair' | 'limited' = 'excellent';

  // Cohort size check
  if (cohortSize < 5) {
    warnings.push('Beperkt aantal vergelijkbare autos (<5). Taxatie is indicatief.');
    quality = 'limited';
  } else if (cohortSize < 10) {
    warnings.push('Relatief weinig vergelijkbare autos (<10).');
    if (quality === 'excellent') quality = 'good';
  }

  // Sales data check
  if (salesCount === 0) {
    warnings.push('Geen recente verkopen gevonden. Taxatie gebaseerd op vraagprijzen.');
    if (quality === 'excellent') quality = 'fair';
  } else if (salesCount < 3) {
    warnings.push('Weinig recente verkopen. Verkoopdata mogelijk niet representatief.');
    if (quality === 'excellent') quality = 'good';
  }

  // Data freshness check
  if (avgDataAgeDays > 60) {
    warnings.push('Data is ouder dan 60 dagen. Markt kan veranderd zijn.');
    if (quality === 'excellent' || quality === 'good') quality = 'fair';
  }

  // Criteria broadening check
  if (criteriaUsed.yearRange > 2 || criteriaUsed.mileageRange > 0.15) {
    warnings.push(`Zoekcriterias verruimd (±${criteriaUsed.yearRange} jaar, ±${Math.round(criteriaUsed.mileageRange * 100)}% km).`);
  }

  return { quality, warnings, cohortCriteria: criteriaUsed };
}

// Stap 7: Finale Waarde Berekening
function calculateFinalValue(
  cluster: { clusterMedian: number; clusterP10: number; clusterP90: number },
  weightedSalesPrice: number,
  livePriceMedian: number,
  soldPriceMedian: number,
  optionsAdjustment: number,
  courantheid: CourantheidResult,
  marketTrend: MarketTrend,
  hasEnoughSalesData: boolean
): PriceBreakdown {
  const lowestRealistic = cluster.clusterP10;
  let baseValue: number;

  if (hasEnoughSalesData && courantheid.score >= 60) {
    // Courant + voldoende sales: vertrouw op verkopen
    baseValue = (weightedSalesPrice * 0.5) +
      (cluster.clusterMedian * 0.35) +
      (lowestRealistic * 0.15);
  } else if (hasEnoughSalesData) {
    // Sales data maar incourant: mix
    baseValue = (weightedSalesPrice * 0.4) +
      (cluster.clusterMedian * 0.4) +
      (lowestRealistic * 0.2);
  } else {
    // Weinig sales: focus op huidige markt
    baseValue = (cluster.clusterMedian * 0.6) +
      (lowestRealistic * 0.4);
  }

  // Opties correctie
  const withOptions = baseValue + optionsAdjustment;

  // Courantheid correctie
  const courantheidAdjustment = Math.round(withOptions * courantheid.priceImpact);
  const afterCourantheid = withOptions + courantheidAdjustment;

  // Trend correctie (max ±2%)
  let trendMultiplier = 1;
  if (marketTrend.direction === 'rising') {
    trendMultiplier = 1.02;
  } else if (marketTrend.direction === 'falling') {
    trendMultiplier = 0.98;
  }
  const trendAdjustment = Math.round(afterCourantheid * (trendMultiplier - 1));
  const finalValue = Math.round(afterCourantheid + trendAdjustment);

  return {
    livePriceMedian,
    soldPriceMedian,
    weightedSalesPrice,
    clusterMedian: cluster.clusterMedian,
    lowestRealistic,
    optionsAdjustment,
    courantheidAdjustment,
    trendAdjustment,
    baseValue: Math.round(baseValue),
    finalValue,
  };
}

// Stap 9: AI Validatie & Finale Inzicht
async function getAIFinalValidation(
  apiKey: string,
  request: ValuationRequest,
  priceBreakdown: PriceBreakdown,
  courantheid: CourantheidResult,
  marketTrend: MarketTrend,
  cohortSize: number,
  salesCount: number,
  outlierCount: number
): Promise<{ insight: string; risks: string[]; adjustedValue: number | null }> {
  const prompt = `Je bent een ervaren Nederlandse automotive inkoper met 15 jaar marktkennis.

VOERTUIG:
- ${request.make} ${request.model} (${request.year})
- ${request.mileage.toLocaleString()} km, ${request.fuelType}
- Opties: ${request.options?.join(', ') || 'geen specifieke opties'}

MARKTANALYSE:
- Cohort grootte: ${cohortSize} vergelijkbare autos
- Live prijs mediaan: €${priceBreakdown.livePriceMedian.toLocaleString()}
- Gewogen verkoopprijs: €${priceBreakdown.weightedSalesPrice.toLocaleString()}
- Cluster mediaan (excl. uitschieters): €${priceBreakdown.clusterMedian.toLocaleString()}
- Uitschieters verwijderd: ${outlierCount}

COURANTHEID:
- Score: ${courantheid.score}/100 (${courantheid.label})
- Sell-through rate: ${Math.round(courantheid.sellThroughRate * 100)}%
- Gem. dagen op markt: ${courantheid.avgDaysToSell}

MARKT TREND:
- ${marketTrend.direction}: ${marketTrend.percentage}% (7d vs 30d)

BEREKENDE WAARDE:
- Basiswaarde: €${priceBreakdown.baseValue.toLocaleString()}
- Opties correctie: €${priceBreakdown.optionsAdjustment.toLocaleString()}
- Courantheid correctie: €${priceBreakdown.courantheidAdjustment.toLocaleString()}
- Trend correctie: €${priceBreakdown.trendAdjustment.toLocaleString()}
- Finale waarde: €${priceBreakdown.finalValue.toLocaleString()}

Valideer deze taxatie. Geef:
1. Een kort marktinzicht (2-3 zinnen)
2. Eventuele risico's of aandachtspunten (max 3)
3. Of je de waarde zou aanpassen en waarom

Antwoord in JSON:
{
  "insight": "marktinzicht in het Nederlands",
  "risks": ["risico1", "risico2"] of [],
  "adjustedValue": null of number indien aanpassing nodig,
  "adjustmentReason": "reden voor aanpassing" of null
}`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'Je bent een Nederlandse automotive waarde-expert. Antwoord altijd in valid JSON.' },
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

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        insight: parsed.insight || 'Geen AI inzicht beschikbaar.',
        risks: parsed.risks || [],
        adjustedValue: parsed.adjustedValue || null,
      };
    }
  } catch (e) {
    console.error('AI validation error:', e);
  }

  return {
    insight: `Taxatie gebaseerd op ${cohortSize} vergelijkbare voertuigen.`,
    risks: [],
    adjustedValue: null,
  };
}

// ============ MAIN HANDLER ============

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

    // ============ STAP 1: DYNAMISCHE COHORT SELECTIE ============
    let criteriaUsed = { yearRange: 1, mileageRange: 0.10 };
    let activeListings: any[] = [];
    let recentSales: any[] = [];

    const fetchCohort = async (criteria: { yearRange: number; mileageRange: number }) => {
      const fiftyDaysAgo = new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Active listings query
      let activeQuery = supabase
        .from('listings')
        .select('*')
        .eq('status', 'active')
        .ilike('make', request.make)
        .ilike('model', `%${request.model}%`)
        .gte('year', request.year - criteria.yearRange)
        .lte('year', request.year + criteria.yearRange)
        .gte('mileage', Math.round(request.mileage * (1 - criteria.mileageRange)))
        .lte('mileage', Math.round(request.mileage * (1 + criteria.mileageRange)))
        .not('price', 'is', null);

      if (request.fuelType) {
        activeQuery = activeQuery.ilike('fuel_type', `%${request.fuelType}%`);
      }
      if (request.transmission) {
        activeQuery = activeQuery.ilike('transmission', `%${request.transmission}%`);
      }

      const { data: active } = await activeQuery.limit(100);

      // Recent sales query (sold_confirmed events, max 50 days)
      let salesQuery = supabase
        .from('vehicle_events')
        .select('*')
        .eq('event_type', 'sold_confirmed')
        .ilike('make', request.make)
        .ilike('model', `%${request.model}%`)
        .gte('year', request.year - criteria.yearRange)
        .lte('year', request.year + criteria.yearRange)
        .gte('event_at', fiftyDaysAgo)
        .not('price_at_event', 'is', null);

      const { data: sales } = await salesQuery.limit(50);

      return { active: active || [], sales: sales || [] };
    };

    // Try strict criteria first
    let result = await fetchCohort(criteriaUsed);
    activeListings = result.active;
    recentSales = result.sales;

    // Broaden if not enough data
    if (activeListings.length + recentSales.length < 5) {
      criteriaUsed = { yearRange: 2, mileageRange: 0.15 };
      result = await fetchCohort(criteriaUsed);
      activeListings = result.active;
      recentSales = result.sales;
    }

    // Last fallback
    if (activeListings.length + recentSales.length < 5) {
      criteriaUsed = { yearRange: 3, mileageRange: 0.25 };
      result = await fetchCohort(criteriaUsed);
      activeListings = result.active;
      recentSales = result.sales;
    }

    console.log(`Cohort: ${activeListings.length} active, ${recentSales.length} sales (criteria: ±${criteriaUsed.yearRange}y, ±${Math.round(criteriaUsed.mileageRange * 100)}%km)`);

    // Check if we have any data
    if (activeListings.length === 0 && recentSales.length === 0) {
      return new Response(JSON.stringify({
        error: 'Geen vergelijkbare voertuigen gevonden',
        suggestion: 'Probeer andere zoekcriteria of wacht op meer data',
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============ STAP 2: CLUSTER ANALYSE ============
    const allPrices: number[] = [
      ...activeListings.map(l => l.price).filter(Boolean),
      ...recentSales.map(s => s.price_at_event).filter(Boolean),
    ];

    const cluster = findRealisticCluster(allPrices);
    console.log(`Cluster: ${cluster.clusterPrices.length} in cluster, ${cluster.outlierPrices.length} outliers`);

    // ============ STAP 3: TIJDSGEWOGEN VERKOPEN ============
    const salesForWeighting = recentSales
      .filter(s => s.price_at_event && cluster.clusterPrices.includes(s.price_at_event))
      .map(s => ({ price: s.price_at_event, eventAt: s.event_at }));

    const weightedSalesPrice = calculateWeightedSalesPrice(salesForWeighting);

    // ============ STAP 4: COURANTHEID SCORING ============
    const soldLast30Days = recentSales.filter(s => {
      const eventDate = new Date(s.event_at);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return eventDate >= thirtyDaysAgo;
    }).length;

    const daysOnMarketValues = recentSales
      .filter(s => s.days_on_market != null)
      .map(s => s.days_on_market);
    const avgDaysOnMarket = daysOnMarketValues.length > 0
      ? Math.round(daysOnMarketValues.reduce((a, b) => a + b, 0) / daysOnMarketValues.length)
      : 45;

    const courantheid = calculateCourantheid(activeListings.length, soldLast30Days, avgDaysOnMarket);
    console.log(`Courantheid: ${courantheid.score}/100 (${courantheid.label})`);

    // ============ STAP 5: MARKT TREND ============
    const marketTrend = await calculateMarketTrend(supabase, request.make, request.model);
    console.log(`Trend: ${marketTrend.direction} ${marketTrend.percentage}%`);

    // ============ STAP 6: OPTIES MATCHING ============
    const comparableOptionsRaw = activeListings.map(l => l.options_raw);
    const optionsAnalysis = calculateOptionsAdjustment(request.options || [], comparableOptionsRaw);
    console.log(`Options: match ${optionsAnalysis.matchScore}%, adjustment €${optionsAnalysis.totalAdjustment}`);

    // ============ STAP 7: FINALE WAARDE BEREKENING ============
    const livePriceMedian = median(activeListings.map(l => l.price).filter(Boolean));
    const soldPriceMedian = median(recentSales.map(s => s.price_at_event).filter(Boolean));
    const hasEnoughSalesData = salesForWeighting.length >= 3;

    const priceBreakdown = calculateFinalValue(
      cluster,
      weightedSalesPrice,
      livePriceMedian,
      soldPriceMedian,
      optionsAnalysis.totalAdjustment,
      courantheid,
      marketTrend,
      hasEnoughSalesData
    );

    // ============ STAP 8: QUALITY CHECKS ============
    const avgDataAgeDays = activeListings.length > 0
      ? Math.round(activeListings.reduce((sum, l) => {
          const days = Math.floor((Date.now() - new Date(l.first_seen_at).getTime()) / (1000 * 60 * 60 * 24));
          return sum + days;
        }, 0) / activeListings.length)
      : 0;

    const dataQuality = assessDataQuality(
      activeListings.length + recentSales.length,
      recentSales.length,
      avgDataAgeDays,
      criteriaUsed
    );

    // ============ STAP 9: AI VALIDATIE ============
    const aiResult = await getAIFinalValidation(
      lovableApiKey,
      request,
      priceBreakdown,
      courantheid,
      marketTrend,
      activeListings.length + recentSales.length,
      recentSales.length,
      cluster.outlierPrices.length
    );

    // Use AI adjusted value if provided and reasonable (within 10%)
    let finalEstimatedValue = priceBreakdown.finalValue;
    if (aiResult.adjustedValue) {
      const diff = Math.abs(aiResult.adjustedValue - priceBreakdown.finalValue) / priceBreakdown.finalValue;
      if (diff <= 0.10) {
        finalEstimatedValue = aiResult.adjustedValue;
      }
    }

    // ============ BUILD COMPARABLES ============
    const comparables: Comparable[] = [];
    const outliers: Comparable[] = [];

    // Add active listings
    for (const listing of activeListings) {
      if (listing.price) {
        const daysOnMarket = Math.floor(
          (Date.now() - new Date(listing.first_seen_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        const isOutlier = cluster.outlierPrices.includes(listing.price);
        const comp: Comparable = {
          id: listing.id,
          title: listing.title || `${listing.make} ${listing.model}`,
          price: listing.price,
          mileage: listing.mileage || 0,
          daysOnMarket,
          isSold: false,
          isOutlier,
        };
        if (isOutlier) {
          outliers.push(comp);
        } else {
          comparables.push(comp);
        }
      }
    }

    // Add recent sales
    for (const sale of recentSales) {
      if (sale.price_at_event) {
        const isOutlier = cluster.outlierPrices.includes(sale.price_at_event);
        const comp: Comparable = {
          id: sale.id,
          title: `${sale.make} ${sale.model}`,
          price: sale.price_at_event,
          mileage: sale.mileage || 0,
          daysOnMarket: sale.days_on_market || 0,
          soldAt: sale.event_at,
          isSold: true,
          isOutlier,
        };
        if (isOutlier) {
          outliers.push(comp);
        } else {
          comparables.push(comp);
        }
      }
    }

    // Sort comparables: sold first, then by price proximity to estimate
    comparables.sort((a, b) => {
      if (a.isSold !== b.isSold) return a.isSold ? -1 : 1;
      return Math.abs(a.price - finalEstimatedValue) - Math.abs(b.price - finalEstimatedValue);
    });

    // Calculate confidence
    const confidence = Math.min(100, Math.round(
      (Math.min(comparables.length / 20, 1) * 40) +
      (Math.min(recentSales.length / 10, 1) * 30) +
      (courantheid.score / 100 * 20) +
      (dataQuality.quality === 'excellent' ? 10 : dataQuality.quality === 'good' ? 7 : dataQuality.quality === 'fair' ? 4 : 0)
    ));

    const valuationResult: ValuationResult = {
      estimatedValue: finalEstimatedValue,
      confidence,
      priceBreakdown,
      priceRange: {
        low: cluster.clusterP10,
        mid: finalEstimatedValue,
        high: cluster.clusterP90,
      },
      courantheid,
      marketTrend,
      comparables: comparables.slice(0, 15),
      outliers: outliers.slice(0, 5),
      optionsAnalysis,
      marketInsight: aiResult.insight,
      risks: [...aiResult.risks, ...dataQuality.warnings].slice(0, 5),
      cohortSize: activeListings.length + recentSales.length,
      salesCount: recentSales.length,
      dataQuality,
    };

    console.log('Valuation complete:', {
      vehicle: `${request.make} ${request.model} ${request.year}`,
      value: valuationResult.estimatedValue,
      confidence: valuationResult.confidence,
      courantheid: valuationResult.courantheid.label,
    });

    return new Response(JSON.stringify(valuationResult), {
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
