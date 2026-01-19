import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ===== CONFIGURATION =====
const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1/scrape';
const DELAY_BETWEEN_REQUESTS_MS = 300;
const BATCH_SIZE = 50;

// ===== FILTERS (MVP: 2014+ and €2000+) =====
const MIN_YEAR = 2014;
const MIN_PRICE = 2000;
const MAX_UNKNOWN_YEAR_PRICE_PERCENT = 0.05; // 5% budget for unknown year/price

// ===== LIFECYCLE THRESHOLDS =====
const GONE_SUSPECTED_DAYS = 7;   // Mark as gone_suspected after 7 days not seen
const SOLD_CONFIRMED_DAYS = 30;  // Confirm as sold after 30 days

// ===== SAFETY THRESHOLDS =====
const DEFAULT_MAX_CREDITS_PER_DAY = 15000;
const DEFAULT_MAX_CREDITS_PER_RUN = 1000;
const DEFAULT_ERROR_RATE_THRESHOLD = 0.10;
const DEFAULT_PARSE_QUALITY_THRESHOLD = 0.60;
const SAFETY_CHECK_INTERVAL = 50;

// ===== HEALING THRESHOLDS =====
const HEALING_MAX_RETRIES = 2;
const HEALING_MIN_HOURS_BETWEEN_ATTEMPTS = 24;
const HEALING_DAILY_CAP = 50;

// ===== COMPLETENESS THRESHOLDS =====
const COMPLETENESS_OK_THRESHOLD = 70;
const COMPLETENESS_PARTIAL_THRESHOLD = 40;

// ===== TYPES =====
type JobMode = 'discovery' | 'lifecycle_check';
type ListingStatus = 'active' | 'gone_suspected' | 'sold_confirmed' | 'returned';
type DetailStatus = 'pending' | 'ok' | 'partial' | 'failed' | 'no_links' | 'skipped_existing';
type DealerKeyConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

interface IndexPageListing {
  url: string;
  title: string;
  price: number | null;
  year: number | null;
  mileage: number | null;
  fuelType: string | null;
  transmission: string | null;
  bodyType: string | null;
  color: string | null;
  doors: number | null;
  dealerName: string | null;
  dealerCity: string | null;
  outboundSources: string[];
  outboundLinks: Array<{ source: string; url: string; foundAt?: string }>;
  powerPk: number | null;
  imageUrlThumbnail: string | null;
  // GOLDEN MASTERPLAN v4: Gaspedaal occasion ID extraction
  gaspedaalOccasionId: string | null;
  gaspedaalDetailUrl: string | null;
  // Raw values for backup
  rawPrice?: string | null;
  rawYear?: string | null;
  rawMileage?: string | null;
}

interface DetailPageData {
  licensePlate: string | null;
  dealerPageUrl: string | null;
  // VOLLEDIG opslaan - geen afkappen
  optionsRawText: string | null;
  optionsRawList: string[];
  optionsRawHtml: string | null;
  descriptionRaw: string | null;
  // Specs als key/value
  specsTableRaw: Record<string, string>;
  // Motor/EV data
  engineCc: number | null;
  batteryCapacityKwh: number | null;
  electricRangeKm: number | null;
  drivetrain: string | null;
  vin: string | null;
  // Afbeeldingen
  imageUrlMain: string | null;
  imageCount: number;
}

interface CompletenessResult {
  score: number;
  status: DetailStatus;
  missingFields: string[];
}

interface SafetyConfig {
  maxCreditsPerDay: number;
  maxCreditsPerRun: number;
  errorRateThreshold: number;
  parseQualityThreshold: number;
}

interface SafetyState {
  creditsUsedToday: number;
  creditsUsedThisRun: number;
  indexRequests: number;
  detailRequests: number;
  totalProcessed: number;
  successfulParses: number;
  failedParses: number;
  unknownYearPriceCount: number;
  errors: number;
  stopReason: string | null;
  rawListingsSaved: number;
  detailHtmlSaved: number;
}

interface JobStats {
  pagesProcessed: number;
  listingsFound: number;
  listingsNew: number;
  listingsUpdated: number;
  listingsGoneSuspected: number;
  listingsSoldConfirmed: number;
  listingsReturned: number;
  errorsCount: number;
  rawListingsSaved: number;
  detailHtmlSaved: number;
  skippedIndexOnly: number;
  // NEW: Detail stats
  detailAttempted: number;
  detailOk: number;
  detailPartial: number;
  detailFailed: number;
  detailHealed: number;
  detailNoLinks: number;
  avgCompletenessScore: number;
  completenessScores: number[];
  missingFieldsCounts: Record<string, number>;
}

// ===== GOLDEN MASTERPLAN v4: MODEL ALIASES =====
const MODEL_ALIASES: Record<string, string> = {
  'golf_7': 'golf', 'golf_vii': 'golf', 'golf_8': 'golf', 'golf_viii': 'golf', 'golf_gti': 'golf', 'golf_r': 'golf',
  '3_serie': '3_serie', '3_series': '3_serie', '318i': '3_serie', '320i': '3_serie', '330i': '3_serie', '330e': '3_serie',
  '5_serie': '5_serie', '5_series': '5_serie', '520i': '5_serie', '530i': '5_serie', '530e': '5_serie',
  'c_klasse': 'c_klasse', 'c_class': 'c_klasse', 'c180': 'c_klasse', 'c200': 'c_klasse', 'c220': 'c_klasse', 'c300': 'c_klasse',
  'e_klasse': 'e_klasse', 'e_class': 'e_klasse', 'e200': 'e_klasse', 'e220': 'e_klasse', 'e300': 'e_klasse',
  'a_klasse': 'a_klasse', 'a_class': 'a_klasse', 'a180': 'a_klasse', 'a200': 'a_klasse',
  'a3': 'a3', 'a3_sportback': 'a3', 'a3_limousine': 'a3',
  'a4': 'a4', 'a4_avant': 'a4', 'a4_limousine': 'a4',
  'a6': 'a6', 'a6_avant': 'a6', 'a6_limousine': 'a6',
  'polo': 'polo', 'polo_gti': 'polo',
  't_roc': 't_roc', 'troc': 't_roc',
  'tiguan': 'tiguan', 'tiguan_allspace': 'tiguan',
  'model_3': 'model_3', 'model3': 'model_3',
  'model_y': 'model_y', 'modely': 'model_y',
  'model_s': 'model_s', 'models': 'model_s',
  'model_x': 'model_x', 'modelx': 'model_x',
  'yaris': 'yaris', 'yaris_cross': 'yaris',
  'corolla': 'corolla', 'corolla_cross': 'corolla',
  'rav4': 'rav4', 'rav_4': 'rav4',
  'kona': 'kona', 'kona_electric': 'kona',
  'tucson': 'tucson',
  'ioniq': 'ioniq', 'ioniq_5': 'ioniq_5', 'ioniq_6': 'ioniq_6',
  'niro': 'niro', 'e_niro': 'niro',
  'ev6': 'ev6',
  'ceed': 'ceed', 'proceed': 'ceed', 'xceed': 'ceed',
  '208': '208', 'e_208': '208',
  '308': '308', 'e_308': '308',
  '508': '508',
  '2008': '2008', 'e_2008': '2008',
  '3008': '3008', 'e_3008': '3008',
  'clio': 'clio',
  'captur': 'captur',
  'megane': 'megane', 'megane_e_tech': 'megane',
  'zoe': 'zoe',
  'octavia': 'octavia', 'octavia_combi': 'octavia',
  'superb': 'superb', 'superb_combi': 'superb',
  'kodiaq': 'kodiaq',
  'kamiq': 'kamiq',
  'enyaq': 'enyaq', 'enyaq_iv': 'enyaq',
  'leon': 'leon',
  'ibiza': 'ibiza',
  'ateca': 'ateca',
  'arona': 'arona',
  'formentor': 'formentor',
  'born': 'born',
  'id_3': 'id_3', 'id3': 'id_3',
  'id_4': 'id_4', 'id4': 'id_4',
  'id_5': 'id_5', 'id5': 'id_5',
  'xc40': 'xc40',
  'xc60': 'xc60',
  'xc90': 'xc90',
  'v60': 'v60',
  's60': 's60',
  'v90': 'v90',
  's90': 's90',
  'c40': 'c40',
  'ex30': 'ex30',
  'ex90': 'ex90',
  'corsa': 'corsa', 'corsa_e': 'corsa',
  'astra': 'astra',
  'mokka': 'mokka', 'mokka_e': 'mokka',
  'grandland': 'grandland', 'grandland_x': 'grandland',
  'crossland': 'crossland', 'crossland_x': 'crossland',
  'focus': 'focus',
  'fiesta': 'fiesta',
  'puma': 'puma',
  'kuga': 'kuga',
  'mustang_mach_e': 'mustang_mach_e', 'mach_e': 'mustang_mach_e',
  '500': '500', '500e': '500', 'fiat_500': '500',
  'c3': 'c3',
  'c4': 'c4',
  'c5_aircross': 'c5_aircross', 'c5': 'c5',
  'e_c4': 'c4',
  'mini_cooper': 'cooper', 'cooper': 'cooper', 'cooper_s': 'cooper', 'cooper_se': 'cooper',
  'countryman': 'countryman',
  'clubman': 'clubman',
  '01': '01', 'lynk_01': '01',
  'cx_30': 'cx_30', 'cx30': 'cx_30',
  'cx_5': 'cx_5', 'cx5': 'cx_5',
  'mx_30': 'mx_30', 'mx30': 'mx_30',
  'mazda3': 'mazda3', 'mazda_3': 'mazda3',
};

// ===== HELPER: SHA-256 Hash =====
async function createHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ===== HELPER: License Plate Hash (Privacy) =====
async function hashLicensePlate(plate: string | null): Promise<string | null> {
  if (!plate) return null;
  const normalized = plate.replace(/[\s-]/g, '').toUpperCase();
  return createHash(normalized);
}

// ===== HELPER: VIN Hash (Privacy) =====
async function hashVin(vin: string | null): Promise<string | null> {
  if (!vin) return null;
  const normalized = vin.toUpperCase().trim();
  if (normalized.length !== 17) return null; // Invalid VIN
  return createHash(normalized);
}

// ===== GOLDEN MASTERPLAN v4: HTML SANITIZER (KRITIEK!) =====
function sanitizeReactHtml(html: string): string {
  // Remove React hydration comments that break parsing
  // Converts: >130<!-- -->000<!-- -->km => >130000km
  return html
    .replace(/<!--\s*-->/g, '')
    .replace(/<!-- -->/g, '')
    .replace(/<!--.*?-->/g, '');
}

// ===== GOLDEN MASTERPLAN v4: CANONICAL URL FUNCTIONS =====
function canonicalizeExternalUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Strip tracking parameters
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 
                           'ref', 'origin', 'fbclid', 'gclid', 'msclkid', 'source'];
    trackingParams.forEach(p => parsed.searchParams.delete(p));
    // Normalize: lowercase path, remove trailing slash
    return parsed.origin + parsed.pathname.toLowerCase().replace(/\/$/, '');
  } catch {
    return url.toLowerCase().split('?')[0];
  }
}

async function hashExternalUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  const canonical = canonicalizeExternalUrl(url);
  return createHash(canonical);
}

// ===== GOLDEN MASTERPLAN v4: DEALER KEY EXTRACTION =====
function extractDealerKey(
  outboundLinks: Array<{ source: string; url: string }>,
  dealerName: string | null
): { dealerKey: string; confidence: DealerKeyConfidence } {
  // Priority 1: Dealer domain from outbound links (HIGH confidence)
  const dealerLink = outboundLinks.find(l => l.source === 'dealersite');
  if (dealerLink?.url) {
    try {
      const domain = new URL(dealerLink.url).hostname
        .replace(/^www\./, '')
        .toLowerCase();
      return { dealerKey: domain, confidence: 'HIGH' };
    } catch {}
  }
  
  // Priority 2: Normalized dealer name (MEDIUM confidence)
  if (dealerName && dealerName.length > 2) {
    const normalized = dealerName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 30);
    if (normalized.length >= 3) {
      return { dealerKey: normalized, confidence: 'MEDIUM' };
    }
  }
  
  // Priority 3: Unknown (LOW confidence - no soft matching allowed)
  return { dealerKey: 'unknown', confidence: 'LOW' };
}

// ===== GOLDEN MASTERPLAN v4: MODEL NORMALIZATION =====
function normalizeModelKey(make: string, model: string): string {
  const makeNorm = make.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace('mercedesbenz', 'mercedes')
    .replace('volkswagen', 'vw')
    .replace('lynkco', 'lynk');
  
  const modelNorm = model.toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
  
  const baseModel = MODEL_ALIASES[modelNorm] || modelNorm.split('_')[0];
  return `${makeNorm}_${baseModel}`;
}

// ===== GOLDEN MASTERPLAN v4: FINGERPRINT v2 (Dealer-Scoped, No Price, No Color) =====
async function generateVehicleFingerprintV2(
  dealerKey: string,
  listing: {
    make?: string | null;
    model?: string | null;
    year?: number | null;
    fuelType?: string | null;
    transmission?: string | null;
    bodyType?: string | null;
    mileage?: number | null;
    powerPk?: number | null;
    imageUrl?: string | null;
  }
): Promise<string> {
  const normalize = (s: string | null | undefined) => 
    (s || '').toLowerCase().trim().replace(/\s+/g, '');
  
  // Buckets (robuuster - 10k voor mileage, 10pk voor power)
  const mileageBucket = listing.mileage 
    ? Math.round(listing.mileage / 10000) * 10000 : 0;  // 10k buckets
  const powerBucket = listing.powerPk
    ? Math.round(listing.powerPk / 10) * 10 : 0;        // 10pk buckets
  
  // Model normalisatie met aliases
  const modelKey = (listing.make && listing.model)
    ? normalizeModelKey(listing.make, listing.model)
    : `${normalize(listing.make)}_${normalize(listing.model)}`;
  
  // Image hash (bestandsnaam uit URL - max 20 chars)
  const imageHash = listing.imageUrl 
    ? listing.imageUrl.split('/').pop()?.split('?')[0]?.substring(0, 20) || '' 
    : '';
  
  // DEALER KEY is eerste element - maakt fingerprint dealer-scoped
  // GEEN prijs, GEEN kleur in fingerprint!
  const fingerprintBase = [
    dealerKey,                    // <= DEALER SCOPED
    modelKey,
    listing.year || 'unknown',
    normalize(listing.fuelType),
    normalize(listing.transmission),
    normalize(listing.bodyType),
    mileageBucket,
    powerBucket,
    imageHash,
  ].join('|');
  
  return createHash(fingerprintBase);
}

