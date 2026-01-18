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

interface Courantheid3D {
  score: number;
  label: string;
  sellThroughRate: number;  // STR
  marketDaysSupply: number; // MDS
  avgDaysOnMarket: number;  // DOM
  supplyStatus: 'undersupplied' | 'balanced' | 'oversupplied';
  priceImpact: number;      // +2%, 0%, -3%
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

interface MileageAdjustment {
  value: number;
  b_used: number;
  km_ref: number;
  n_used: number;
  source: 'sold' | 'combined' | 'fallback' | 'none';
  warning?: string;
}

interface ValueRange {
  low: number;
  mid: number;
  high: number;
}

interface PriceBreakdown {
  cohortLevel: 1 | 2 | 3;
  cohortSizeLive: number;
  cohortSizeSold: number;
  LMV: number;
  LMV_raw: number;
  OEV: number;
  lowestRealisticPrice: number;
  weightedBase: number;
  mileageAdjustment: MileageAdjustment;
  optionsAdjustment: number;
  courantheidPriceImpact: number;
  finalValue: number;
}

interface Confidence {
  score: number;
  reason: string;
}

interface QualityAssessment {
  quality: 'excellent' | 'good' | 'fair' | 'limited';
  warnings: string[];
}

interface ValuationResult {
  tradeInValue: ValueRange;
  fairMarketValue: ValueRange;
  retailValue: ValueRange;
  confidence: Confidence;
  warnings: string[];
  breakdown: PriceBreakdown;
  courantheid: Courantheid3D;
  comparables: Comparable[];
  outliers: Comparable[];
  marketTrend: MarketTrend;
  optionsAnalysis: OptionsAnalysis;
  marketInsight: string;
  risks: string[];
  
  // Legacy compatibility
  estimatedValue: number;
  priceRange: ValueRange;
  cohortSize: number;
  salesCount: number;
  dataQuality: QualityAssessment;
}

// ============ CONSTANTS ============

const ASKING_PRICE_DISCOUNT = 0.95;  // LMV = median * 0.95
const TIME_DECAY_DAYS = 50;
const B_CLAMP = { min: 0.005, max: 0.12 };  // Positief (euro/km)
const R_SQUARED_MIN = 0.2;
const KM_SPREAD_MIN = 25000;

// ============ MODEL ALIASES (DB-READY) ============

const MODEL_ALIASES: Record<string, string> = {
  'golf_7': 'golf', 'golf_vii': 'golf', 'golf_7.5': 'golf', 'golf_75': 'golf',
  'golf_8': 'golf', 'golf_viii': 'golf', 'golf_gti': 'golf', 'golf_r': 'golf',
  '3_serie': '3_serie', '3_series': '3_serie', '3er': '3_serie',
  '318i': '3_serie', '320i': '3_serie', '330i': '3_serie', '340i': '3_serie',
  '318d': '3_serie', '320d': '3_serie', '330d': '3_serie',
  'c_klasse': 'c_klasse', 'c_class': 'c_klasse', 'c_klasse_estate': 'c_klasse',
  'c180': 'c_klasse', 'c200': 'c_klasse', 'c220': 'c_klasse', 'c300': 'c_klasse',
  'c180d': 'c_klasse', 'c200d': 'c_klasse', 'c220d': 'c_klasse',
  'a4_avant': 'a4', 'a4_limousine': 'a4', 's4': 'a4', 'a4_allroad': 'a4',
  'clio_iv': 'clio', 'clio_v': 'clio', 'clio_4': 'clio', 'clio_5': 'clio',
  'polo_6': 'polo', 'polo_vi': 'polo', 'polo_6r': 'polo', 'polo_aw': 'polo',
  'model_3': 'model_3', 'model3': 'model_3',
  'model_y': 'model_y', 'modely': 'model_y',
};

// ============ OPTION VALUE MAP ============

const OPTION_VALUE_MAP: Record<string, { baseValue: number; label: string; category: string }> = {
  // Sport packages
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
  if (arr.length === 0) return 0;
  return percentile(arr, 0.5);
}

// ============ FIND REALISTIC CLUSTER (IQR + Minimum Sample Rule) ============

interface ClusterResult {
  clusterPrices: number[];
  outlierPrices: number[];
  clusterMedian: number;
  clusterP10: number;
  clusterP90: number;
  lowerBound: number;
  upperBound: number;
  wasFiltered: boolean;
}

function findRealisticCluster(prices: number[]): ClusterResult {
  if (prices.length === 0) {
    return { 
      clusterPrices: [], outlierPrices: [], clusterMedian: 0, 
      clusterP10: 0, clusterP90: 0, lowerBound: 0, upperBound: 0, wasFiltered: false 
    };
  }

  const sorted = [...prices].sort((a, b) => a - b);
  
  // MICRO-IMPROVEMENT 2: Bij n < 8, geen IQR filtering (instabiele bounds)
  if (prices.length < 8) {
    return {
      clusterPrices: sorted,
      outlierPrices: [],
      clusterMedian: median(sorted),
      clusterP10: percentile(sorted, 0.10),
      clusterP90: percentile(sorted, 0.90),
      lowerBound: sorted[0],
      upperBound: sorted[sorted.length - 1],
      wasFiltered: false,
    };
  }

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
    lowerBound,
    upperBound,
    wasFiltered: true,
  };
}