// ===== OLD FINGERPRINT (for backwards compatibility/logging) =====
function generateVehicleFingerprint(listing: {
  make?: string | null;
  model?: string | null;
  year?: number | null;
  fuelType?: string | null;
  bodyType?: string | null;
  color?: string | null;
  mileage?: number | null;
  dealerName?: string | null;
}): string {
  const normalize = (s: string | null | undefined) => 
    (s || '').toLowerCase().trim().replace(/\s+/g, '');
  
  const mileageBucket = listing.mileage 
    ? Math.round(listing.mileage / 5000) * 5000 
    : 0;
  
  return [
    normalize(listing.make),
    normalize(listing.model),
    listing.year || 'unknown',
    normalize(listing.fuelType),
    normalize(listing.bodyType),
    normalize(listing.color),
    mileageBucket,
    normalize(listing.dealerName),
  ].join('|');
}

// ===== GOLDEN MASTERPLAN v4: READINESS DETERMINATION =====
function determineReadiness(
  listing: any,
  dealerKeyConfidence: DealerKeyConfidence,
  detailStatus: DetailStatus,
  completenessScore: number
): { listingReady: boolean; taxationReady: boolean } {
  
  // LISTING READY: voldoende voor markt monitoring
  const listingReady = !!(
    listing.make &&
    listing.model &&
    listing.year &&
    listing.price &&
    listing.fuel_type
  );
  
  // TAXATION READY: voldoende voor precieze taxatie
  const taxationReady = !!(
    listingReady &&
    listing.mileage &&
    listing.transmission &&
    listing.body_type &&
    dealerKeyConfidence !== 'LOW' &&
    (
      (detailStatus === 'ok' || detailStatus === 'partial') && completenessScore >= 70
      || detailStatus === 'no_links' // Listing-only mode (lagere confidence)
    )
  );
  
  return { listingReady, taxationReady };
}

// ===== COMPLETENESS SCORING =====
function calculateCompletenessScore(
  detailData: DetailPageData | null,
  listing: IndexPageListing
): CompletenessResult {
  if (!detailData) {
    return { score: 0, status: 'failed', missingFields: ['all_detail_data'] };
  }
  
  const checks = [
    { name: 'options_raw_text', weight: 25, ok: (detailData.optionsRawText?.length || 0) > 200 },
    { name: 'options_raw_list', weight: 15, ok: (detailData.optionsRawList?.length || 0) >= 5 },
    { name: 'description_raw', weight: 20, ok: (detailData.descriptionRaw?.length || 0) > 100 },
    { name: 'specs_table', weight: 15, ok: Object.keys(detailData.specsTableRaw || {}).length >= 5 },
    { name: 'license_plate', weight: 15, ok: detailData.licensePlate !== null },
    { name: 'image_count', weight: 10, ok: detailData.imageCount >= 3 },
  ];
  
  let score = 0;
  const missingFields: string[] = [];
  
  for (const check of checks) {
    if (check.ok) {
      score += check.weight;
    } else {
      missingFields.push(check.name);
    }
  }
  
  let status: DetailStatus;
  if (score >= COMPLETENESS_OK_THRESHOLD) {
    status = 'ok';
  } else if (score >= COMPLETENESS_PARTIAL_THRESHOLD) {
    status = 'partial';
  } else {
    status = 'failed';
  }
  
  return { score, status, missingFields };
}

// ===== HELPER: Content Hash =====
async function createContentHash(listing: IndexPageListing): Promise<string> {
  const content = [
    listing.price || '',
    listing.mileage || '',
    listing.year || '',
    listing.title,
    listing.fuelType || '',
    listing.transmission || '',
  ].join('|');
  return createHash(content);
}

// ===== HELPER: Parse Functions =====
function safeParsePrice(raw: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d]/g, '');
  const value = parseInt(cleaned, 10);
  return isNaN(value) || value === 0 ? null : value;
}

function safeParseMileage(raw: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d]/g, '');
  const value = parseInt(cleaned, 10);
  return isNaN(value) ? null : value;
}

function safeParseYear(raw: string | null): number | null {
  if (!raw) return null;
  const match = raw.match(/\d{4}/);
  return match ? parseInt(match[0], 10) : null;
}

function safeParseDoors(raw: string | null): number | null {
  if (!raw) return null;
  const match = raw.match(/\d/);
  return match ? parseInt(match[0], 10) : null;
}

function safeParsePower(raw: string | null): number | null {
  if (!raw) return null;
  // Match patterns like "140pk", "103kW", "140 pk"
  const pkMatch = raw.match(/(\d+)\s*pk/i);
  if (pkMatch) return parseInt(pkMatch[1], 10);
  
  const kwMatch = raw.match(/(\d+)\s*kw/i);
  if (kwMatch) return Math.round(parseInt(kwMatch[1], 10) * 1.36); // Convert kW to pk
  
  return null;
}

// ===== HELPER: Delay =====
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== HELPER: Days difference =====
function daysSince(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

// ===== HELPER: Hours difference =====
function hoursSince(dateStr: string | null): number {
  if (!dateStr) return Infinity;
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
}

// ===== SAFETY: Check if we should stop =====
function checkSafetyLimits(
  safety: SafetyState,
  config: SafetyConfig
): { shouldStop: boolean; reason: string | null } {
  // Check daily credit budget
  if (safety.creditsUsedToday >= config.maxCreditsPerDay) {
    return { 
      shouldStop: true, 
      reason: `Daily credit budget reached (${safety.creditsUsedToday}/${config.maxCreditsPerDay})` 
    };
  }

  // Check per-run credit budget
  if (safety.creditsUsedThisRun >= config.maxCreditsPerRun) {
    return { 
      shouldStop: true, 
      reason: `Per-run credit budget reached (${safety.creditsUsedThisRun}/${config.maxCreditsPerRun})` 
    };
  }

  // Check error rate (only after processing enough items)
  if (safety.totalProcessed >= SAFETY_CHECK_INTERVAL) {
    const errorRate = safety.errors / safety.totalProcessed;
    if (errorRate > config.errorRateThreshold) {
      return { 
        shouldStop: true, 
        reason: `Error rate too high: ${(errorRate * 100).toFixed(1)}% (threshold: ${(config.errorRateThreshold * 100).toFixed(1)}%)` 
      };
    }
  }

  // Check parse quality (only after processing enough items)
  if (safety.totalProcessed >= SAFETY_CHECK_INTERVAL) {
    const totalParses = safety.successfulParses + safety.failedParses;
    if (totalParses > 0) {
      const parseRate = safety.successfulParses / totalParses;
      if (parseRate < config.parseQualityThreshold) {
        return { 
          shouldStop: true, 
          reason: `Parse success rate too low: ${(parseRate * 100).toFixed(1)}% (threshold: ${(config.parseQualityThreshold * 100).toFixed(1)}%)` 
        };
      }
    }
  }

  return { shouldStop: false, reason: null };
}

// ===== CREDIT TRACKING =====
async function updateDailyCreditUsage(
  supabase: any,
  source: string,
  credits: number,
  indexReqs: number,
  detailReqs: number
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    const { data: existing } = await supabase
      .from('scraper_credit_usage')
      .select('id, credits_used, sitemap_requests, detail_requests, jobs_count')
      .eq('date', today)
      .eq('source', source)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('scraper_credit_usage')
        .update({
          credits_used: existing.credits_used + credits,
          sitemap_requests: existing.sitemap_requests + indexReqs,
          detail_requests: existing.detail_requests + detailReqs,
          jobs_count: existing.jobs_count + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('scraper_credit_usage')
        .insert({
          date: today,
          source,
          credits_used: credits,
          sitemap_requests: indexReqs,
          detail_requests: detailReqs,
          jobs_count: 1,
        });
    }
  } catch (error) {
    console.error('Error updating credit usage:', error);
  }
}

async function getTodayCreditUsage(supabase: any, source: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    const { data } = await supabase
      .from('scraper_credit_usage')
      .select('credits_used')
      .eq('date', today)
      .eq('source', source)
      .maybeSingle();

    return data?.credits_used || 0;
  } catch {
    return 0;
  }
}

// ===== RAW LISTING: Save raw data before parsing =====
async function saveRawListing(
  supabase: any,
  listing: IndexPageListing,
  detailData: DetailPageData | null,
  detailHtml: string | null,
  contentHash: string,
  stats: JobStats,
  safety: SafetyState,
  chosenDetailSource: string | null,
  chosenDetailUrl: string | null,
  canonicalUrl: string
): Promise<string | null> {
  try {
    const now = new Date().toISOString();
    
    // Prepare raw_specs with ALL extracted data
    const rawSpecs: Record<string, any> = {
      fuel_type: listing.fuelType,
      transmission: listing.transmission,
      body_type: listing.bodyType,
      color: listing.color,
      doors: listing.doors,
      power_pk: listing.powerPk,
      outbound_sources: listing.outboundSources,
      // specs_table from detail page
      specs_table: detailData?.specsTableRaw || {},
      // EV/Motor data
      engine_cc: detailData?.engineCc,
      battery_capacity_kwh: detailData?.batteryCapacityKwh,
      electric_range_km: detailData?.electricRangeKm,
      drivetrain: detailData?.drivetrain,
      vin: detailData?.vin,
    };
    
    // Hash VIN if present
    const vinHash = detailData?.vin ? await hashVin(detailData.vin) : null;
    
    // Check if raw listing already exists by canonical URL
    const { data: existing } = await supabase
      .from('raw_listings')
      .select('id, content_hash, consecutive_misses')
      .eq('canonical_url', canonicalUrl)
      .maybeSingle();

    // Fallback: check by original URL if canonical not found
    let existingRecord = existing;
    if (!existingRecord) {
      const { data: existingByUrl } = await supabase
        .from('raw_listings')
        .select('id, content_hash, consecutive_misses')
        .eq('url', listing.url)
        .maybeSingle();
      existingRecord = existingByUrl;
    }

    if (existingRecord) {
      // Update existing raw listing
      const updateData: Record<string, any> = {
        content_hash: contentHash,
        canonical_url: canonicalUrl,
        last_seen_at: now,
        scraped_at: now,
        raw_title: listing.title,
        raw_price: listing.rawPrice || String(listing.price || ''),
        raw_year: listing.rawYear || String(listing.year || ''),
        raw_mileage: listing.rawMileage || String(listing.mileage || ''),
        raw_specs: rawSpecs,
        dealer_name_raw: listing.dealerName,
        dealer_city_raw: listing.dealerCity,
        consecutive_misses: 0,
        outbound_links: listing.outboundLinks,
        chosen_detail_source: chosenDetailSource,
        chosen_detail_url: chosenDetailUrl,
        vin_hash: vinHash,
        gaspedaal_occasion_id: listing.gaspedaalOccasionId,
        gaspedaal_detail_url: listing.gaspedaalDetailUrl,
      };
      
      // Add detail data if available
      if (detailData) {
        updateData.options_raw_text = detailData.optionsRawText;
        updateData.options_raw_list = detailData.optionsRawList;
        updateData.options_raw_html = detailData.optionsRawHtml;
        updateData.description_raw = detailData.descriptionRaw;
        updateData.image_url_main = detailData.imageUrlMain;
        updateData.image_count = detailData.imageCount;
        updateData.dealer_page_url = detailData.dealerPageUrl;
      }
      
      // Save detail HTML as backup (CRITICAL for data recovery)
      if (detailHtml) {
        updateData.html_detail = detailHtml;
        updateData.html_detail_size = detailHtml.length;
        updateData.detail_scraped_at = now;
        safety.detailHtmlSaved++;
        stats.detailHtmlSaved++;
      }
      
      await supabase
        .from('raw_listings')
        .update(updateData)
        .eq('id', existingRecord.id);
      
      return existingRecord.id;
    } else {
      // Insert new raw listing
      const insertData: Record<string, any> = {
        url: listing.url,
        canonical_url: canonicalUrl,
        source: 'gaspedaal',
        content_hash: contentHash,
        raw_title: listing.title,
        raw_price: listing.rawPrice || String(listing.price || ''),
        raw_year: listing.rawYear || String(listing.year || ''),
        raw_mileage: listing.rawMileage || String(listing.mileage || ''),
        raw_specs: rawSpecs,
        dealer_name_raw: listing.dealerName,
        dealer_city_raw: listing.dealerCity,
        first_seen_at: now,
        last_seen_at: now,
        scraped_at: now,
        outbound_links: listing.outboundLinks,
        chosen_detail_source: chosenDetailSource,
        chosen_detail_url: chosenDetailUrl,
        vin_hash: vinHash,
        gaspedaal_occasion_id: listing.gaspedaalOccasionId,
        gaspedaal_detail_url: listing.gaspedaalDetailUrl,
      };
      
      // Add detail data if available
      if (detailData) {
        insertData.options_raw_text = detailData.optionsRawText;
        insertData.options_raw_list = detailData.optionsRawList;
        insertData.options_raw_html = detailData.optionsRawHtml;
        insertData.description_raw = detailData.descriptionRaw;
        insertData.image_url_main = detailData.imageUrlMain;
        insertData.image_count = detailData.imageCount;
        insertData.dealer_page_url = detailData.dealerPageUrl;
      }
      
      // Save detail HTML as backup
      if (detailHtml) {
        insertData.html_detail = detailHtml;
        insertData.html_detail_size = detailHtml.length;
        insertData.detail_scraped_at = now;
        safety.detailHtmlSaved++;
        stats.detailHtmlSaved++;
      }
      
      const { data: newRaw, error } = await supabase
        .from('raw_listings')
        .insert(insertData)
        .select('id')
        .single();

      if (error) {
        console.error('Error saving raw listing:', error);
        return null;
      }
      
      stats.rawListingsSaved++;
      return newRaw.id;
    }
  } catch (error) {
    console.error('Error in saveRawListing:', error);
    return null;
  }
}

// ===== FIRECRAWL: Scrape URL =====
async function scrapeWithFirecrawl(
  url: string, 
  apiKey: string,
  safety: SafetyState,
  isIndexPage: boolean = false,
  dryRun: boolean = false
): Promise<string | null> {
  // DRY RUN: Simulate without using credits
  if (dryRun) {
    console.log(`[DRY RUN] Would scrape: ${url}`);
    return `<!-- DRY RUN: Simulated HTML for ${url} -->`;
  }

  try {
    safety.creditsUsedToday++;
    safety.creditsUsedThisRun++;
    
    if (isIndexPage) {
      safety.indexRequests++;
    } else {
      safety.detailRequests++;
    }

    console.log(`[FIRECRAWL] Requesting: ${url} (credits: ${safety.creditsUsedThisRun})`);

    const response = await fetch(FIRECRAWL_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['html'],
        onlyMainContent: false,
        waitFor: 2000, // Wait for dynamic content
      }),
    });

    if (!response.ok) {
      console.error(`[FIRECRAWL] Error for ${url}: HTTP ${response.status}`);
      safety.errors++;
      return null;
    }

    const data = await response.json();
    const rawHtml = data.data?.html || data.html || null;
    
    if (rawHtml) {
      // GOLDEN MASTERPLAN v4: Apply HTML sanitizer IMMEDIATELY
      const html = sanitizeReactHtml(rawHtml);
      console.log(`[FIRECRAWL] Success: ${url} (${html.length} bytes, sanitized)`);
      return html;
    } else {
      console.error(`[FIRECRAWL] No HTML returned for ${url}`);
    }
    
    return null;
  } catch (error) {
    console.error(`[FIRECRAWL] Fetch error for ${url}:`, error);
    safety.errors++;
    return null;
  }
}

// ===== GOLDEN MASTERPLAN v4: LINK SOURCE DETECTION =====
function detectLinkSource(url: string): string {
  if (url.includes('autotrack')) return 'autotrack';
  if (url.includes('autoscout24')) return 'autoscout24';
  if (url.includes('anwb.nl')) return 'anwb';
  if (url.includes('marktplaats')) return 'marktplaats';
  if (url.includes('autowereld')) return 'autowereld';
  if (url.includes('autoweek')) return 'autoweek';
  if (url.includes('viabovag')) return 'viabovag';
  
  // Known portals to exclude from dealersite
  const knownPortals = ['gaspedaal.nl', 'autotrack.nl', 'autoscout24.nl', 'autoscout24.be', 
                        'anwb.nl', 'marktplaats.nl', 'autowereld.nl', 'autoweek.nl', 'viabovag.nl'];
  const isKnownPortal = knownPortals.some(domain => url.includes(domain));
  
  if (!isKnownPortal && url.startsWith('http')) {
    return 'dealersite';
  }
  
  return 'other';
}

// ===== GASPEDAAL REDIRECT API PATTERNS =====
const GASPEDAAL_REDIRECT_PATTERNS = [
  // Pattern A: API redirect endpoints
  'https://www.gaspedaal.nl/api/redirect/{occasionId}?source={source}',
  'https://www.gaspedaal.nl/api/occasion/{occasionId}/redirect?type={source}',
  'https://api.gaspedaal.nl/redirect/vehicle/{occasionId}',
  // Pattern B: Click-through URLs
  'https://www.gaspedaal.nl/out/{occasionId}/{source}',
  'https://www.gaspedaal.nl/click/{occasionId}?source={source}',
  'https://www.gaspedaal.nl/goto/{occasionId}?source={source}',
  // Pattern C: Occasion page redirect
  'https://www.gaspedaal.nl/occasion/{occasionId}/redirect',
  'https://www.gaspedaal.nl/occasion/{occasionId}/out?source={source}',
];

// ===== GASPEDAAL REDIRECT RESOLVER (PRIORITY: DEALERSITE FIRST) =====
async function resolveGaspedaalRedirect(
  occasionId: string,
  sources: string[]
): Promise<Array<{ source: string; url: string; resolvedFrom: string }>> {
  const resolvedLinks: Array<{ source: string; url: string; resolvedFrom: string }> = [];
  const testedPatterns: Set<string> = new Set();
  
  // Priority order: dealersite first, then other portals
  const prioritizedSources = [
    ...sources.filter(s => s === 'dealersite'),
    ...sources.filter(s => s !== 'dealersite'),
  ];
  
  // Add default sources if not present
  const allSources = [...new Set([...prioritizedSources, 'dealersite', 'autotrack', 'autoscout24'])];
  
  console.log(`[REDIRECT] Resolving URLs for occasion ${occasionId}, sources: ${allSources.join(', ')}`);
  
  for (const source of allSources) {
    // Stop if we already have dealersite (priority #1)
    if (source !== 'dealersite' && resolvedLinks.some(l => l.source === 'dealersite')) {
      console.log(`[REDIRECT] Already have dealersite, skipping ${source}`);
      continue;
    }
    
    for (const pattern of GASPEDAAL_REDIRECT_PATTERNS) {
      const url = pattern
        .replace('{occasionId}', occasionId)
        .replace('{source}', source);
      
      // Skip if already tested
      if (testedPatterns.has(url)) continue;
      testedPatterns.add(url);
      
      try {
        const response = await fetch(url, {
          method: 'HEAD',
          redirect: 'manual',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
            'Referer': 'https://www.gaspedaal.nl/',
          },
        });
        
        // Check for redirect response (301, 302, 303, 307, 308)
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');
          if (location && !location.includes('gaspedaal.nl')) {
            const detectedSource = detectLinkSource(location);
            const finalSource = detectedSource !== 'other' ? detectedSource : source;
            
            // Avoid duplicates
            if (!resolvedLinks.some(l => l.url === location)) {
              console.log(`[REDIRECT] SUCCESS: ${pattern} -> ${location} (source: ${finalSource})`);
              resolvedLinks.push({
                source: finalSource,
                url: location,
                resolvedFrom: pattern,
              });
              
              // If we found dealersite, that's our priority - can continue but log it
              if (finalSource === 'dealersite') {
                console.log(`[REDIRECT] Found dealersite URL, continuing to find backup sources`);
              }
            }
          }
        }
        
        // Also try GET for JSON responses
        if (response.status === 200) {
          try {
            const getResponse = await fetch(url, {
              method: 'GET',
              redirect: 'manual',
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json,text/html',
                'Referer': 'https://www.gaspedaal.nl/',
              },
            });
            const text = await getResponse.text();
            
            // Check for JSON response with URL
            if (text.startsWith('{') || text.startsWith('[')) {
              try {
                const json = JSON.parse(text);
                const foundUrl = json.url || json.redirect || json.location || json.href;
                if (foundUrl && !foundUrl.includes('gaspedaal.nl')) {
                  const detectedSource = detectLinkSource(foundUrl);
                  const finalSource = detectedSource !== 'other' ? detectedSource : source;
                  
                  if (!resolvedLinks.some(l => l.url === foundUrl)) {
                    console.log(`[REDIRECT] JSON SUCCESS: ${pattern} -> ${foundUrl}`);
                    resolvedLinks.push({
                      source: finalSource,
                      url: foundUrl,
                      resolvedFrom: `${pattern} (JSON)`,
                    });
                  }
                }
              } catch {}
            }
          } catch {}
        }
      } catch (error) {
        // Silent fail - try next pattern
      }
      
      // Small delay to avoid rate limiting
      await delay(50);
    }
    
    // Break early if we have at least 2 sources including dealersite
    if (resolvedLinks.length >= 2 && resolvedLinks.some(l => l.source === 'dealersite')) {
      console.log(`[REDIRECT] Got dealersite + backup, stopping early`);
      break;
    }
  }
  
  console.log(`[REDIRECT] Resolved ${resolvedLinks.length} external URLs for occasion ${occasionId}`);
  return resolvedLinks;
}

// ===== SELECT BEST DETAIL URL (prioriteer dealersite) =====
function selectBestDetailUrl(
  gaspedaalUrl: string,
  outboundLinks: Array<{ source: string; url: string }>
): { url: string; source: string; score: number } {
  // Primary priority order: dealersite gets highest priority (most complete data)
  const priorityScores: Record<string, number> = {
    'dealersite': 100,
    'autotrack': 80,
    'autoscout24': 70,
    'marktplaats': 60,
    'anwb': 50,
    'autowereld': 40,
    'autoweek': 35,
    'viabovag': 30,
    'other': 10,
    'gaspedaal': 5,
  };
  
  let bestLink = { url: gaspedaalUrl, source: 'gaspedaal', score: 5 };
  
  for (const link of outboundLinks) {
    const score = priorityScores[link.source] || 10;
    if (score > bestLink.score && link.url) {
      bestLink = { url: link.url, source: link.source, score };
    }
  }
  
  return bestLink;
}

// ===== INDEX PAGE: Build URL =====
function buildIndexPageUrl(page: number, make?: string): string {
  const params = new URLSearchParams({
    sort: 'date_desc',
    min_year: MIN_YEAR.toString(),
    min_price: MIN_PRICE.toString(),
    page: page.toString(),
  });
  
  if (make) {
    params.set('merk', make.toLowerCase());
  }
  
  // Use /zoeken instead of /occasionzoeker - verified correct URL
  return `https://www.gaspedaal.nl/zoeken?${params.toString()}`;
}

// ===== GOLDEN MASTERPLAN v4: MULTI-PASS OUTBOUND EXTRACTION =====
function extractOutboundLinks(cardHtml: string): Array<{ source: string; url: string; foundAt: string }> {
  const outboundLinks: Array<{ source: string; url: string; foundAt: string }> = [];
  const seenUrls = new Set<string>();
  
  // PASS 1: Direct anchor tags in card HTML
  const linkPattern = /href="(https?:\/\/(?!www\.gaspedaal\.nl)[^"]+)"/gi;
  let linkMatch;
  while ((linkMatch = linkPattern.exec(cardHtml)) !== null) {
    const url = linkMatch[1];
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      const source = detectLinkSource(url);
      outboundLinks.push({ source, url, foundAt: 'anchor' });
    }
  }
  
  // PASS 2: data-* attributes with URLs
  const dataUrlPattern = /data-(?:url|href|link|redirect)="(https?:\/\/[^"]+)"/gi;
  while ((linkMatch = dataUrlPattern.exec(cardHtml)) !== null) {
    const url = linkMatch[1];
    if (!url.includes('gaspedaal.nl') && !seenUrls.has(url)) {
      seenUrls.add(url);
      const source = detectLinkSource(url);
      outboundLinks.push({ source, url, foundAt: 'data-attr' });
    }
  }
  
  // PASS 3: JSON embedded in card (onclick handlers, data attributes, etc)
  const jsonUrlPattern = /"(?:url|href|link|redirect)":\s*"(https?:\/\/[^"]+)"/gi;
  while ((linkMatch = jsonUrlPattern.exec(cardHtml)) !== null) {
    const url = linkMatch[1];
    if (!url.includes('gaspedaal.nl') && !seenUrls.has(url)) {
      seenUrls.add(url);
      const source = detectLinkSource(url);
      outboundLinks.push({ source, url, foundAt: 'json' });
    }
  }
  
  return outboundLinks;
}

// ===== GOLDEN MASTERPLAN v4: EXTRACT EXTERNAL LINKS FROM GASPEDAAL DETAIL PAGE =====
// This function extracts portal links (autotrack, autoscout, dealer sites) from Gaspedaal's occasion page
function extractExternalLinksFromGaspedaalDetail(html: string): Array<{ source: string; url: string; foundAt: string }> {
  const externalLinks: Array<{ source: string; url: string; foundAt: string }> = [];
  const seenUrls = new Set<string>();
  
  // Pattern 1: Direct anchor tags with external URLs
  const externalLinkPattern = /href="(https?:\/\/(?!www\.gaspedaal\.nl)[^"]+)"/gi;
  let match;
  while ((match = externalLinkPattern.exec(html)) !== null) {
    const url = match[1];
    // Filter for car portal domains only
    const isCarPortal = 
      url.includes('autotrack') ||
      url.includes('autoscout') ||
      url.includes('marktplaats') ||
      url.includes('anwb') ||
      url.includes('autowereld') ||
      url.includes('viabovag') ||
      url.includes('autoweek') ||
      url.includes('occasion') ||
      url.includes('auto') ||
      url.includes('dealer');
    
    if (isCarPortal && !seenUrls.has(url) && !url.includes('facebook') && !url.includes('twitter') && !url.includes('instagram')) {
      seenUrls.add(url);
      const source = detectLinkSource(url);
      externalLinks.push({ source, url, foundAt: 'gaspedaal_detail' });
    }
  }
  
  // Pattern 2: "Bekijk op" buttons/links text
  const bekijkOpPattern = /Bekijk\s+(?:op|bij|deze auto op)\s*:?\s*<[^>]*href="([^"]+)"/gi;
  while ((match = bekijkOpPattern.exec(html)) !== null) {
    const url = match[1];
    if (!url.includes('gaspedaal.nl') && !seenUrls.has(url)) {
      seenUrls.add(url);
      const source = detectLinkSource(url);
      externalLinks.push({ source, url, foundAt: 'bekijk_op_button' });
    }
  }
  
  // Pattern 3: data-url or data-href attributes
  const dataUrlPattern = /data-(?:url|href|redirect)="(https?:\/\/(?!www\.gaspedaal\.nl)[^"]+)"/gi;
  while ((match = dataUrlPattern.exec(html)) !== null) {
    const url = match[1];
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      const source = detectLinkSource(url);
      externalLinks.push({ source, url, foundAt: 'data_attr' });
    }
  }
  
  console.log(`[EXTERNAL] Found ${externalLinks.length} external portal links from Gaspedaal detail page`);
  return externalLinks;
}