// ============ LINEAR REGRESSION (met negatieve slope check) ============

interface RegressionResult {
  b: number;        // Slope (negatief als correct)
  rSquared: number;
  kmSpread: number;
}

function linearRegression(data: { km: number; price: number }[]): RegressionResult | null {
  if (data.length < 5) return null;
  
  const n = data.length;
  const kms = data.map(d => d.km);
  const prices = data.map(d => d.price);
  
  // kmSpread check (p90 - p10)
  const sortedKm = [...kms].sort((a, b) => a - b);
  const kmSpread = sortedKm[Math.floor(n * 0.9)] - sortedKm[Math.floor(n * 0.1)];
  
  // Standard linear regression
  const sumX = kms.reduce((s, x) => s + x, 0);
  const sumY = prices.reduce((s, y) => s + y, 0);
  const sumXY = data.reduce((s, d) => s + d.km * d.price, 0);
  const sumXX = kms.reduce((s, x) => s + x * x, 0);
  
  const denom = (n * sumXX - sumX * sumX);
  if (denom === 0) return null;
  
  const b = (n * sumXY - sumX * sumY) / denom;
  const a = (sumY - b * sumX) / n;
  
  // b MOET negatief zijn (hogere km = lagere prijs)
  if (b >= 0) {
    console.log('Regression rejected: positive slope (b =', b, ')');
    return null;
  }
  
  // R-squared
  const meanY = sumY / n;
  const ssTotal = prices.reduce((s, y) => s + Math.pow(y - meanY, 2), 0);
  const ssRes = data.reduce((s, d) => s + Math.pow(d.price - (a + b * d.km), 2), 0);
  const rSquared = ssTotal > 0 ? 1 - (ssRes / ssTotal) : 0;
  
  return { b, rSquared, kmSpread };
}

// ============ NORMALIZE MODEL KEY (DB-READY) ============

function normalizeModelKey(make: string, model: string): string {
  const makeNorm = make.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace('mercedesbenz', 'mercedes')
    .replace('volkswagen', 'vw');
  
  const modelNorm = model.toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
  
  const baseModel = MODEL_ALIASES[modelNorm] || modelNorm.split('_')[0];
  return `${makeNorm}_${baseModel}`;
}

// ============ FIND MILEAGE COEFFICIENT (3-band fallback) ============

async function findMileageCoefficient(
  supabase: any,
  modelKey: string,
  year: number
): Promise<{ b_eur_per_km: number; n_samples: number } | null> {
  const startYear = year - 2;
  const endYear = year + 1;
  
  // FIX 3: Probeer 3 bands (exact, -1 jaar shift, +1 jaar shift)
  const bandsToTry = [
    `${startYear}-${endYear}`,           // exact: 2020-2023
    `${startYear - 1}-${endYear - 1}`,   // shift down: 2019-2022
    `${startYear + 1}-${endYear + 1}`,   // shift up: 2021-2024
  ];
  
  for (const band of bandsToTry) {
    const { data } = await supabase
      .from('mileage_coefficients')
      .select('b_eur_per_km, n_samples')
      .eq('model_key', modelKey)
      .eq('year_band', band)
      .maybeSingle();
    
    // b_eur_per_km is negatief in DB
    if (data?.b_eur_per_km && data.b_eur_per_km < 0) {
      console.log(`Found mileage coefficient for ${modelKey} band ${band}: b=${data.b_eur_per_km}`);
      return data;
    }
  }
  
  return null;
}

// ============ CALCULATE MILEAGE ADJUSTMENT (Data-Driven) ============