function parseNextDataListings(html: string): any[] {
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!nextDataMatch) return [];
  
  try {
    const nextData = JSON.parse(nextDataMatch[1]);
    const props = nextData?.props?.pageProps;
    
    // Try different property names
    const listings = props?.listings || props?.results || props?.cars || props?.vehicles || [];
    
    if (listings.length > 0) {
      console.log(`[PARSE] Found ${listings.length} listings in __NEXT_DATA__`);
    }
    
    return listings;
  } catch (e) {
    console.log('[PARSE] Failed to parse __NEXT_DATA__');
    return [];
  }
}

// ===== INDEX PAGE: Parse listing cards =====
function parseIndexPageListings(html: string): IndexPageListing[] {
  const listings: IndexPageListing[] = [];
  
  // GOLDEN MASTERPLAN v4: Try __NEXT_DATA__ first for structured data
  const nextDataListings = parseNextDataListings(html);
  
  // NEW APPROACH: Find listing cards by the isOccTitle class (title element)
  const titlePattern = /<h2\s+class="isOccTitle[^"]*"[^>]*>([^<]+)<\/h2>/gi;
  const titleMatches: Array<{ title: string; index: number }> = [];
  let match;
  
  while ((match = titlePattern.exec(html)) !== null) {
    titleMatches.push({
      title: match[1].trim(),
      index: match.index,
    });
  }
  
  console.log(`[PARSE] Found ${titleMatches.length} listing titles (isOccTitle) on index page`);
  
  if (titleMatches.length === 0) {
    // Fallback: try to find titles in any h2 element
    const h2Pattern = /<h2[^>]*>([^<]{10,100})<\/h2>/gi;
    while ((match = h2Pattern.exec(html)) !== null) {
      const text = match[1].trim();
      if (text.length > 15 && !text.toLowerCase().includes('aanbod') && !text.toLowerCase().includes('zoeken')) {
        titleMatches.push({
          title: text,
          index: match.index,
        });
      }
    }
    console.log(`[PARSE] Fallback: found ${titleMatches.length} potential listing titles`);
  }
  
  // For each title found, extract the card data from surrounding HTML
  for (let i = 0; i < titleMatches.length; i++) {
    const { title, index } = titleMatches[i];
    
    // Get HTML window: from 1500 chars before title to next title (or 3000 chars)
    const start = Math.max(0, index - 1500);
    const nextIndex = titleMatches[i + 1]?.index ?? html.length;
    const end = Math.min(nextIndex, index + 3000);
    const cardHtml = html.substring(start, end);
    
    // Check if we have matching __NEXT_DATA__ for this listing
    const nextDataListing = nextDataListings.find(nd => 
      nd.title?.toLowerCase().includes(title.toLowerCase().substring(0, 20)) ||
      title.toLowerCase().includes(nd.title?.toLowerCase().substring(0, 20) || '')
    );
    
    const listing = extractListingFromCardHtml(cardHtml, title, i, nextDataListing);
    if (listing) {
      listings.push(listing);
    }
  }

  console.log(`[PARSE] Successfully parsed ${listings.length} listings from index page`);
  return listings;
}

// ===== INDEX PAGE: Extract listing from card HTML =====
function extractListingFromCardHtml(
  cardHtml: string, 
  title: string, 
  listingIndex: number,
  nextDataListing?: any
): IndexPageListing | null {
  try {
    // ===== GOLDEN MASTERPLAN v4: GASPEDAAL OCCASION ID EXTRACTION =====
    // Extract occasion ID from card HTML (id="oc129649001")
    let gaspedaalOccasionId: string | null = null;
    let gaspedaalDetailUrl: string | null = null;
    
    // Pattern 1: id="oc{ID}" on listing wrapper
    const occasionIdMatch = cardHtml.match(/id="oc(\d+)"/);
    if (occasionIdMatch) {
      gaspedaalOccasionId = occasionIdMatch[1];
      gaspedaalDetailUrl = `https://www.gaspedaal.nl/occasion/${gaspedaalOccasionId}`;
      console.log(`[PARSE] Extracted occasion ID: ${gaspedaalOccasionId} -> ${gaspedaalDetailUrl}`);
    } else {
      // Pattern 2: data-occasion-id or data-id
      const dataIdMatch = cardHtml.match(/data-(?:occasion-)?id="(\d{6,12})"/);
      if (dataIdMatch) {
        gaspedaalOccasionId = dataIdMatch[1];
        gaspedaalDetailUrl = `https://www.gaspedaal.nl/occasion/${gaspedaalOccasionId}`;
        console.log(`[PARSE] Extracted occasion ID from data-attr: ${gaspedaalOccasionId}`);
      }
    }
    
    // GOLDEN MASTERPLAN v4: Multi-pass outbound extraction
    const outboundLinks = extractOutboundLinks(cardHtml);
    const outboundSources = [...new Set(outboundLinks.map(l => l.source))];
    
    // Add sources from "Bekijk deze auto op:" text
    const bekijkMatch = cardHtml.match(/Bekijk deze auto op:\s*([^<]+)/i);
    if (bekijkMatch) {
      const sources = bekijkMatch[1].split(',').map(s => s.trim().toLowerCase());
      for (const source of sources) {
        const normalized = source.includes('dealersite') ? 'dealersite' :
                          source.includes('autotrack') ? 'autotrack' :
                          source.includes('autoscout24') ? 'autoscout24' :
                          source.includes('anwb') ? 'anwb' :
                          source.includes('marktplaats') ? 'marktplaats' :
                          source.length > 2 ? source : null;
        if (normalized && !outboundSources.includes(normalized)) {
          outboundSources.push(normalized);
        }
      }
    }
    
    // GOLDEN MASTERPLAN v4: Generate canonical URL 
    // Priority: Gaspedaal occasion URL > External URL > Hash fallback
    let canonicalUrl: string;
    if (gaspedaalDetailUrl) {
      // PRIMARY: Use Gaspedaal's own occasion page as canonical
      canonicalUrl = gaspedaalDetailUrl;
    } else if (outboundLinks.length > 0) {
      // SECONDARY: Use best external URL as canonical
      const bestLink = selectBestDetailUrl('', outboundLinks);
      canonicalUrl = canonicalizeExternalUrl(bestLink.url);
    } else {
      // FALLBACK: hash-based identifier (stabiel)
      const simpleHash = title.split('').reduce((acc, char) => {
        return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
      }, 0).toString(16).replace('-', '');
      canonicalUrl = `gaspedaal://listing/${Math.abs(parseInt(simpleHash, 16)).toString(16).substring(0, 16)}`;
    }
    
    // Extract price
    let rawPrice: string | null = null;
    const pricePatterns = [
      /data-testid="price"[^>]*>([^<]+)</i,
      /class="[^"]*price[^"]*"[^>]*>([^<]+)</i,
      /€\s*([\d.,]+)/,
    ];
    for (const pattern of pricePatterns) {
      const match = cardHtml.match(pattern);
      if (match && match[1]) {
        rawPrice = match[1].replace(/[^\d]/g, '');
        if (rawPrice && parseInt(rawPrice, 10) > 0) break;
      }
    }
    
    // Extract year
    let rawYear: string | null = null;
    const yearPatterns = [
      />(\d{4})<\/span>/,
      /Bouwjaar[^<]*?(\d{4})/i,
      /(\d{4})\s*<\/span>/,
    ];
    for (const pattern of yearPatterns) {
      const match = cardHtml.match(pattern);
      if (match && match[1]) {
        const year = parseInt(match[1], 10);
        if (year >= 1990 && year <= 2030) {
          rawYear = match[1];
          break;
        }
      }
    }
    
    // GOLDEN MASTERPLAN v4: Fixed mileage patterns (na HTML sanitizing)
    let rawMileage: string | null = null;
    const mileagePatterns = [
      />(\d{1,3}(?:\d{3})*)\s*km/i,           // >130000 km (na sanitizing)
      />(\d{1,3}[.,]\d{3})\s*km/i,            // >130.000 km
      /(\d{1,3}(?:[.,]?\d{3})*)\s*km/i,       // Fallback
    ];
    for (const pattern of mileagePatterns) {
      const match = cardHtml.match(pattern);
      if (match && match[1]) {
        rawMileage = match[1].replace(/[.,]/g, '');
        if (parseInt(rawMileage, 10) > 100) break; // Valid mileage
      }
    }
    
    // Extract fuel type
    let fuelType: string | null = null;
    const fuelPatterns = [
      />(\s*Benzine\s*)</i,
      />(\s*Diesel\s*)</i,
      />(\s*Elektrisch\s*)</i,
      />(\s*Hybride\s*)</i,
      />(\s*Plug-in\s*)</i,
      /(benzine|diesel|elektrisch|hybride|plug-in|lpg|cng)/i,
    ];
    for (const pattern of fuelPatterns) {
      const match = cardHtml.match(pattern);
      if (match && match[1]) {
        fuelType = normalizeFuelType(match[1].trim());
        break;
      }
    }
    
    // GOLDEN MASTERPLAN v4: Fixed power patterns (na HTML sanitizing)
    let powerPk: number | null = null;
    const powerPatterns = [
      />(\d+)\s*kW/i,                          // >71 kW
      />(\d+)\s*pk/i,                          // >96 pk
      /(\d+)\s*(?:kW|pk)/i,                    // Fallback
    ];
    for (const pattern of powerPatterns) {
      const match = cardHtml.match(pattern);
      if (match && match[1]) {
        const value = parseInt(match[1], 10);
        if (pattern.source.toLowerCase().includes('kw')) {
          powerPk = Math.round(value * 1.36); // Convert kW to pk
        } else {
          powerPk = value;
        }
        break;
      }
    }
    
    // Extract transmission
    let transmission: string | null = null;
    const transPatterns = [
      />(Handgeschakeld)</i,
      />(Automaat)</i,
      />(CVT)</i,
      />(DSG)</i,
      /(automaat|handgeschakeld|manueel|cvt|dsg)/i,
    ];
    for (const pattern of transPatterns) {
      const match = cardHtml.match(pattern);
      if (match && match[1]) {
        transmission = normalizeTransmission(match[1].trim());
        break;
      }
    }
    
    // Extract body type
    let bodyType: string | null = null;
    const bodyPatterns = [
      />(Hatchback)</i,
      />(Sedan)</i,
      />(SUV)</i,
      />(Stationwagon)</i,
      />(Stationwagen)</i,
      />(MPV)</i,
      />(Cabrio)</i,
      />(Coupé)</i,
      />(Coup[eé])</i,
      /(hatchback|sedan|suv|stationwagon|stationwagen|mpv|cabrio|coup[eé]|terreinwagen)/i,
    ];
    for (const pattern of bodyPatterns) {
      const match = cardHtml.match(pattern);
      if (match && match[1]) {
        bodyType = normalizeBodyType(match[1].trim());
        break;
      }
    }
    
    // Extract color
    let color: string | null = null;
    const colorPatterns = [
      />(Zwart)</i,
      />(Wit)</i,
      />(Grijs)</i,
      />(Zilver)</i,
      />(Blauw)</i,
      />(Rood)</i,
      />(Groen)</i,
      /(zwart|wit|grijs|zilver|blauw|rood|groen|geel|oranje|bruin|beige|paars)/i,
    ];
    for (const pattern of colorPatterns) {
      const match = cardHtml.match(pattern);
      if (match && match[1]) {
        color = match[1].toLowerCase().trim();
        break;
      }
    }
    
    // Extract doors
    let doors: number | null = null;
    const doorsMatch = cardHtml.match(/>(\d)\s*-?deurs/i) || cardHtml.match(/(\d)\s*-?\s*deurs/i);
    if (doorsMatch) {
      doors = parseInt(doorsMatch[1], 10);
    }
    
    // Extract dealer info
    let dealerName: string | null = null;
    let dealerCity: string | null = null;
    
    const dealerPatterns = [
      /class="[^"]*text-pumpkin[^"]*"[^>]*>([^<]+)</i,
      /class="[^"]*dealer[^"]*"[^>]*>([^<]+)</i,
    ];
    for (const pattern of dealerPatterns) {
      const match = cardHtml.match(pattern);
      if (match && match[1] && match[1].trim().length > 2) {
        dealerName = match[1].trim();
        break;
      }
    }
    
    // City pattern: City (Province)
    const cityMatch = cardHtml.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s*\(([A-Z]{2})\)/);
    if (cityMatch) {
      dealerCity = cityMatch[1].trim();
    }
    
    // GOLDEN MASTERPLAN v4: Extract thumbnail image URL
    let imageUrlThumbnail: string | null = null;
    const imgPatterns = [
      /<img[^>]*src="(https:\/\/cdn\.gaspedaal\.nl\/[^"]+)"/i,
      /<img[^>]*data-src="(https:\/\/cdn\.gaspedaal\.nl\/[^"]+)"/i,
      /background-image:\s*url\(['"]?(https:\/\/cdn\.gaspedaal\.nl\/[^'"]+)/i,
      /<img[^>]*src="(https:\/\/[^"]*(?:jpg|jpeg|png|webp)[^"]*)"/i,
    ];
    for (const pattern of imgPatterns) {
      const match = cardHtml.match(pattern);
      if (match) {
        imageUrlThumbnail = match[1];
        break;
      }
    }
    
    // Create the listing object
    const listing: IndexPageListing = {
      url: canonicalUrl,
      title,
      price: safeParsePrice(rawPrice),
      year: safeParseYear(rawYear),
      mileage: safeParseMileage(rawMileage),
      fuelType,
      transmission,
      bodyType,
      color,
      doors,
      dealerName,
      dealerCity,
      outboundSources,
      outboundLinks,
      powerPk,
      imageUrlThumbnail,
      gaspedaalOccasionId,
      gaspedaalDetailUrl,
      rawPrice,
      rawYear,
      rawMileage,
    };
    
    // Log parsed data for debugging
    console.log(`[PARSE] Listing ${listingIndex}: ${title.substring(0, 40)}... | €${listing.price} | ${listing.year} | ${listing.mileage}km | ${listing.fuelType} | ${powerPk}pk | OccID: ${gaspedaalOccasionId} | Dealer: ${dealerName} | Links: ${outboundLinks.length}`);
    
    return listing;
  } catch (error) {
    console.error(`[PARSE] Error extracting listing: ${error}`);
    return null;
  }
}

// ===== DETAIL PAGE: Extract additional data (VOLLEDIG) =====
function extractDetailPageData(html: string): DetailPageData {
  console.log(`[DETAIL] Extracting data from detail page (${html.length} bytes)`);
  
  // Extract license plate (Dutch format)
  let licensePlate: string | null = null;
  const licensePlatePatterns = [
    /kenteken[^<]*?<[^>]*>([A-Z0-9]{1,3}[-\s]?[A-Z0-9]{2,3}[-\s]?[A-Z0-9]{1,2})</i,
    /([A-Z]{2}[-\s]?\d{3}[-\s]?[A-Z]{1})/,
    /([A-Z]{1}[-\s]?\d{3}[-\s]?[A-Z]{2})/,
    /(\d{1,3}[-\s]?[A-Z]{2,3}[-\s]?[A-Z0-9]{1,2})/,
  ];
  for (const pattern of licensePlatePatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      licensePlate = match[1].replace(/\s/g, '-').toUpperCase();
      break;
    }
  }
  console.log(`[DETAIL] License plate: ${licensePlate ? 'FOUND' : 'NOT FOUND'}`);

  // Extract dealer page URL
  let dealerPageUrl: string | null = null;
  const dealerLinkMatch = html.match(/href="(\/dealer\/[^"]+)"/i) ||
                          html.match(/href="(https:\/\/www\.gaspedaal\.nl\/dealer\/[^"]+)"/i);
  if (dealerLinkMatch) {
    dealerPageUrl = dealerLinkMatch[1].startsWith('/') 
      ? `https://www.gaspedaal.nl${dealerLinkMatch[1]}`
      : dealerLinkMatch[1];
  }

  // ===== OPTIONS: VOLLEDIG OPSLAAN - GEEN AFKAPPEN =====
  let optionsRawText: string | null = null;
  let optionsRawList: string[] = [];
  let optionsRawHtml: string | null = null;
  
  const optionsSectionPatterns = [
    /uitrusting[^<]*?<[^>]*>([\s\S]*?)<\/(?:div|section|ul)>/i,
    /opties[^<]*?<[^>]*>([\s\S]*?)<\/(?:div|section|ul)>/i,
    /class="[^"]*options[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section)>/i,
    /class="[^"]*equipment[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section)>/i,
  ];
  
  for (const pattern of optionsSectionPatterns) {
    const match = html.match(pattern);
    if (match && match[1] && match[1].length > 20) {
      optionsRawHtml = match[1];
      optionsRawText = match[1]
        .replace(/<[^>]+>/g, '\n')
        .replace(/\s+/g, ' ')
        .trim();
      
      const listItems = match[1].match(/<li[^>]*>([^<]+)<\/li>/gi);
      if (listItems) {
        optionsRawList = listItems.map(item => 
          item.replace(/<[^>]+>/g, '').trim()
        ).filter(item => item.length > 0);
      } else {
        optionsRawList = optionsRawText
          .split(/[,\n•·▪►]/)
          .map(s => s.trim())
          .filter(s => s.length > 1);
      }
      
      break;
    }
  }
  console.log(`[DETAIL] Options: ${optionsRawList.length} items found`);

  // ===== DESCRIPTION: VOLLEDIG OPSLAAN =====
  let descriptionRaw: string | null = null;
  const descPatterns = [
    /class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section)>/i,
    /class="[^"]*advertentietekst[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section)>/i,
    /omschrijving[^<]*?<[^>]*>([\s\S]*?)<\/(?:div|section)>/i,
  ];
  
  for (const pattern of descPatterns) {
    const match = html.match(pattern);
    if (match && match[1] && match[1].length > 50) {
      descriptionRaw = match[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      break;
    }
  }
  console.log(`[DETAIL] Description: ${descriptionRaw ? descriptionRaw.length + ' chars' : 'NOT FOUND'}`);

  // ===== SPECS TABLE =====
  const specsTableRaw: Record<string, string> = {};
  
  const tableRowPattern = /<tr[^>]*>[\s\S]*?<t[hd][^>]*>([^<]+)<\/t[hd]>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<\/tr>/gi;
  let tableMatch;
  while ((tableMatch = tableRowPattern.exec(html)) !== null) {
    const key = tableMatch[1].trim();
    const value = tableMatch[2].trim();
    if (key && value && key.length < 50 && value.length < 200) {
      specsTableRaw[key] = value;
    }
  }
  
  const dlPattern = /<dt[^>]*>([^<]+)<\/dt>[\s\S]*?<dd[^>]*>([^<]+)<\/dd>/gi;
  while ((tableMatch = dlPattern.exec(html)) !== null) {
    const key = tableMatch[1].trim();
    const value = tableMatch[2].trim();
    if (key && value && key.length < 50 && value.length < 200) {
      specsTableRaw[key] = value;
    }
  }
  
  console.log(`[DETAIL] Specs table: ${Object.keys(specsTableRaw).length} key/value pairs`);

  // ===== ENGINE/EV SPECS =====
  let engineCc: number | null = null;
  let batteryCapacityKwh: number | null = null;
  let electricRangeKm: number | null = null;
  let drivetrain: string | null = null;
  let vin: string | null = null;
  
  // Engine CC
  const ccPatterns = [
    /(\d{3,4})\s*cc/i,
    /(\d[.,]\d)\s*(?:liter|l)/i,
    /cilinderinhoud[^<]*?(\d{3,4})/i,
  ];
  for (const pattern of ccPatterns) {
    const match = html.match(pattern);
    if (match) {
      let value = match[1];
      if (value.includes('.') || value.includes(',')) {
        value = String(Math.round(parseFloat(value.replace(',', '.')) * 1000));
      }
      engineCc = parseInt(value, 10);
      if (!isNaN(engineCc)) break;
    }
  }
  
  // Battery capacity
  const kwhPatterns = [
    /(\d+(?:[.,]\d+)?)\s*kwh/i,
    /accucapaciteit[^<]*?(\d+(?:[.,]\d+)?)/i,
    /batterij[^<]*?(\d+(?:[.,]\d+)?)\s*kwh/i,
  ];
  for (const pattern of kwhPatterns) {
    const match = html.match(pattern);
    if (match) {
      batteryCapacityKwh = parseFloat(match[1].replace(',', '.'));
      break;
    }
  }
  
  // Electric range
  const rangePatterns = [
    /actieradius[^<]*?(\d+)\s*km/i,
    /bereik[^<]*?(\d+)\s*km/i,
    /range[^<]*?(\d+)\s*km/i,
    /wltp[^<]*?(\d+)\s*km/i,
  ];
  for (const pattern of rangePatterns) {
    const match = html.match(pattern);
    if (match) {
      electricRangeKm = parseInt(match[1], 10);
      break;
    }
  }
  
  // Drivetrain
  const drivePatterns = [
    /(voorwielaandrijving|achterwielaandrijving|vierwielaandrijving|4wd|awd|fwd|rwd|4x4)/i,
    /aandrijving[^<]*?(voor|achter|vier|4x4)/i,
  ];
  for (const pattern of drivePatterns) {
    const match = html.match(pattern);
    if (match) {
      const raw = match[1].toLowerCase();
      if (raw.includes('voor') || raw === 'fwd') drivetrain = 'FWD';
      else if (raw.includes('achter') || raw === 'rwd') drivetrain = 'RWD';
      else if (raw.includes('vier') || raw === 'awd' || raw === '4wd' || raw === '4x4') drivetrain = 'AWD';
      break;
    }
  }
  
  // VIN
  const vinPattern = /(?:vin|chassisnummer)[^<]*?([A-HJ-NPR-Z0-9]{17})/i;
  const vinMatch = html.match(vinPattern);
  if (vinMatch) {
    vin = vinMatch[1].toUpperCase();
  }
  
  console.log(`[DETAIL] Engine: ${engineCc}cc, Battery: ${batteryCapacityKwh}kWh, Range: ${electricRangeKm}km, Drive: ${drivetrain}`);

  // ===== IMAGES =====
  let imageUrlMain: string | null = null;
  let imageCount = 0;
  
  const mainImagePatterns = [
    /class="[^"]*(?:main|primary|hero)[^"]*"[^>]*src="([^"]+)"/i,
    /<img[^>]*class="[^"]*(?:gallery|slider)[^"]*"[^>]*src="([^"]+)"/i,
    /og:image[^>]*content="([^"]+)"/i,
  ];
  for (const pattern of mainImagePatterns) {
    const match = html.match(pattern);
    if (match && match[1] && !match[1].includes('placeholder')) {
      imageUrlMain = match[1];
      break;
    }
  }
  
  const allImages = html.match(/src="[^"]*(?:jpg|jpeg|png|webp)[^"]*"/gi);
  if (allImages) {
    imageCount = allImages.length;
  }
  
  console.log(`[DETAIL] Images: main=${imageUrlMain ? 'FOUND' : 'NOT FOUND'}, count=${imageCount}`);

  return {
    licensePlate,
    dealerPageUrl,
    optionsRawText,
    optionsRawList,
    optionsRawHtml,
    descriptionRaw,
    specsTableRaw,
    engineCc,
    batteryCapacityKwh,
    electricRangeKm,
    drivetrain,
    vin,
    imageUrlMain,
    imageCount,
  };
}

// ===== NORMALIZATION FUNCTIONS =====
function normalizeFuelType(raw: string): string {
  const lower = raw.toLowerCase().trim();
  const mapping: Record<string, string> = {
    'benzine': 'benzine',
    'diesel': 'diesel',
    'elektrisch': 'elektrisch',
    'electric': 'elektrisch',
    'hybride': 'hybride',
    'hybrid': 'hybride',
    'plug-in hybride': 'plug-in hybride',
    'plug-in': 'plug-in hybride',
    'lpg': 'lpg',
    'cng': 'cng',
    'waterstof': 'waterstof',
  };
  return mapping[lower] || lower;
}

function normalizeTransmission(raw: string): string {
  const lower = raw.toLowerCase().trim();
  const mapping: Record<string, string> = {
    'automaat': 'automaat',
    'automatic': 'automaat',
    'handgeschakeld': 'handgeschakeld',
    'manueel': 'handgeschakeld',
    'manual': 'handgeschakeld',
    'cvt': 'automaat',
    'dsg': 'automaat',
  };
  return mapping[lower] || lower;
}

function normalizeBodyType(raw: string): string {
  const lower = raw.toLowerCase().trim();
  const mapping: Record<string, string> = {
    'hatchback': 'hatchback',
    'sedan': 'sedan',
    'suv': 'suv',
    'stationwagon': 'stationwagon',
    'stationwagen': 'stationwagon',
    'mpv': 'mpv',
    'cabrio': 'cabrio',
    'coupé': 'coupe',
    'coupe': 'coupe',
    'terreinwagen': 'suv',
  };
  return mapping[lower] || lower;
}

// ===== MAKE/MODEL EXTRACTION =====
function extractMakeModel(title: string): { make: string | null; model: string | null } {
  const makes = [
    'Audi', 'BMW', 'Mercedes-Benz', 'Mercedes', 'Volkswagen', 'VW', 'Opel', 'Ford',
    'Peugeot', 'Renault', 'Citroën', 'Citroen', 'Fiat', 'Toyota', 'Honda', 'Mazda',
    'Nissan', 'Hyundai', 'Kia', 'Volvo', 'Skoda', 'Škoda', 'Seat', 'SEAT', 'MINI', 
    'Porsche', 'Land Rover', 'Jaguar', 'Tesla', 'Lexus', 'Alfa Romeo', 'Jeep', 
    'Suzuki', 'Mitsubishi', 'Dacia', 'Smart', 'Chevrolet', 'DS', 'Cupra', 
    'Polestar', 'Genesis', 'MG', 'BYD', 'Lynk & Co', 'Lynk&Co', 'NIO', 'XPeng'
  ];

  const titleLower = title.toLowerCase();
  
  for (const make of makes) {
    if (titleLower.includes(make.toLowerCase())) {
      const regex = new RegExp(`${make}\\s+([\\w-]+)`, 'i');
      const match = title.match(regex);
      const model = match ? match[1] : null;
      
      // Normalize make names
      let normalizedMake = make;
      if (make === 'VW') normalizedMake = 'Volkswagen';
      if (make === 'Mercedes') normalizedMake = 'Mercedes-Benz';
      if (make === 'Škoda') normalizedMake = 'Skoda';
      if (make === 'SEAT') normalizedMake = 'Seat';
      if (make === 'Citroen') normalizedMake = 'Citroën';
      if (make === 'Lynk&Co') normalizedMake = 'Lynk & Co';
      
      return { make: normalizedMake, model };
    }
  }

  return { make: null, model: null };
}

// ===== VEHICLE EVENT LOGGING =====
async function logVehicleEvent(
  supabase: any,
  listingId: string,
  eventType: string,
  data: {
    price?: number | null;
    daysOnMarket?: number | null;
    isRealSale?: boolean;
    reason?: Record<string, any>;
    listing?: any;
  }
): Promise<void> {
  try {
    await supabase.from('vehicle_events').insert({
      listing_id: listingId,
      event_type: eventType,
      event_at: new Date().toISOString(),
      price_at_event: data.price,
      days_on_market: data.daysOnMarket,
      is_real_sale: data.isRealSale,
      vehicle_fingerprint: data.listing?.vehicle_fingerprint,
      license_plate_hash: data.listing?.license_plate_hash,
      make: data.listing?.make,
      model: data.listing?.model,
      year: data.listing?.year,
      mileage: data.listing?.mileage,
      fuel_type: data.listing?.fuel_type,
      reason: data.reason || {},
    });
  } catch (error) {
    console.error('Error logging vehicle event:', error);
  }
}