async function calculateMileageAdjustment(
  supabase: any,
  subjectMileage: number,
  soldDataRaw: { km: number; price: number }[],
  liveDataRaw: { km: number; price: number }[],
  make: string,
  model: string,
  year: number,
  baseValue: number
): Promise<MileageAdjustment> {
  
  // FIX 2: Gebruik IQR bounds voor filtering (niet P10/P90)
  const soldPrices = soldDataRaw.map(d => d.price);
  const soldCluster = findRealisticCluster(soldPrices);
  const soldFiltered = soldDataRaw.filter(d => 
    d.price >= soldCluster.lowerBound && d.price <= soldCluster.upperBound
  );
  
  const livePrices = liveDataRaw.map(d => d.price);
  const liveCluster = findRealisticCluster(livePrices);
  const liveFiltered = liveDataRaw.filter(d => 
    d.price >= liveCluster.lowerBound && d.price <= liveCluster.upperBound
  );
  
  // Helper voor adjustment berekening
  const calculateAdjustmentFromRegression = (
    data: { km: number; price: number }[],
    regression: RegressionResult,
    source: 'sold' | 'combined'
  ): MileageAdjustment => {
    const km_ref = median(data.map(d => d.km));
    const diff = km_ref - subjectMileage;
    
    // FIX 1: bAbs = -b (positief), diff × bAbs = correcte richting
    // diff > 0 (subject minder km) → adjustment positief → waarde omhoog ✅
    // diff < 0 (subject meer km) → adjustment negatief → waarde omlaag ✅
    const bAbs = Math.min(B_CLAMP.max, Math.max(B_CLAMP.min, -regression.b));
    const rawAdjustment = diff * bAbs;
    
    const cap = Math.max(1500, baseValue * 0.06);
    const adjustment = Math.max(-cap, Math.min(cap, rawAdjustment));
    
    console.log(`Mileage adjustment (${source}): km_ref=${km_ref}, diff=${diff}, bAbs=${bAbs.toFixed(4)}, raw=${rawAdjustment}, capped=${adjustment}`);
    
    return {
      value: Math.round(adjustment),
      b_used: bAbs,
      km_ref,
      n_used: data.length,
      source,
    };
  };
  
  // STAP 1: Probeer regressie op gefilterde SOLD (n >= 8)
  // MICRO-IMPROVEMENT 1: SOLD dataset = Observed Exit Value (laatste prijs voor verkoop)
  if (soldFiltered.length >= 8) {
    const regression = linearRegression(soldFiltered);
    if (regression && regression.rSquared > R_SQUARED_MIN && regression.kmSpread >= KM_SPREAD_MIN) {
      console.log(`Using SOLD regression: n=${soldFiltered.length}, r²=${regression.rSquared.toFixed(3)}, kmSpread=${regression.kmSpread}`);
      return calculateAdjustmentFromRegression(soldFiltered, regression, 'sold');
    }
  }
  
  // STAP 2: Probeer SOLD+LIVE combined (n >= 12)
  const combinedFiltered = [...soldFiltered, ...liveFiltered];
  if (combinedFiltered.length >= 12) {
    const regression = linearRegression(combinedFiltered);
    if (regression && regression.rSquared > R_SQUARED_MIN && regression.kmSpread >= KM_SPREAD_MIN) {
      console.log(`Using COMBINED regression: n=${combinedFiltered.length}, r²=${regression.rSquared.toFixed(3)}, kmSpread=${regression.kmSpread}`);
      return calculateAdjustmentFromRegression(combinedFiltered, regression, 'combined');
    }
  }
  
  // STAP 3: Fallback - probeer 3 year bands
  const modelKey = normalizeModelKey(make, model);
  const fallback = await findMileageCoefficient(supabase, modelKey, year);
  
  if (fallback) {
    const allData = combinedFiltered.length > 0 ? combinedFiltered : liveFiltered;
    const km_ref = allData.length > 0 ? median(allData.map(d => d.km)) : subjectMileage;
    const diff = km_ref - subjectMileage;
    
    // fallback.b_eur_per_km is negatief in DB, gebruik -b voor positief
    const bAbs = Math.min(B_CLAMP.max, Math.max(B_CLAMP.min, -fallback.b_eur_per_km));
    const rawAdjustment = diff * bAbs;
    const cap = Math.max(1500, baseValue * 0.06);
    const adjustment = Math.max(-cap, Math.min(cap, rawAdjustment));
    
    console.log(`Using FALLBACK coefficient: modelKey=${modelKey}, bAbs=${bAbs.toFixed(4)}, adjustment=${adjustment}`);
    
    return {
      value: Math.round(adjustment),
      b_used: bAbs,
      km_ref,
      n_used: fallback.n_samples,
      source: 'fallback',
    };
  }
  
  // STAP 4: Geen data
  const allData = [...soldFiltered, ...liveFiltered];
  const km_ref = allData.length > 0 ? median(allData.map(d => d.km)) : subjectMileage;
  
  console.log('No mileage adjustment: insufficient data or positive slope');
  
  return {
    value: 0,
    b_used: 0,
    km_ref,
    n_used: allData.length,
    source: 'none',
    warning: 'Geen km-correctie: onvoldoende data of positieve slope',
  };
}

// ============ TIME WEIGHT CALCULATION (50 dagen, exponential decay) ============