// ===== GOLDEN MASTERPLAN v4: LOOKUP EXISTING LISTING (DEALER-SCOPED) =====
async function lookupExistingListing(
  supabase: any,
  listing: IndexPageListing,
  detailData: DetailPageData | null,
  dealerKey: string,
  dealerKeyConfidence: DealerKeyConfidence
): Promise<{ existingListing: any | null; matchType: string | null }> {
  
  // 1. HARD MATCH: license_plate_hash (als detail data beschikbaar)
  if (detailData?.licensePlate) {
    const plateHash = await hashLicensePlate(detailData.licensePlate);
    if (plateHash) {
      const { data: byPlate } = await supabase
        .from('listings')
        .select('*')
        .eq('license_plate_hash', plateHash)
        .maybeSingle();
      if (byPlate) {
        console.log(`[DEDUP] HARD MATCH: license_plate_hash -> ${byPlate.id}`);
        return { existingListing: byPlate, matchType: 'license_plate_hash' };
      }
    }
  }
  
  // 2. HARD MATCH: vin_hash
  if (detailData?.vin) {
    const vinHash = await hashVin(detailData.vin);
    if (vinHash) {
      const { data: byVin } = await supabase
        .from('listings')
        .select('*')
        .eq('vin_hash', vinHash)
        .maybeSingle();
      if (byVin) {
        console.log(`[DEDUP] HARD MATCH: vin_hash -> ${byVin.id}`);
        return { existingListing: byVin, matchType: 'vin_hash' };
      }
    }
  }
  
  // 3. HARD MATCH: external_canonical_url_hash
  if (listing.outboundLinks.length > 0) {
    const bestLink = selectBestDetailUrl('', listing.outboundLinks);
    const extUrlHash = await hashExternalUrl(bestLink.url);
    if (extUrlHash) {
      const { data: byExtUrl } = await supabase
        .from('listings')
        .select('*')
        .eq('external_canonical_url_hash', extUrlHash)
        .maybeSingle();
      if (byExtUrl) {
        console.log(`[DEDUP] HARD MATCH: external_canonical_url_hash -> ${byExtUrl.id}`);
        return { existingListing: byExtUrl, matchType: 'external_url_hash' };
      }
    }
  }
  
  // 4. HARD MATCH: canonical_url (backwards compatibility)
  if (!listing.url.startsWith('gaspedaal://')) {
    const { data: byCanonical } = await supabase
      .from('listings')
      .select('*')
      .eq('canonical_url', listing.url)
      .maybeSingle();
    if (byCanonical) {
      console.log(`[DEDUP] HARD MATCH: canonical_url -> ${byCanonical.id}`);
      return { existingListing: byCanonical, matchType: 'canonical_url' };
    }
  }
  
  // 5. SOFT MATCH: fingerprint_hash_v2 (ALLEEN als dealer_key_confidence != LOW)
  if (dealerKeyConfidence !== 'LOW') {
    const { make, model } = extractMakeModel(listing.title);
    const fingerprintV2 = await generateVehicleFingerprintV2(dealerKey, {
      make,
      model,
      year: listing.year,
      fuelType: listing.fuelType,
      transmission: listing.transmission,
      bodyType: listing.bodyType,
      mileage: listing.mileage,
      powerPk: listing.powerPk,
      imageUrl: listing.imageUrlThumbnail,
    });
    
    // DEALER-SCOPED query - alleen binnen dezelfde dealer
    const { data: byFingerprint } = await supabase
      .from('listings')
      .select('*')
      .eq('fingerprint_hash_v2', fingerprintV2)
      .eq('dealer_key', dealerKey)
      .maybeSingle();
    
    if (byFingerprint) {
      console.log(`[DEDUP] SOFT MATCH: fingerprint_v2 (dealer: ${dealerKey}) -> ${byFingerprint.id}`);
      return { existingListing: byFingerprint, matchType: 'fingerprint_v2' };
    }
  } else {
    console.log(`[DEDUP] Soft matching DISABLED: dealer_key_confidence = LOW`);
  }
  
  // 6. NO MATCH - nieuwe listing
  return { existingListing: null, matchType: null };
}

// ===== HEALING QUEUE: Process incomplete listings =====
async function processHealingQueue(
  supabase: any,
  firecrawlKey: string,
  safety: SafetyState,
  safetyConfig: SafetyConfig,
  stats: JobStats,
  dryRun: boolean
): Promise<void> {
  console.log('[HEALING] Starting healing queue processing...');
  
  const now = new Date();
  const minTimeSinceLastAttempt = new Date(now.getTime() - HEALING_MIN_HOURS_BETWEEN_ATTEMPTS * 60 * 60 * 1000).toISOString();
  
  // Find incomplete listings that need re-scraping
  const { data: healingCandidates, error } = await supabase
    .from('listings')
    .select('id, url, canonical_url, outbound_links, detail_attempts, detail_scraped_at, detail_status, chosen_detail_source, detail_sources_tried, detail_best_score')
    .eq('needs_detail_rescrape', true)
    .lt('detail_attempts', HEALING_MAX_RETRIES)
    .or(`detail_scraped_at.is.null,detail_scraped_at.lt.${minTimeSinceLastAttempt}`)
    .limit(HEALING_DAILY_CAP);
  
  if (error) {
    console.error('[HEALING] Error fetching candidates:', error);
    return;
  }
  
  console.log(`[HEALING] Found ${healingCandidates?.length || 0} candidates for healing`);
  
  for (const candidate of (healingCandidates || [])) {
    const safetyCheck = checkSafetyLimits(safety, safetyConfig);
    if (safetyCheck.shouldStop) {
      console.log(`[HEALING] Stopping: ${safetyCheck.reason}`);
      break;
    }
    
    console.log(`[HEALING] Processing listing ${candidate.id} (attempt ${candidate.detail_attempts + 1}/${HEALING_MAX_RETRIES})`);
    
    const outboundLinks = candidate.outbound_links || [];
    
    // GOLDEN MASTERPLAN v4: Check for untried better sources
    const triedSources = (candidate.detail_sources_tried || []).map((s: any) => s.source);
    const availableSources = outboundLinks.map((l: any) => l.source);
    
    // Find best untried source
    const priorityOrder = ['dealersite', 'autotrack', 'autoscout24', 'marktplaats', 'anwb'];
    let bestUntried = outboundLinks.find((l: any) => 
      !triedSources.includes(l.source) && priorityOrder.includes(l.source)
    );
    
    if (!bestUntried && outboundLinks.length > 0) {
      bestUntried = outboundLinks[0];
    }
    
    if (!bestUntried) {
      console.log(`[HEALING] No untried sources for ${candidate.id}, marking as no_links`);
      await supabase
        .from('listings')
        .update({
          detail_status: 'no_links',
          needs_detail_rescrape: false,
        })
        .eq('id', candidate.id);
      stats.detailNoLinks++;
      continue;
    }
    
    // Scrape detail page
    const detailHtml = await scrapeWithFirecrawl(bestUntried.url, firecrawlKey, safety, false, dryRun);
    stats.detailAttempted++;
    
    if (!detailHtml) {
      // Track failed attempt
      const newSourcesTried = [...(candidate.detail_sources_tried || []), {
        source: bestUntried.source,
        url: bestUntried.url,
        attemptedAt: new Date().toISOString(),
        score: 0,
        success: false,
      }];
      
      await supabase
        .from('listings')
        .update({
          detail_attempts: candidate.detail_attempts + 1,
          last_detail_error: `Failed to scrape ${bestUntried.source}: No HTML returned`,
          detail_scraped_at: new Date().toISOString(),
          detail_sources_tried: newSourcesTried,
        })
        .eq('id', candidate.id);
      stats.detailFailed++;
      await delay(DELAY_BETWEEN_REQUESTS_MS);
      continue;
    }
    
    // Extract detail data
    const detailData = extractDetailPageData(detailHtml);
    const completeness = calculateCompletenessScore(detailData, {} as IndexPageListing);
    
    // Track source attempt
    const newSourcesTried = [...(candidate.detail_sources_tried || []), {
      source: bestUntried.source,
      url: bestUntried.url,
      attemptedAt: new Date().toISOString(),
      score: completeness.score,
      success: completeness.status === 'ok' || completeness.status === 'partial',
    }];
    
    const newBestScore = Math.max(candidate.detail_best_score || 0, completeness.score);
    
    // Update listing
    const updateData: Record<string, any> = {
      detail_attempts: candidate.detail_attempts + 1,
      detail_scraped_at: new Date().toISOString(),
      detail_status: completeness.status,
      detail_completeness_score: completeness.score,
      chosen_detail_source: bestUntried.source,
      chosen_detail_url: bestUntried.url,
      needs_detail_rescrape: completeness.status !== 'ok',
      last_detail_error: completeness.status !== 'ok' 
        ? `Missing fields: ${completeness.missingFields.join(', ')}` 
        : null,
      detail_sources_tried: newSourcesTried,
      detail_best_score: newBestScore,
    };
    
    // Add extracted data
    if (detailData) {
      updateData.options_raw = detailData.optionsRawText;
      updateData.description_raw = detailData.descriptionRaw;
      updateData.engine_cc = detailData.engineCc;
      updateData.battery_capacity_kwh = detailData.batteryCapacityKwh;
      updateData.electric_range_km = detailData.electricRangeKm;
      updateData.drivetrain = detailData.drivetrain;
      updateData.vin = detailData.vin;
      updateData.image_url_main = detailData.imageUrlMain;
      updateData.image_count = detailData.imageCount;
      
      if (detailData.licensePlate) {
        updateData.license_plate_hash = await hashLicensePlate(detailData.licensePlate);
      }
      if (detailData.vin) {
        updateData.vin_hash = await hashVin(detailData.vin);
      }
    }
    
    await supabase
      .from('listings')
      .update(updateData)
      .eq('id', candidate.id);
    
    // Update stats
    stats.detailHealed++;
    stats.completenessScores.push(completeness.score);
    if (completeness.status === 'ok') stats.detailOk++;
    else if (completeness.status === 'partial') stats.detailPartial++;
    else stats.detailFailed++;
    
    for (const field of completeness.missingFields) {
      stats.missingFieldsCounts[field] = (stats.missingFieldsCounts[field] || 0) + 1;
    }
    
    console.log(`[HEALING] Listing ${candidate.id}: ${completeness.status} (score: ${completeness.score})`);
    
    await delay(DELAY_BETWEEN_REQUESTS_MS);
  }
  
  console.log(`[HEALING] Completed. Healed: ${stats.detailHealed}, OK: ${stats.detailOk}, Partial: ${stats.detailPartial}, Failed: ${stats.detailFailed}`);
}