function calculateTimeWeight(soldDate: Date): number {
  const daysAgo = Math.floor((Date.now() - soldDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysAgo > TIME_DECAY_DAYS) return 0;
  // Exponential decay: dag 0 = 1.0, dag 25 = 0.5, dag 50 = 0.1
  return Math.exp(-daysAgo / 20);
}

// ============ CALCULATE OEV (Observed Exit Value) ============

function calculateOEV(sales: { price: number; eventAt: string }[]): number {
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

// ============ CALCULATE COURANTHEID 3D ============

function calculateCourantheid3D(
  liveCount: number,
  soldLast30Days: number,
  soldLast45Days: number,
  avgDaysOnMarket: number
): Courantheid3D {
  // STR: Sell-Through Rate
  const sellThroughRate = liveCount > 0 ? soldLast30Days / liveCount : 0;
  
  // MDS: Market Day's Supply
  const dailySalesRate = soldLast45Days / 45;
  const marketDaysSupply = dailySalesRate > 0 ? liveCount / dailySalesRate : 999;
  
  // Score berekening (0-100)
  let score = 0;
  
  // STR component (max 35 punten)
  if (sellThroughRate >= 0.8) score += 35;
  else if (sellThroughRate >= 0.5) score += 25;
  else if (sellThroughRate >= 0.3) score += 15;
  else if (sellThroughRate >= 0.1) score += 5;
  
  // MDS component (max 35 punten)
  if (marketDaysSupply <= 30) score += 35;
  else if (marketDaysSupply <= 60) score += 25;
  else if (marketDaysSupply <= 90) score += 15;
  else if (marketDaysSupply <= 120) score += 5;
  
  // DOM component (max 30 punten)
  if (avgDaysOnMarket <= 14) score += 30;
  else if (avgDaysOnMarket <= 30) score += 22;
  else if (avgDaysOnMarket <= 60) score += 12;
  else if (avgDaysOnMarket <= 90) score += 5;
  
  // Label
  let label = 'Zeer incourant';
  if (score >= 80) label = 'Zeer courant';
  else if (score >= 60) label = 'Courant';
  else if (score >= 40) label = 'Gemiddeld';
  else if (score >= 20) label = 'Incourant';
  
  // Supply status & price impact
  let supplyStatus: 'undersupplied' | 'balanced' | 'oversupplied';
  let priceImpact: number;
  
  if (marketDaysSupply < 30) {
    supplyStatus = 'undersupplied';
    priceImpact = 0.02;  // +2%
  } else if (marketDaysSupply > 90) {
    supplyStatus = 'oversupplied';
    priceImpact = -0.03; // -3%
  } else {
    supplyStatus = 'balanced';
    priceImpact = 0;
  }
  
  return {
    score,
    label,
    sellThroughRate,
    marketDaysSupply,
    avgDaysOnMarket,
    supplyStatus,
    priceImpact,
  };
}

// ============ CALCULATE OPTIONS ADJUSTMENT (Anti-Bias + LMV_raw Cap) ============

function calculateOptionsAdjustment(
  subjectOptions: string[],
  comparableOptionsRaw: (string | null)[],
  vehicleAge: number,
  lmvRaw: number  // MICRO-IMPROVEMENT 3: Gebruik LMV_raw (voor 5% discount)
): OptionsAnalysis {
  const adjustments: { option: string; label: string; value: number }[] = [];
  let totalAdjustment = 0;

  // Parse comparable options
  const comparableOptionSets = comparableOptionsRaw.map(raw => {
    if (!raw) return [];
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

  // Leeftijdsafschrijving multiplier
  let ageMultiplier = 1.0;
  if (vehicleAge >= 9) ageMultiplier = 0.30;
  else if (vehicleAge >= 6) ageMultiplier = 0.50;
  else if (vehicleAge >= 3) ageMultiplier = 0.70;

  for (const option of subjectOptions) {
    const optionData = OPTION_VALUE_MAP[option];
    if (optionData) {
      const withOption = comparableOptionSets.filter(opts => opts.includes(option)).length;
      const withoutOption = comparableOptionSets.length - withOption;

      let adjustedValue = 0;

      // Anti-bias check: market premium alleen als withOption >= 6 AND withoutOption >= 6
      if (withOption >= 6 && withoutOption >= 6) {
        // Echte market premium: 70% van baseValue
        adjustedValue = Math.round(optionData.baseValue * 0.70 * ageMultiplier);
      } else if (withoutOption > withOption) {
        // Conservative fallback: 40% van baseValue
        adjustedValue = Math.round(optionData.baseValue * 0.40 * ageMultiplier);
      }

      if (adjustedValue > 0) {
        adjustments.push({ option, label: optionData.label, value: adjustedValue });
        totalAdjustment += adjustedValue;
      }
    }
  }

  // Total cap op LMV_raw (NIET de gediscounte LMV)
  const maxTotalAdjustment = Math.min(3000, lmvRaw * 0.10);
  
  if (totalAdjustment > maxTotalAdjustment) {
    const scaleFactor = maxTotalAdjustment / totalAdjustment;
    for (const adj of adjustments) {
      adj.value = Math.round(adj.value * scaleFactor);
    }
    totalAdjustment = Math.round(maxTotalAdjustment);
  }

  // Match score
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

// ============ CALCULATE MARKET TREND ============

async function calculateMarketTrend(
  supabase: any,
  make: string,
  model: string
): Promise<MarketTrend> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const { data: recent7d } = await supabase
    .from('listings')
    .select('price')
    .eq('status', 'active')
    .ilike('make', make)
    .ilike('model', `%${model}%`)
    .gte('first_seen_at', sevenDaysAgo.toISOString())
    .not('price', 'is', null);

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

// ============ CALCULATE CONFIDENCE SCORE ============

function calculateConfidence(
  cohortLevel: 1 | 2 | 3,
  cohortSizeLive: number,
  cohortSizeSold: number,
  courantheid: Courantheid3D,
  dataQuality: 'excellent' | 'good' | 'fair' | 'limited'
): Confidence {
  let score = 0;
  const reasons: string[] = [];
  
  // Cohort level (max 25)
  if (cohortLevel === 1) {
    score += 25;
    reasons.push('Strict cohort match');
  } else if (cohortLevel === 2) {
    score += 15;
    reasons.push('Relaxed cohort');
  } else {
    score += 5;
    reasons.push('Fallback cohort');
  }
  
  // Live data (max 25)
  const liveScore = Math.min(cohortSizeLive / 20, 1) * 25;
  score += liveScore;
  if (cohortSizeLive >= 15) reasons.push('Sterke live data');
  
  // Sales data (max 30)
  const salesScore = Math.min(cohortSizeSold / 10, 1) * 30;
  score += salesScore;
  if (cohortSizeSold >= 8) reasons.push('Sterke verkoop data');
  
  // Courantheid (max 15)
  const courScore = (courantheid.score / 100) * 15;
  score += courScore;
  
  // Data quality (max 5)
  if (dataQuality === 'excellent') score += 5;
  else if (dataQuality === 'good') score += 3;
  else if (dataQuality === 'fair') score += 1;
  
  return {
    score: Math.round(Math.min(100, score)),
    reason: reasons.slice(0, 2).join('. ') + '.',
  };
}

// ============ CALCULATE FAIR MARKET VALUE ============

function calculateFairMarketValue(
  oev: number,
  lmv: number,
  lowestRealistic: number,
  mileageAdjustment: number,
  optionsAdjustment: number,
  courantheidPriceImpact: number,
  courantheid: Courantheid3D,
  confidence: number
): number {
  // Dynamische weging op basis van confidence EN courantheid
  let oevWeight: number, lmvWeight: number, lrpWeight: number;
  
  if (confidence < 50) {
    // Lage confidence: meer gewicht naar LowestRealistic
    oevWeight = 0.25;
    lmvWeight = 0.30;
    lrpWeight = 0.45;
  } else if (courantheid.score >= 70) {
    // Hoge courantheid: vertrouw op verkopen
    oevWeight = 0.55;
    lmvWeight = 0.30;
    lrpWeight = 0.15;
  } else if (courantheid.score >= 50) {
    // Gemiddelde courantheid
    oevWeight = 0.45;
    lmvWeight = 0.35;
    lrpWeight = 0.20;
  } else {
    // Lage courantheid: meer gewicht naar live markt
    oevWeight = 0.30;
    lmvWeight = 0.45;
    lrpWeight = 0.25;
  }
  
  // Stap 1: Gewogen basis
  const weightedBase = (oev * oevWeight) + (lmv * lmvWeight) + (lowestRealistic * lrpWeight);
  
  // Stap 2: Adjustments optellen
  const baseWithAdjustments = weightedBase + mileageAdjustment + optionsAdjustment;
  
  // Stap 3: Price impact op het GEHEEL toepassen (FMV formule clarification)
  const fairMarketValue = baseWithAdjustments * (1 + courantheidPriceImpact);
  
  console.log(`FMV calculation: OEV=${oev} (${oevWeight}), LMV=${lmv} (${lmvWeight}), LRP=${lowestRealistic} (${lrpWeight})`);
  console.log(`  weightedBase=${weightedBase}, +mileage=${mileageAdjustment}, +options=${optionsAdjustment}`);
  console.log(`  priceImpact=${courantheidPriceImpact}, FMV=${fairMarketValue}`);
  
  return Math.round(fairMarketValue);
}

// ============ CALCULATE VALUE TYPES ============

function calculateValueTypes(
  fmv: number,
  supplyStatus: 'undersupplied' | 'balanced' | 'oversupplied',
  clusterP10: number,
  clusterP90: number,
  confidence: number
): { tradeIn: ValueRange; fairMarket: ValueRange; retail: ValueRange } {
  
  // Dynamische marges op basis supply status
  let tradeInMargin: number, retailMargin: number;
  
  if (supplyStatus === 'undersupplied') {
    tradeInMargin = 0.10;
    retailMargin = 0.10;
  } else if (supplyStatus === 'oversupplied') {
    tradeInMargin = 0.15;
    retailMargin = 0.05;
  } else {
    tradeInMargin = 0.12;
    retailMargin = 0.08;
  }
  
  // Mid values
  const tradeInMid = Math.round(fmv * (1 - tradeInMargin));
  const retailMid = Math.round(fmv * (1 + retailMargin));
  
  // Ranges (breder bij lage confidence)
  const rangeMultiplier = confidence < 50 ? 1.15 : 1.0;
  const spread = ((clusterP90 - clusterP10) / 2) * rangeMultiplier;
  
  // Trade-in range
  const tradeIn: ValueRange = {
    low: Math.round(tradeInMid - spread * 0.6),
    mid: tradeInMid,
    high: Math.round(tradeInMid + spread * 0.4),
  };
  
  // Fair market range
  const fairMarket: ValueRange = {
    low: Math.round(fmv - spread * 0.5),
    mid: fmv,
    high: Math.round(fmv + spread * 0.5),
  };
  
  // Retail range
  const retail: ValueRange = {
    low: Math.round(retailMid - spread * 0.4),
    mid: retailMid,
    high: Math.round(retailMid + spread * 0.6),
  };
  
  return { tradeIn, fairMarket, retail };
}

// ============ AI BOUNDED ADVISOR ============

async function getAIValidation(
  apiKey: string,
  request: ValuationRequest,
  fmv: number,
  cluster: ClusterResult,
  courantheid: Courantheid3D,
  marketTrend: MarketTrend,
  cohortSizeLive: number,
  cohortSizeSold: number,
  confidence: number
): Promise<{ insight: string; risks: string[]; adjustedValue: number | null }> {
  const prompt = `Je bent een ervaren Nederlandse automotive inkoper met 15 jaar marktkennis.

VOERTUIG:
- ${request.make} ${request.model} (${request.year})
- ${request.mileage.toLocaleString()} km, ${request.fuelType}
- Opties: ${request.options?.join(', ') || 'geen specifieke opties'}

MARKTANALYSE:
- Live listings: ${cohortSizeLive}
- Recente verkopen: ${cohortSizeSold}
- Cluster mediaan: €${cluster.clusterMedian.toLocaleString()}
- P10-P90 range: €${cluster.clusterP10.toLocaleString()} - €${cluster.clusterP90.toLocaleString()}

COURANTHEID:
- Score: ${courantheid.score}/100 (${courantheid.label})
- Supply status: ${courantheid.supplyStatus}
- MDS: ${Math.round(courantheid.marketDaysSupply)} dagen

BEREKENDE FAIR MARKET VALUE:
- €${fmv.toLocaleString()}
- Confidence: ${confidence}%

MARKT TREND:
- ${marketTrend.direction}: ${marketTrend.percentage}%

Valideer deze taxatie. Geef:
1. Een kort marktinzicht (2-3 zinnen)
2. Eventuele risico's of aandachtspunten (max 3)
3. Of je de waarde zou aanpassen (ALLEEN als je sterke marktkennis hebt die afwijkt)

BELANGRIJK: Jouw aanpassing MOET binnen P10-P90 range liggen en mag max ${confidence >= 50 ? '10%' : '5%'} afwijken.

Antwoord in JSON:
{
  "insight": "marktinzicht in het Nederlands",
  "risks": ["risico1", "risico2"] of [],
  "adjustedValue": null of number,
  "adjustmentReason": "reden" of null
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

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      // AI Bounded check
      if (parsed.adjustedValue) {
        const withinCluster = parsed.adjustedValue >= cluster.clusterP10 && parsed.adjustedValue <= cluster.clusterP90;
        const maxPct = confidence >= 50 ? 0.10 : 0.05;
        const diff = Math.abs(parsed.adjustedValue - fmv) / fmv;
        const withinLimit = diff <= maxPct;
        
        if (!withinCluster || !withinLimit) {
          console.log(`AI adjustment rejected: withinCluster=${withinCluster}, withinLimit=${withinLimit} (diff=${(diff*100).toFixed(1)}%)`);
          parsed.adjustedValue = null;
        }
      }
      
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
    insight: `Taxatie gebaseerd op ${cohortSizeLive + cohortSizeSold} vergelijkbare voertuigen.`,
    risks: [],
    adjustedValue: null,
  };
}

// ============ ASSESS DATA QUALITY ============

function assessDataQuality(
  cohortSize: number,
  salesCount: number,
  avgDataAgeDays: number
): QualityAssessment {
  const warnings: string[] = [];
  let quality: 'excellent' | 'good' | 'fair' | 'limited' = 'excellent';

  if (cohortSize < 5) {
    warnings.push('Beperkt aantal vergelijkbare autos (<5). Taxatie is indicatief.');
    quality = 'limited';
  } else if (cohortSize < 10) {
    warnings.push('Relatief weinig vergelijkbare autos (<10).');
    if (quality === 'excellent') quality = 'good';
  }

  if (salesCount === 0) {
    warnings.push('Geen recente verkopen gevonden. Taxatie gebaseerd op vraagprijzen.');
    if (quality === 'excellent') quality = 'fair';
  } else if (salesCount < 3) {
    warnings.push('Weinig recente verkopen. Verkoopdata mogelijk niet representatief.');
    if (quality === 'excellent') quality = 'good';
  }

  if (avgDataAgeDays > 60) {
    warnings.push('Data is ouder dan 60 dagen. Markt kan veranderd zijn.');
    if (quality === 'excellent' || quality === 'good') quality = 'fair';
  }

  return { quality, warnings };
}

// ============ 3-LEVEL COHORT FETCHING ============

interface CohortResult {
  activeListings: any[];
  recentSales: any[];
  cohortLevel: 1 | 2 | 3;
}

async function fetchCohort(
  supabase: any,
  request: ValuationRequest
): Promise<CohortResult> {
  const fiftyDaysAgo = new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString();
  
  // Level 1: Strict
  const L1 = { yearRange: 1, mileageRange: 0.10 };
  let result = await fetchCohortWithCriteria(supabase, request, L1, fiftyDaysAgo);
  
  // Check minimums: 8 live OR 5 sold
  if (result.activeListings.length >= 8 || result.recentSales.length >= 5) {
    console.log(`L1 cohort: ${result.activeListings.length} live, ${result.recentSales.length} sold`);
    return { ...result, cohortLevel: 1 };
  }
  
  // Level 2: Relaxed
  const L2 = { yearRange: 2, mileageRange: 0.15 };
  result = await fetchCohortWithCriteria(supabase, request, L2, fiftyDaysAgo);
  
  if (result.activeListings.length >= 8 || result.recentSales.length >= 5) {
    console.log(`L2 cohort: ${result.activeListings.length} live, ${result.recentSales.length} sold`);
    return { ...result, cohortLevel: 2 };
  }
  
  // Level 3: Fallback
  const L3 = { yearRange: 3, mileageRange: 0.25 };
  result = await fetchCohortWithCriteria(supabase, request, L3, fiftyDaysAgo);
  
  console.log(`L3 cohort: ${result.activeListings.length} live, ${result.recentSales.length} sold`);
  return { ...result, cohortLevel: 3 };
}

async function fetchCohortWithCriteria(
  supabase: any,
  request: ValuationRequest,
  criteria: { yearRange: number; mileageRange: number },
  fiftyDaysAgo: string
): Promise<{ activeListings: any[]; recentSales: any[] }> {
  
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
  if (request.bodyType) {
    activeQuery = activeQuery.ilike('body_type', `%${request.bodyType}%`);
  }

  // Power bucket filter - alleen voor L1 (Strict): yearRange=1, mileageRange=0.10
  const isL1 = criteria.yearRange === 1 && criteria.mileageRange === 0.10;
  
  if (isL1) {
    // Power in pk. hp ≈ pk (verschil <1.4%), kW * 1.35962 = pk
    const powerPk =
      typeof request.power?.hp === 'number'
        ? request.power.hp
        : (typeof request.power?.kw === 'number' ? request.power.kw * 1.35962 : null);

    if (powerPk) {
      const minPower = Math.round(powerPk * 0.85);
      const maxPower = Math.round(powerPk * 1.15);
      activeQuery = activeQuery.gte('power_pk', minPower).lte('power_pk', maxPower);
      console.log(`L1 Power filter: ${minPower}-${maxPower} pk (from ${powerPk.toFixed(1)} pk)`);
    }
  }

  const { data: active } = await activeQuery.limit(100);

  // Recent sales query (vehicle_events with sold_confirmed)
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

  return { activeListings: active || [], recentSales: sales || [] };
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
    console.log('=== Golden Masterplan Valuation ===');
    console.log('Vehicle:', `${request.make} ${request.model} ${request.year}, ${request.mileage}km, ${request.fuelType}`);

    // Validate required fields
    if (!request.make || !request.model || !request.year || !request.mileage) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: make, model, year, mileage'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============ STAP 1: 3-LEVEL COHORT SELECTIE ============
    const { activeListings, recentSales, cohortLevel } = await fetchCohort(supabase, request);
    
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
    console.log(`Cluster: ${cluster.clusterPrices.length} in, ${cluster.outlierPrices.length} out, wasFiltered=${cluster.wasFiltered}`);

    // ============ STAP 3: LMV BEREKENING (op IQR-cluster) ============
    const livePrices = activeListings.map(l => l.price).filter(Boolean);
    
    // LMV op IQR-gefilterde cluster - findRealisticCluster handelt n<8 af
    const liveCluster = findRealisticCluster(livePrices);
    const lmvRaw = liveCluster.clusterMedian;  // Median van cluster (outlier-robust)
    const lmv = Math.round(lmvRaw * ASKING_PRICE_DISCOUNT);  // -5%
    console.log(`LMV: raw=${lmvRaw} (cluster n=${liveCluster.clusterPrices.length}, wasFiltered=${liveCluster.wasFiltered}), adjusted=${lmv}`);

    // ============ STAP 4: OEV (OBSERVED EXIT VALUE) ============
    const salesForOEV = recentSales
      .filter(s => s.price_at_event && cluster.clusterPrices.includes(s.price_at_event))
      .map(s => ({ price: s.price_at_event, eventAt: s.event_at }));
    
    const oev = calculateOEV(salesForOEV);
    console.log(`OEV: ${oev} (from ${salesForOEV.length} sales)`);

    // ============ STAP 5: COURANTHEID 3D ============
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const fortyFiveDaysAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    
    const soldLast30Days = recentSales.filter(s => new Date(s.event_at) >= thirtyDaysAgo).length;
    const soldLast45Days = recentSales.filter(s => new Date(s.event_at) >= fortyFiveDaysAgo).length;
    
    const daysOnMarketValues = recentSales
      .filter(s => s.days_on_market != null)
      .map(s => s.days_on_market);
    const avgDaysOnMarket = daysOnMarketValues.length > 0
      ? Math.round(daysOnMarketValues.reduce((a, b) => a + b, 0) / daysOnMarketValues.length)
      : 45;

    const courantheid = calculateCourantheid3D(
      activeListings.length,
      soldLast30Days,
      soldLast45Days,
      avgDaysOnMarket
    );
    console.log(`Courantheid: ${courantheid.score}/100 (${courantheid.label}), MDS=${Math.round(courantheid.marketDaysSupply)}, ${courantheid.supplyStatus}`);

    // ============ STAP 6: DATA QUALITY & INITIAL CONFIDENCE ============
    const avgDataAgeDays = activeListings.length > 0
      ? Math.round(activeListings.reduce((sum, l) => {
          const days = Math.floor((Date.now() - new Date(l.first_seen_at).getTime()) / (1000 * 60 * 60 * 24));
          return sum + days;
        }, 0) / activeListings.length)
      : 0;

    const dataQuality = assessDataQuality(
      activeListings.length + recentSales.length,
      recentSales.length,
      avgDataAgeDays
    );

    // ============ STAP 7: MILEAGE ADJUSTMENT ============
    // Prepare data for mileage regression
    const soldDataForMileage = recentSales
      .filter(s => s.price_at_event && s.mileage)
      .map(s => ({ km: s.mileage, price: s.price_at_event }));
    
    const liveDataForMileage = activeListings
      .filter(l => l.price && l.mileage)
      .map(l => ({ km: l.mileage, price: l.price }));
    
    // Use LMV as initial base for mileage cap calculation
    const mileageAdjustment = await calculateMileageAdjustment(
      supabase,
      request.mileage,
      soldDataForMileage,
      liveDataForMileage,
      request.make,
      request.model,
      request.year,
      lmv
    );

    // ============ STAP 8: OPTIONS ADJUSTMENT ============
    const vehicleAge = new Date().getFullYear() - request.year;
    const comparableOptionsRaw = activeListings.map(l => l.options_raw);
    const optionsAnalysis = calculateOptionsAdjustment(
      request.options || [],
      comparableOptionsRaw,
      vehicleAge,
      lmvRaw  // Use LMV_raw for options cap
    );
    console.log(`Options: match ${optionsAnalysis.matchScore}%, adjustment €${optionsAnalysis.totalAdjustment}`);

    // ============ STAP 9: MARKT TREND ============
    const marketTrend = await calculateMarketTrend(supabase, request.make, request.model);
    console.log(`Trend: ${marketTrend.direction} ${marketTrend.percentage}%`);

    // ============ STAP 10: CONFIDENCE SCORE ============
    const confidence = calculateConfidence(
      cohortLevel,
      activeListings.length,
      recentSales.length,
      courantheid,
      dataQuality.quality
    );

    // ============ STAP 11: FAIR MARKET VALUE ============
    const lowestRealistic = cluster.clusterP10;
    
    const fmv = calculateFairMarketValue(
      oev || lmv,  // Als geen OEV, gebruik LMV
      lmv,
      lowestRealistic,
      mileageAdjustment.value,
      optionsAnalysis.totalAdjustment,
      courantheid.priceImpact,
      courantheid,
      confidence.score
    );

    // ============ STAP 12: VALUE TYPES ============
    const valueTypes = calculateValueTypes(
      fmv,
      courantheid.supplyStatus,
      cluster.clusterP10,
      cluster.clusterP90,
      confidence.score
    );

    // ============ STAP 13: AI VALIDATION ============
    const aiResult = await getAIValidation(
      lovableApiKey,
      request,
      fmv,
      cluster,
      courantheid,
      marketTrend,
      activeListings.length,
      recentSales.length,
      confidence.score
    );

    // Apply AI adjustment if valid
    let finalFmv = fmv;
    if (aiResult.adjustedValue) {
      finalFmv = aiResult.adjustedValue;
      // Recalculate value types with adjusted FMV
      const adjustedValueTypes = calculateValueTypes(
        finalFmv,
        courantheid.supplyStatus,
        cluster.clusterP10,
        cluster.clusterP90,
        confidence.score
      );
      valueTypes.tradeIn = adjustedValueTypes.tradeIn;
      valueTypes.fairMarket = adjustedValueTypes.fairMarket;
      valueTypes.retail = adjustedValueTypes.retail;
    }

    // ============ BUILD COMPARABLES ============
    const comparables: Comparable[] = [];
    const outliers: Comparable[] = [];

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
        if (isOutlier) outliers.push(comp);
        else comparables.push(comp);
      }
    }

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
        if (isOutlier) outliers.push(comp);
        else comparables.push(comp);
      }
    }

    comparables.sort((a, b) => {
      if (a.isSold !== b.isSold) return a.isSold ? -1 : 1;
      return Math.abs(a.price - finalFmv) - Math.abs(b.price - finalFmv);
    });

    // ============ BUILD WARNINGS ============
    const warnings: string[] = [...dataQuality.warnings];
    if (mileageAdjustment.warning) warnings.push(mileageAdjustment.warning);
    if (cohortLevel === 3) warnings.push('Fallback cohort gebruikt (±3 jaar, ±25% km).');
    if (!cluster.wasFiltered) warnings.push('Kleine dataset: geen IQR filtering toegepast.');

    // ============ BUILD BREAKDOWN ============
    const breakdown: PriceBreakdown = {
      cohortLevel,
      cohortSizeLive: activeListings.length,
      cohortSizeSold: recentSales.length,
      LMV: lmv,
      LMV_raw: lmvRaw,
      OEV: oev,
      lowestRealisticPrice: lowestRealistic,
      weightedBase: Math.round((oev || lmv) * 0.45 + lmv * 0.35 + lowestRealistic * 0.20),
      mileageAdjustment,
      optionsAdjustment: optionsAnalysis.totalAdjustment,
      courantheidPriceImpact: courantheid.priceImpact,
      finalValue: finalFmv,
    };

    // ============ BUILD RESULT ============
    const valuationResult: ValuationResult = {
      tradeInValue: valueTypes.tradeIn,
      fairMarketValue: valueTypes.fairMarket,
      retailValue: valueTypes.retail,
      confidence,
      warnings,
      breakdown,
      courantheid,
      comparables: comparables.slice(0, 15),
      outliers: outliers.slice(0, 5),
      marketTrend,
      optionsAnalysis,
      marketInsight: aiResult.insight,
      risks: [...aiResult.risks, ...warnings].slice(0, 5),
      
      // Legacy compatibility
      estimatedValue: finalFmv,
      priceRange: valueTypes.fairMarket,
      cohortSize: activeListings.length + recentSales.length,
      salesCount: recentSales.length,
      dataQuality,
    };

    console.log('=== Valuation Complete ===');
    console.log(`FMV: €${finalFmv.toLocaleString()}, Confidence: ${confidence.score}%`);
    console.log(`Trade-in: €${valueTypes.tradeIn.mid.toLocaleString()}, Retail: €${valueTypes.retail.mid.toLocaleString()}`);

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