// ===== DISCOVERY MODE: Main logic =====
async function runDiscoveryMode(
  supabase: any,
  firecrawlKey: string,
  safety: SafetyState,
  safetyConfig: SafetyConfig,
  stats: JobStats,
  errorLog: any[],
  maxPages: number,
  dryRun: boolean = false,
  indexOnly: boolean = false
): Promise<void> {
  console.log(`[DISCOVERY] Starting discovery mode (maxPages=${maxPages}, dryRun=${dryRun}, indexOnly=${indexOnly})`);
  
  for (let page = 1; page <= maxPages; page++) {
    const safetyCheck = checkSafetyLimits(safety, safetyConfig);
    if (safetyCheck.shouldStop) {
      console.log(`[SAFETY] Stop: ${safetyCheck.reason}`);
      safety.stopReason = safetyCheck.reason;
      break;
    }

    const indexUrl = buildIndexPageUrl(page);
    console.log(`[PAGE ${page}/${maxPages}] Fetching: ${indexUrl}`);
    
    const html = await scrapeWithFirecrawl(indexUrl, firecrawlKey, safety, true, dryRun);
    
    if (!html) {
      errorLog.push({
        timestamp: new Date().toISOString(),
        message: `Failed to fetch index page ${page}`,
        url: indexUrl,
      });
      stats.errorsCount++;
      await delay(DELAY_BETWEEN_REQUESTS_MS);
      continue;
    }

    stats.pagesProcessed++;
    
    if (dryRun) {
      console.log(`[DRY RUN] Page ${page}: Would parse listings from ${indexUrl}`);
      stats.listingsFound += 20;
      continue;
    }
    
    // Parse listings from index page
    const listings = parseIndexPageListings(html);
    stats.listingsFound += listings.length;
    
    if (listings.length === 0) {
      console.log(`[PAGE ${page}] No listings found, stopping`);
      break;
    }

    // Process each listing
    for (const listing of listings) {
      safety.totalProcessed++;
      
      // Check unknown year/price budget
      if (listing.year === null || listing.price === null) {
        safety.unknownYearPriceCount++;
        const unknownPercent = safety.unknownYearPriceCount / safety.totalProcessed;
        
        if (unknownPercent > MAX_UNKNOWN_YEAR_PRICE_PERCENT && safety.totalProcessed > 20) {
          console.log(`[SKIP] Unknown year/price budget exceeded (${(unknownPercent * 100).toFixed(1)}%)`);
          continue;
        }
      }

      // Pre-filter
      if (listing.year !== null && listing.year < MIN_YEAR) continue;
      if (listing.price !== null && listing.price < MIN_PRICE) continue;

      // Generate content hash
      const contentHash = await createContentHash(listing);
      
      // GOLDEN MASTERPLAN v4: Extract dealer key
      const { dealerKey, confidence: dealerKeyConfidence } = extractDealerKey(listing.outboundLinks, listing.dealerName);
      console.log(`[DEALER] Key: ${dealerKey}, Confidence: ${dealerKeyConfidence}`);
      
      // GOLDEN MASTERPLAN v4: Generate canonical URL
      let canonicalUrl: string;
      if (listing.outboundLinks.length > 0) {
        const bestLink = selectBestDetailUrl('', listing.outboundLinks);
        canonicalUrl = canonicalizeExternalUrl(bestLink.url);
      } else {
        // Hash-based fallback
        const hashInput = `${dealerKey}|${listing.title}|${listing.year}|${listing.mileage}`;
        const hash = await createHash(hashInput);
        canonicalUrl = `gaspedaal://listing/${hash.substring(0, 16)}`;
      }
      
      const { make, model } = extractMakeModel(listing.title);
      const fingerprint = generateVehicleFingerprint({
        make, model,
        year: listing.year,
        fuelType: listing.fuelType,
        bodyType: listing.bodyType,
        color: listing.color,
        mileage: listing.mileage,
        dealerName: listing.dealerName,
      });

      const now = new Date().toISOString();
      
      // Determine if we need detail page
      let detailData: DetailPageData | null = null;
      let detailHtml: string | null = null;
      let chosenDetailSource: string | null = null;
      let chosenDetailUrl: string | null = null;
      let detailStatus: DetailStatus = 'pending';
      
      // First, do a preliminary lookup without detail data
      const { existingListing: preliminaryLookup, matchType: preliminaryMatchType } = await lookupExistingListing(
        supabase, listing, null, dealerKey, dealerKeyConfidence
      );
      const isNewListing = !preliminaryLookup;
      
      // GOLDEN MASTERPLAN v5: DETAIL SCRAPE DECISION - REDIRECT API PRIORITY
      if (indexOnly) {
        if (isNewListing) {
          stats.skippedIndexOnly++;
          console.log(`[INDEX ONLY] Skipping detail page for new listing`);
        }
      } else if (isNewListing) {
        // NEW LISTING - Try to scrape detail page
        const budgetCheck = checkSafetyLimits(safety, safetyConfig);
        
        if (!budgetCheck.shouldStop) {
          // ===== PHASE 1: RESOLVE EXTERNAL URLS VIA GASPEDAAL REDIRECT API =====
          if (listing.gaspedaalOccasionId && listing.outboundLinks.length === 0) {
            console.log(`[REDIRECT] No direct links found, trying redirect API for occasion ${listing.gaspedaalOccasionId}`);
            
            // Use outbound sources if available, otherwise try common sources
            const sourcesToTry = listing.outboundSources.length > 0 
              ? listing.outboundSources 
              : ['dealersite', 'autotrack', 'autoscout24'];
            
            const resolvedLinks = await resolveGaspedaalRedirect(listing.gaspedaalOccasionId, sourcesToTry);
            
            if (resolvedLinks.length > 0) {
              console.log(`[REDIRECT] Resolved ${resolvedLinks.length} external URLs via redirect API`);
              for (const resolved of resolvedLinks) {
                if (!listing.outboundLinks.find(l => l.url === resolved.url)) {
                  listing.outboundLinks.push({
                    source: resolved.source,
                    url: resolved.url,
                    foundAt: resolved.resolvedFrom,
                  });
                }
              }
              // Update outbound sources
              listing.outboundSources = [...new Set([...listing.outboundSources, ...resolvedLinks.map(r => r.source)])];
            }
          }
          
          // ===== PHASE 2: SELECT BEST DETAIL URL (DEALERSITE PRIORITY) =====
          if (listing.outboundLinks.length > 0) {
            const bestUrl = selectBestDetailUrl('', listing.outboundLinks);
            chosenDetailSource = bestUrl.source;
            chosenDetailUrl = bestUrl.url;
            console.log(`[DETAIL] FIRST SEEN: Using ${bestUrl.source} -> ${bestUrl.url.substring(0, 80)}...`);
            
            stats.detailAttempted++;
            detailHtml = await scrapeWithFirecrawl(bestUrl.url, firecrawlKey, safety, false, dryRun);
            
            if (detailHtml) {
              detailData = extractDetailPageData(detailHtml);
              console.log(`[DETAIL] Extracted ${detailData.optionsRawList?.length || 0} options from ${bestUrl.source}`);
            } else {
              console.log(`[DETAIL] Failed to scrape ${bestUrl.source}, trying fallback...`);
              
              // Try second best source if available
              const remainingLinks = listing.outboundLinks.filter(l => l.url !== bestUrl.url);
              if (remainingLinks.length > 0) {
                const fallbackUrl = selectBestDetailUrl('', remainingLinks);
                console.log(`[DETAIL] Fallback: Using ${fallbackUrl.source} -> ${fallbackUrl.url.substring(0, 80)}...`);
                
                stats.detailAttempted++;
                detailHtml = await scrapeWithFirecrawl(fallbackUrl.url, firecrawlKey, safety, false, dryRun);
                
                if (detailHtml) {
                  chosenDetailSource = fallbackUrl.source;
                  chosenDetailUrl = fallbackUrl.url;
                  detailData = extractDetailPageData(detailHtml);
                  console.log(`[DETAIL] Fallback successful: ${detailData.optionsRawList?.length || 0} options from ${fallbackUrl.source}`);
                }
              }
            }
            await delay(DELAY_BETWEEN_REQUESTS_MS);
            
          // ===== PHASE 3: TRY GASPEDAAL OCCASION PAGE AS LAST RESORT =====
          } else if (listing.gaspedaalDetailUrl) {
            chosenDetailSource = 'gaspedaal_occasion';
            chosenDetailUrl = listing.gaspedaalDetailUrl;
            console.log(`[DETAIL] FALLBACK: Using Gaspedaal occasion page -> ${chosenDetailUrl}`);
            
            stats.detailAttempted++;
            detailHtml = await scrapeWithFirecrawl(chosenDetailUrl, firecrawlKey, safety, false, dryRun);
            
            if (detailHtml) {
              detailData = extractDetailPageData(detailHtml);
              console.log(`[DETAIL] Extracted ${detailData.optionsRawList?.length || 0} options from gaspedaal_occasion`);
              
              // Try to extract external portal links from Gaspedaal occasion page HTML
              const externalLinks = extractExternalLinksFromGaspedaalDetail(detailHtml);
              if (externalLinks.length > 0) {
                console.log(`[DETAIL] Found ${externalLinks.length} external portal links on Gaspedaal page`);
                for (const extLink of externalLinks) {
                  if (!listing.outboundLinks.find(l => l.url === extLink.url)) {
                    listing.outboundLinks.push(extLink);
                  }
                }
              }
            } else {
              console.log(`[DETAIL] Gaspedaal occasion page failed to scrape (SPA skeleton)`);
            }
            await delay(DELAY_BETWEEN_REQUESTS_MS);
            
          } else {
            // NO DETAIL URL AVAILABLE
            detailStatus = 'no_links';
            stats.detailNoLinks++;
            console.log(`[DETAIL] NO LINKS: No occasion ID and no outbound links found`);
          }
        }
      } else {
        // EXISTING LISTING - check if detail already done
        if (['ok', 'partial', 'no_links'].includes(preliminaryLookup.detail_status)) {
          detailStatus = 'skipped_existing';
          console.log(`[DETAIL] SKIP: Already scraped (${preliminaryLookup.detail_status})`);
        }
      }

      // Now do final lookup with detail data (might find by plate/VIN)
      const { existingListing, matchType } = await lookupExistingListing(
        supabase, listing, detailData, dealerKey, dealerKeyConfidence
      );

      // ===== SAVE TO raw_listings =====
      const rawListingId = await saveRawListing(
        supabase, 
        listing, 
        detailData, 
        detailHtml, 
        contentHash, 
        stats,
        safety,
        chosenDetailSource,
        chosenDetailUrl,
        canonicalUrl
      );
      
      if (!rawListingId) {
        console.error(`[ERROR] Failed to save raw listing`);
        safety.failedParses++;
        continue;
      }
      
      console.log(`[RAW] Saved raw listing ${rawListingId}`);

      // Calculate completeness score
      let completeness: CompletenessResult = { score: 0, status: detailStatus, missingFields: [] };
      if (detailData) {
        completeness = calculateCompletenessScore(detailData, listing);
        stats.completenessScores.push(completeness.score);
        
        for (const field of completeness.missingFields) {
          stats.missingFieldsCounts[field] = (stats.missingFieldsCounts[field] || 0) + 1;
        }
        
        if (completeness.status === 'ok') stats.detailOk++;
        else if (completeness.status === 'partial') stats.detailPartial++;
        else if (completeness.status === 'failed') stats.detailFailed++;
      }

      // GOLDEN MASTERPLAN v4: Generate fingerprint v2
      const fingerprintV2 = await generateVehicleFingerprintV2(dealerKey, {
        make, model,
        year: listing.year,
        fuelType: listing.fuelType,
        transmission: listing.transmission,
        bodyType: listing.bodyType,
        mileage: listing.mileage,
        powerPk: listing.powerPk,
        imageUrl: listing.imageUrlThumbnail,
      });
      
      // GOLDEN MASTERPLAN v4: Generate external URL hash
      let externalUrlHash: string | null = null;
      if (listing.outboundLinks.length > 0) {
        const bestLink = selectBestDetailUrl('', listing.outboundLinks);
        externalUrlHash = await hashExternalUrl(bestLink.url);
      }

      if (!existingListing) {
        // TRULY NEW LISTING
        const licensePlateHash = detailData?.licensePlate 
          ? await hashLicensePlate(detailData.licensePlate) 
          : null;
        const vinHash = detailData?.vin
          ? await hashVin(detailData.vin)
          : null;

        const priceBucket = listing.price ? Math.floor(listing.price / 5000) * 5000 : null;
        const mileageBucket = listing.mileage ? Math.floor(listing.mileage / 5000) * 5000 : null;
        
        // Determine readiness
        const { listingReady, taxationReady } = determineReadiness(
          { make, model, year: listing.year, price: listing.price, fuel_type: listing.fuelType,
            mileage: listing.mileage, transmission: listing.transmission, body_type: listing.bodyType },
          dealerKeyConfidence,
          detailData ? completeness.status : detailStatus,
          completeness.score
        );

        // Insert new listing with ALL data
        const insertData: Record<string, any> = {
          url: listing.url,
          canonical_url: canonicalUrl,
          source: 'gaspedaal',
          title: listing.title,
          make,
          model,
          year: listing.year,
          mileage: listing.mileage,
          price: listing.price,
          fuel_type: listing.fuelType,
          transmission: listing.transmission,
          body_type: listing.bodyType,
          color: listing.color,
          doors: listing.doors,
          power_pk: listing.powerPk,
          dealer_name: listing.dealerName,
          dealer_city: listing.dealerCity,
          status: 'active',
          first_seen_at: now,
          last_seen_at: now,
          content_hash: contentHash,
          vehicle_fingerprint: fingerprint,
          license_plate_hash: licensePlateHash,
          vin_hash: vinHash,
          price_bucket: priceBucket,
          mileage_bucket: mileageBucket,
          outbound_sources: listing.outboundSources,
          outbound_links: listing.outboundLinks,
          raw_listing_id: rawListingId,
          // Detail quality tracking
          detail_status: detailData ? completeness.status : detailStatus,
          detail_completeness_score: completeness.score,
          detail_attempts: detailData ? 1 : 0,
          detail_scraped_at: detailData ? now : null,
          needs_detail_rescrape: detailData ? (completeness.status !== 'ok') : (detailStatus !== 'no_links'),
          last_detail_error: completeness.status !== 'ok' && completeness.missingFields.length > 0
            ? `Missing: ${completeness.missingFields.join(', ')}`
            : null,
          chosen_detail_source: chosenDetailSource,
          chosen_detail_url: chosenDetailUrl,
          // GOLDEN MASTERPLAN v4 NEW FIELDS
          dealer_key: dealerKey,
          dealer_key_confidence: dealerKeyConfidence,
          fingerprint_hash_v2: fingerprintV2,
          external_canonical_url_hash: externalUrlHash,
          image_url_thumbnail: listing.imageUrlThumbnail,
          listing_ready: listingReady,
          taxation_ready: taxationReady,
          detail_sources_tried: chosenDetailSource ? [{
            source: chosenDetailSource,
            url: chosenDetailUrl,
            attemptedAt: now,
            score: completeness.score,
            success: completeness.status === 'ok' || completeness.status === 'partial',
          }] : [],
          detail_best_score: completeness.score,
          // GOLDEN MASTERPLAN v4: Gaspedaal occasion URL
          gaspedaal_occasion_id: listing.gaspedaalOccasionId,
          gaspedaal_detail_url: listing.gaspedaalDetailUrl,
        };
        
        // Add detail data if available
        if (detailData) {
          insertData.options_raw = detailData.optionsRawText;
          insertData.description_raw = detailData.descriptionRaw;
          insertData.engine_cc = detailData.engineCc;
          insertData.battery_capacity_kwh = detailData.batteryCapacityKwh;
          insertData.electric_range_km = detailData.electricRangeKm;
          insertData.drivetrain = detailData.drivetrain;
          insertData.vin = detailData.vin;
          insertData.image_url_main = detailData.imageUrlMain;
          insertData.image_count = detailData.imageCount;
        }

        const { data: newListing, error: insertError } = await supabase
          .from('listings')
          .insert(insertData)
          .select('id')
          .single();

        if (insertError) {
          console.error('[ERROR] Inserting listing:', insertError);
          stats.errorsCount++;
          safety.failedParses++;
        } else {
          stats.listingsNew++;
          safety.successfulParses++;

          await logVehicleEvent(supabase, newListing.id, 'created', {
            price: listing.price,
            listing: { make, model, year: listing.year, mileage: listing.mileage, fuel_type: listing.fuelType },
          });
        }
      } else {
        // EXISTING LISTING - found by hard ID
        
        // Log URL change if matched by plate/VIN with different URL
        if (matchType === 'license_plate_hash' || matchType === 'vin_hash') {
          if (existingListing.canonical_url !== canonicalUrl && existingListing.url !== listing.url) {
            await logVehicleEvent(supabase, existingListing.id, 'url_changed', {
              price: listing.price,
              reason: { 
                old_url: existingListing.url, 
                new_url: listing.url,
                matched_by: matchType 
              },
            });
            console.log(`[DEDUP] URL changed for listing ${existingListing.id}: matched by ${matchType}`);
          }
        }
        
        // Update raw_listing_id link if not set
        if (!existingListing.raw_listing_id) {
          await supabase
            .from('listings')
            .update({ raw_listing_id: rawListingId })
            .eq('id', existingListing.id);
        }
        
        // Handle returned listings
        if (existingListing.status === 'gone_suspected') {
          const daysSinceGone = daysSince(existingListing.gone_detected_at);
          
          if (daysSinceGone < SOLD_CONFIRMED_DAYS) {
            await supabase
              .from('listings')
              .update({
                status: 'returned',
                url: listing.url,
                canonical_url: canonicalUrl,
                price: listing.price,
                mileage: listing.mileage,
                last_seen_at: now,
                content_hash: contentHash,
                raw_listing_id: rawListingId,
                // Update v4 fields
                dealer_key: dealerKey,
                dealer_key_confidence: dealerKeyConfidence,
                fingerprint_hash_v2: fingerprintV2,
                external_canonical_url_hash: externalUrlHash,
              })
              .eq('id', existingListing.id);

            await logVehicleEvent(supabase, existingListing.id, 'returned', {
              price: listing.price,
              isRealSale: false,
              reason: { days_gone: daysSinceGone, matched_by: matchType },
            });

            stats.listingsReturned++;
            safety.successfulParses++;
            continue;
          }
        }

        // Reset returned listings to active
        if (existingListing.status === 'returned') {
          await supabase
            .from('listings')
            .update({ status: 'active', last_seen_at: now })
            .eq('id', existingListing.id);
        }

        // Check for price change
        if (existingListing.price !== listing.price && listing.price !== null) {
          await supabase
            .from('listings')
            .update({
              url: listing.url,
              canonical_url: canonicalUrl,
              price: listing.price,
              previous_price: existingListing.price,
              last_seen_at: now,
              content_hash: contentHash,
              // Update v4 fields
              dealer_key: dealerKey,
              dealer_key_confidence: dealerKeyConfidence,
              fingerprint_hash_v2: fingerprintV2,
              external_canonical_url_hash: externalUrlHash,
            })
            .eq('id', existingListing.id);

          await logVehicleEvent(supabase, existingListing.id, 'price_changed', {
            price: listing.price,
            reason: { previous_price: existingListing.price },
          });

          await supabase.from('listing_snapshots').insert({
            listing_id: existingListing.id,
            price: listing.price,
            mileage: listing.mileage,
            status: 'active',
            price_changed: true,
            price_delta: listing.price - (existingListing.price || 0),
          });

          stats.listingsUpdated++;
        } else {
          // Just update last_seen_at
          await supabase
            .from('listings')
            .update({ 
              last_seen_at: now, 
              status: 'active',
              canonical_url: canonicalUrl,
              // Update v4 fields
              dealer_key: dealerKey,
              dealer_key_confidence: dealerKeyConfidence,
              fingerprint_hash_v2: fingerprintV2,
              external_canonical_url_hash: externalUrlHash,
            })
            .eq('id', existingListing.id);
        }

        safety.successfulParses++;
      }
    }

    await delay(DELAY_BETWEEN_REQUESTS_MS);
  }
  
  // Process healing queue if not in index-only mode
  if (!indexOnly && !dryRun) {
    const safetyCheck = checkSafetyLimits(safety, safetyConfig);
    if (!safetyCheck.shouldStop) {
      await processHealingQueue(supabase, firecrawlKey, safety, safetyConfig, stats, dryRun);
    }
  }
}

// ===== LIFECYCLE CHECK MODE: Main logic =====
async function runLifecycleCheckMode(
  supabase: any,
  safety: SafetyState,
  stats: JobStats,
  targetMakes?: string[]
): Promise<void> {
  console.log(`[LIFECYCLE] Starting lifecycle check mode`);
  const now = new Date().toISOString();

  // 1. Find stale active listings
  let query = supabase
    .from('listings')
    .select('id, url, first_seen_at, last_seen_at, price, license_plate_hash, vehicle_fingerprint, make, model, year, mileage, fuel_type')
    .eq('source', 'gaspedaal')
    .eq('status', 'active')
    .lt('last_seen_at', new Date(Date.now() - GONE_SUSPECTED_DAYS * 24 * 60 * 60 * 1000).toISOString());

  if (targetMakes && targetMakes.length > 0) {
    query = query.in('make', targetMakes);
  }

  const { data: staleListings, error: staleError } = await query.limit(1000);

  if (staleError) {
    console.error('[LIFECYCLE] Error fetching stale listings:', staleError);
    return;
  }

  console.log(`[LIFECYCLE] Found ${staleListings?.length || 0} stale listings to mark as gone_suspected`);

  for (const listing of (staleListings || [])) {
    const daysOnMarket = daysSince(listing.first_seen_at);

    await supabase
      .from('listings')
      .update({
        status: 'gone_suspected',
        gone_detected_at: now,
      })
      .eq('id', listing.id);

    await logVehicleEvent(supabase, listing.id, 'gone_detected', {
      price: listing.price,
      daysOnMarket,
      listing,
    });

    stats.listingsGoneSuspected++;
  }

  // 2. Confirm sales for old gone listings
  const { data: oldGoneListings, error: oldGoneError } = await supabase
    .from('listings')
    .select('id, url, first_seen_at, gone_detected_at, price, license_plate_hash, vehicle_fingerprint, make, model, year, mileage, fuel_type')
    .eq('source', 'gaspedaal')
    .eq('status', 'gone_suspected')
    .lt('gone_detected_at', new Date(Date.now() - SOLD_CONFIRMED_DAYS * 24 * 60 * 60 * 1000).toISOString())
    .limit(500);

  if (oldGoneError) {
    console.error('[LIFECYCLE] Error fetching old gone listings:', oldGoneError);
    return;
  }

  console.log(`[LIFECYCLE] Found ${oldGoneListings?.length || 0} listings to confirm as sold`);

  for (const listing of (oldGoneListings || [])) {
    const daysOnMarket = daysSince(listing.first_seen_at);

    await supabase
      .from('listings')
      .update({
        status: 'sold_confirmed',
        sold_confirmed_at: now,
      })
      .eq('id', listing.id);

    await logVehicleEvent(supabase, listing.id, 'sold_confirmed', {
      price: listing.price,
      daysOnMarket,
      isRealSale: true,
      listing,
    });

    stats.listingsSoldConfirmed++;
  }
}

// ===== MAIN HANDLER =====
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const errorLog: Array<{ timestamp: string; message: string; url?: string }> = [];
  
  const stats: JobStats = {
    pagesProcessed: 0,
    listingsFound: 0,
    listingsNew: 0,
    listingsUpdated: 0,
    listingsGoneSuspected: 0,
    listingsSoldConfirmed: 0,
    listingsReturned: 0,
    errorsCount: 0,
    rawListingsSaved: 0,
    detailHtmlSaved: 0,
    skippedIndexOnly: 0,
    detailAttempted: 0,
    detailOk: 0,
    detailPartial: 0,
    detailFailed: 0,
    detailHealed: 0,
    detailNoLinks: 0,
    avgCompletenessScore: 0,
    completenessScores: [],
    missingFieldsCounts: {},
  };

  const safety: SafetyState = {
    creditsUsedToday: 0,
    creditsUsedThisRun: 0,
    indexRequests: 0,
    detailRequests: 0,
    totalProcessed: 0,
    successfulParses: 0,
    failedParses: 0,
    unknownYearPriceCount: 0,
    errors: 0,
    stopReason: null,
    rawListingsSaved: 0,
    detailHtmlSaved: 0,
  };

  try {
    const body = await req.json();
    const { 
      jobId, 
      mode = 'discovery' as JobMode,
      targetMakes = [] as string[],
      maxPages = 50,
      maxCredits = DEFAULT_MAX_CREDITS_PER_RUN,
      dryRun = false,
      indexOnly = false,
    } = body;
    
    console.log(`[START] Gaspedaal ${mode} job ${jobId} - GOLDEN MASTERPLAN v4`);
    console.log(`[CONFIG] maxPages=${maxPages}, maxCredits=${maxCredits}, dryRun=${dryRun}, indexOnly=${indexOnly}`);
    console.log(`[CONFIG] targetMakes=${targetMakes.join(',') || 'all'}`);

    // Initialize clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');

    if (!firecrawlKey && !dryRun) {
      throw new Error('FIRECRAWL_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get safety config
    const { data: configData } = await supabase
      .from('scraper_configs')
      .select('max_credits_per_day, error_rate_threshold, parse_quality_threshold')
      .eq('source', 'gaspedaal')
      .maybeSingle();

    const safetyConfig: SafetyConfig = {
      maxCreditsPerDay: configData?.max_credits_per_day ?? DEFAULT_MAX_CREDITS_PER_DAY,
      maxCreditsPerRun: maxCredits,
      errorRateThreshold: parseFloat(configData?.error_rate_threshold ?? DEFAULT_ERROR_RATE_THRESHOLD),
      parseQualityThreshold: parseFloat(configData?.parse_quality_threshold ?? DEFAULT_PARSE_QUALITY_THRESHOLD),
    };

    console.log('[SAFETY CONFIG]', JSON.stringify(safetyConfig));

    // Get today's credit usage
    if (!dryRun) {
      safety.creditsUsedToday = await getTodayCreditUsage(supabase, 'gaspedaal');
      console.log(`[CREDITS] Used today before job: ${safety.creditsUsedToday}`);

      if (safety.creditsUsedToday >= safetyConfig.maxCreditsPerDay) {
        throw new Error(`Daily credit budget already reached (${safety.creditsUsedToday}/${safetyConfig.maxCreditsPerDay})`);
      }
    }

    // Update job status
    await supabase
      .from('scraper_jobs')
      .update({ 
        status: 'running', 
        started_at: new Date().toISOString(),
        job_type: mode,
      })
      .eq('id', jobId);

    // Run appropriate mode
    if (mode === 'discovery') {
      await runDiscoveryMode(
        supabase,
        firecrawlKey || '',
        safety,
        safetyConfig,
        stats,
        errorLog,
        maxPages,
        dryRun,
        indexOnly
      );
    } else if (mode === 'lifecycle_check') {
      await runLifecycleCheckMode(
        supabase,
        safety,
        stats,
        targetMakes
      );
    }

    // Calculate duration and averages
    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
    const parseSuccessRate = safety.totalProcessed > 0 
      ? safety.successfulParses / safety.totalProcessed 
      : 1;
    const errorRate = safety.totalProcessed > 0 
      ? safety.errors / safety.totalProcessed 
      : 0;
    
    if (stats.completenessScores.length > 0) {
      stats.avgCompletenessScore = Math.round(
        stats.completenessScores.reduce((a, b) => a + b, 0) / stats.completenessScores.length
      );
    }

    let stopReason = safety.stopReason;
    if (dryRun) stopReason = 'dry_run_complete';
    else if (indexOnly && !stopReason) stopReason = 'index_only_complete';

    // Update job as completed
    await supabase
      .from('scraper_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
        pages_processed: stats.pagesProcessed,
        listings_found: stats.listingsFound,
        listings_new: stats.listingsNew,
        listings_updated: stats.listingsUpdated,
        listings_gone: stats.listingsGoneSuspected + stats.listingsSoldConfirmed,
        errors_count: stats.errorsCount,
        credits_used: dryRun ? 0 : safety.creditsUsedThisRun,
        sitemap_requests: safety.indexRequests,
        detail_requests: safety.detailRequests,
        parse_success_rate: parseSuccessRate,
        error_rate: errorRate,
        stop_reason: stopReason,
        error_log: errorLog.slice(0, 100),
      })
      .eq('id', jobId);

    // Update daily credit usage
    if (!dryRun) {
      await updateDailyCreditUsage(
        supabase,
        'gaspedaal',
        safety.creditsUsedThisRun,
        safety.indexRequests,
        safety.detailRequests
      );
    }

    // Build top missing fields
    const topMissingFields = Object.entries(stats.missingFieldsCounts)
      .map(([field, count]) => ({ field, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const result = {
      success: true,
      jobId,
      mode,
      dryRun,
      indexOnly,
      duration: durationSeconds,
      goldenMasterplanVersion: 'v4',
      stats: {
        ...stats,
        creditsUsed: dryRun ? 0 : safety.creditsUsedThisRun,
        indexRequests: safety.indexRequests,
        detailRequests: safety.detailRequests,
        parseSuccessRate: (parseSuccessRate * 100).toFixed(1) + '%',
        errorRate: (errorRate * 100).toFixed(1) + '%',
        rawListingsSaved: stats.rawListingsSaved,
        detailHtmlSaved: stats.detailHtmlSaved,
        skippedIndexOnly: stats.skippedIndexOnly,
        detailStats: {
          attempted: stats.detailAttempted,
          ok: stats.detailOk,
          partial: stats.detailPartial,
          failed: stats.detailFailed,
          noLinks: stats.detailNoLinks,
          healed: stats.detailHealed,
          avgCompletenessScore: stats.avgCompletenessScore,
          topMissingFields,
        },
      },
      stopReason,
    };

    console.log('[COMPLETE]', JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[FATAL ERROR]', error);

    try {
      const { jobId } = await req.clone().json();
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase
        .from('scraper_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          duration_seconds: Math.floor((Date.now() - startTime) / 1000),
          stop_reason: errorMessage,
          error_log: [{
            timestamp: new Date().toISOString(),
            message: errorMessage,
          }],
        })
        .eq('id', jobId);
    } catch {
      console.error('[FATAL] Could not update job status');
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        stats,
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
