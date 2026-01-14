import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ===== CONFIGURATION =====
const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1/scrape';
const SITEMAP_INDEX_URL = 'https://www.gaspedaal.nl/sitemap-v3_gaspedaal.xml';
const DELAY_BETWEEN_REQUESTS_MS = 200;
const MAX_LISTINGS_PER_RUN = 8000;
const BATCH_SIZE = 50;

// ===== SAFETY THRESHOLDS (configurable via config) =====
const DEFAULT_MAX_CREDITS_PER_DAY = 15000;
const DEFAULT_ERROR_RATE_THRESHOLD = 0.10;
const DEFAULT_PARSE_QUALITY_THRESHOLD = 0.50;
const SAFETY_CHECK_INTERVAL = 100; // Check safety every N listings

// ===== TYPES =====
interface SitemapEntry {
  url: string;
  lastmod: string | null;
}

interface RawListingData {
  url: string;
  raw_title: string;
  raw_price: string | null;
  raw_mileage: string | null;
  raw_year: string | null;
  raw_fuel_type: string | null;
  raw_transmission: string | null;
  raw_body_type: string | null;
  raw_color: string | null;
  raw_doors: string | null;
  raw_license_plate: string | null;
  raw_options: string | null;
  dealer_name_raw: string | null;
  dealer_city_raw: string | null;
  dealer_page_url: string | null;
}

interface CategorizedListings {
  new: SitemapEntry[];
  changed: SitemapEntry[];
  unchanged: SitemapEntry[];
  gone: string[];
}

interface SafetyConfig {
  maxCreditsPerDay: number;
  errorRateThreshold: number;
  parseQualityThreshold: number;
}

interface SafetyState {
  creditsUsedToday: number;
  sitemapRequests: number;
  detailRequests: number;
  totalProcessed: number;
  successfulParses: number;
  failedParses: number;
  errors: number;
  stopReason: string | null;
}

// ===== HELPER: SHA-256 Content Hash =====
async function createContentHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ===== HELPER: Vehicle Fingerprint (Enhanced) =====
function generateVehicleFingerprint(listing: {
  make?: string | null;
  model?: string | null;
  year?: number | null;
  mileage?: number | null;
  dealer_city?: string | null;
  color?: string | null;
  doors?: number | null;
}): string {
  const normalize = (s: string | null | undefined) => (s || '').toLowerCase().trim().replace(/\s+/g, '');
  const mileageBucket = listing.mileage ? Math.round(listing.mileage / 5000) * 5000 : 0;
  
  return [
    normalize(listing.make),
    normalize(listing.model),
    listing.year || 'unknown',
    mileageBucket,
    normalize(listing.dealer_city),
    normalize(listing.color),
    listing.doors || 0,
  ].join('|');
}

// ===== HELPER: Parse Functions =====
function safeParsePrice(raw: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d]/g, '');
  const value = parseInt(cleaned, 10);
  return isNaN(value) ? null : value;
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

// ===== HELPER: Delay =====
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== SAFETY: Check if we should stop =====
function checkSafetyLimits(
  safety: SafetyState,
  config: SafetyConfig
): { shouldStop: boolean; reason: string | null } {
  // Check credit budget
  if (safety.creditsUsedToday >= config.maxCreditsPerDay) {
    return { 
      shouldStop: true, 
      reason: `Daily credit budget reached (${safety.creditsUsedToday}/${config.maxCreditsPerDay})` 
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
    const parseRate = safety.successfulParses / (safety.successfulParses + safety.failedParses);
    if (parseRate < config.parseQualityThreshold) {
      return { 
        shouldStop: true, 
        reason: `Parse success rate too low: ${(parseRate * 100).toFixed(1)}% (threshold: ${(config.parseQualityThreshold * 100).toFixed(1)}%)` 
      };
    }
  }

  return { shouldStop: false, reason: null };
}

// ===== SAFETY: Update daily credit usage =====
async function updateDailyCreditUsage(
  supabase: any,
  source: string,
  credits: number,
  sitemapReqs: number,
  detailReqs: number
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    // Try to upsert credit usage for today
    await supabase
      .from('scraper_credit_usage')
      .upsert({
        date: today,
        source,
        credits_used: credits,
        sitemap_requests: sitemapReqs,
        detail_requests: detailReqs,
        jobs_count: 1,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'date,source',
      });
  } catch (error) {
    console.error('Error updating credit usage:', error);
  }
}

// ===== SAFETY: Get today's credit usage =====
async function getTodayCreditUsage(
  supabase: any,
  source: string
): Promise<number> {
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

// ===== FIRECRAWL: Scrape URL =====
async function scrapeWithFirecrawl(
  url: string, 
  apiKey: string,
  safety: SafetyState
): Promise<string | null> {
  try {
    safety.creditsUsedToday++;
    safety.detailRequests++;

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
      }),
    });

    if (!response.ok) {
      console.error(`Firecrawl error for ${url}: ${response.status}`);
      safety.errors++;
      return null;
    }

    const data = await response.json();
    return data.data?.html || data.html || null;
  } catch (error) {
    console.error(`Firecrawl fetch error for ${url}:`, error);
    safety.errors++;
    return null;
  }
}

// ===== SITEMAP: Scrape for sitemap (tracks credits) =====
async function scrapeForSitemap(
  url: string, 
  apiKey: string,
  safety: SafetyState
): Promise<string | null> {
  safety.sitemapRequests++;
  return scrapeWithFirecrawl(url, apiKey, safety);
}

// ===== SITEMAP: Parse Index =====
async function fetchSitemapIndex(apiKey: string, safety: SafetyState): Promise<string[]> {
  console.log('Fetching sitemap index:', SITEMAP_INDEX_URL);
  
  const html = await scrapeForSitemap(SITEMAP_INDEX_URL, apiKey, safety);
  if (!html) {
    console.error('Failed to fetch sitemap index');
    return [];
  }

  const sitemapUrls: string[] = [];
  const regex = /<loc>([^<]+)<\/loc>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const url = match[1].trim();
    if (url.includes('sitemap') && url.endsWith('.xml')) {
      sitemapUrls.push(url);
    }
  }

  console.log(`Found ${sitemapUrls.length} child sitemaps`);
  return sitemapUrls;
}

// ===== SITEMAP: Parse Child Sitemap =====
async function fetchSitemapEntries(
  sitemapUrl: string, 
  apiKey: string,
  safety: SafetyState
): Promise<SitemapEntry[]> {
  console.log('Fetching sitemap:', sitemapUrl);
  
  const html = await scrapeForSitemap(sitemapUrl, apiKey, safety);
  if (!html) {
    console.error('Failed to fetch sitemap:', sitemapUrl);
    return [];
  }

  const entries: SitemapEntry[] = [];
  const urlBlockRegex = /<url>([\s\S]*?)<\/url>/gi;
  let blockMatch;
  
  while ((blockMatch = urlBlockRegex.exec(html)) !== null) {
    const block = blockMatch[1];
    const locMatch = block.match(/<loc>([^<]+)<\/loc>/i);
    const lastmodMatch = block.match(/<lastmod>([^<]+)<\/lastmod>/i);
    
    if (locMatch) {
      const url = locMatch[1].trim();
      if (url.includes('/occasion/') || url.includes('/auto/')) {
        entries.push({
          url,
          lastmod: lastmodMatch ? lastmodMatch[1].trim() : null,
        });
      }
    }
  }

  console.log(`Parsed ${entries.length} listing entries from ${sitemapUrl}`);
  return entries;
}

// ===== CATEGORIZE: Compare sitemap vs DB =====
async function categorizeListings(
  sitemapEntries: SitemapEntry[],
  supabase: any
): Promise<CategorizedListings> {
  const result: CategorizedListings = {
    new: [],
    changed: [],
    unchanged: [],
    gone: [],
  };

  const { data: existingListings, error } = await supabase
    .from('listings')
    .select('url, sitemap_lastmod, status')
    .eq('source', 'gaspedaal');

  if (error) {
    console.error('Error fetching existing listings:', error);
    return result;
  }

  type ListingRow = { url: string; sitemap_lastmod: string | null; status: string };
  const existingMap = new Map<string, { sitemap_lastmod: string | null; status: string }>();
  for (const listing of (existingListings || []) as ListingRow[]) {
    existingMap.set(listing.url, {
      sitemap_lastmod: listing.sitemap_lastmod,
      status: listing.status,
    });
  }

  const sitemapUrlSet = new Set(sitemapEntries.map(e => e.url));

  for (const entry of sitemapEntries) {
    const existing = existingMap.get(entry.url);

    if (!existing) {
      result.new.push(entry);
    } else if (entry.lastmod) {
      const entryLastmod = new Date(entry.lastmod).getTime();
      const dbLastmod = existing.sitemap_lastmod 
        ? new Date(existing.sitemap_lastmod).getTime() 
        : 0;

      if (entryLastmod > dbLastmod) {
        result.changed.push(entry);
      } else {
        result.unchanged.push(entry);
      }
    } else {
      result.unchanged.push(entry);
    }
  }

  for (const [url, data] of existingMap) {
    if (!sitemapUrlSet.has(url) && data.status === 'active') {
      result.gone.push(url);
    }
  }

  console.log(`Categorized: ${result.new.length} new, ${result.changed.length} changed, ${result.unchanged.length} unchanged, ${result.gone.length} gone`);
  return result;
}

// ===== EXTRACT: Enhanced listing details from HTML =====
function extractListingDetails(html: string, url: string): RawListingData | null {
  try {
    // Extract title
    let title = '';
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
                       html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1].trim()
        .replace(/\s*[-|]\s*Gaspedaal.*$/i, '')
        .replace(/\s+/g, ' ');
    }
    
    if (!title) {
      console.log(`No title found for ${url}`);
      return null;
    }

    // Extract price
    let rawPrice: string | null = null;
    const pricePatterns = [
      /€\s*[\d.,]+/i,
      /class="[^"]*price[^"]*"[^>]*>([^<]+)</i,
      /data-price="([^"]+)"/i,
    ];
    for (const pattern of pricePatterns) {
      const match = html.match(pattern);
      if (match) {
        rawPrice = match[0].includes('€') ? match[0] : match[1];
        break;
      }
    }

    // Extract mileage
    let rawMileage: string | null = null;
    const mileagePatterns = [
      /(\d{1,3}(?:[.,]\d{3})*)\s*km/i,
      /kilometerstand[^<]*?(\d{1,3}(?:[.,]\d{3})*)/i,
    ];
    for (const pattern of mileagePatterns) {
      const match = html.match(pattern);
      if (match) {
        rawMileage = match[1] ? `${match[1]} km` : match[0];
        break;
      }
    }

    // Extract year
    let rawYear: string | null = null;
    const yearPatterns = [
      /bouwjaar[^<]*?(\d{4})/i,
      /(\d{2}[-\/]\d{4})/,
    ];
    for (const pattern of yearPatterns) {
      const match = html.match(pattern);
      if (match) {
        rawYear = match[1] || match[0];
        break;
      }
    }

    // Extract fuel type
    let rawFuelType: string | null = null;
    const fuelPatterns = [
      /brandstof[^<]*?<[^>]*>([^<]+)</i,
      /(benzine|diesel|elektrisch|hybride|lpg|cng|waterstof|plug-in hybride)/i,
    ];
    for (const pattern of fuelPatterns) {
      const match = html.match(pattern);
      if (match) {
        rawFuelType = normalizeFuelType(match[1]);
        break;
      }
    }

    // Extract transmission
    let rawTransmission: string | null = null;
    const transPatterns = [
      /transmissie[^<]*?<[^>]*>([^<]+)</i,
      /(automaat|handgeschakeld|cvt|dsg|manueel|semi-automaat)/i,
    ];
    for (const pattern of transPatterns) {
      const match = html.match(pattern);
      if (match) {
        rawTransmission = normalizeTransmission(match[1]);
        break;
      }
    }

    // Extract body type (NEW)
    let rawBodyType: string | null = null;
    const bodyPatterns = [
      /carrosserie[^<]*?<[^>]*>([^<]+)</i,
      /(hatchback|sedan|suv|stationwagon|stationwagen|mpv|cabrio|coupé|coupe|terreinwagen|bus|pick-?up|crossover|roadster)/i,
    ];
    for (const pattern of bodyPatterns) {
      const match = html.match(pattern);
      if (match) {
        rawBodyType = normalizeBodyType(match[1]);
        break;
      }
    }

    // Extract color (NEW)
    let rawColor: string | null = null;
    const colorPatterns = [
      /kleur[^<]*?<[^>]*>([^<]+)</i,
      /exterieur[^<]*?kleur[^<]*?<[^>]*>([^<]+)</i,
    ];
    for (const pattern of colorPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        rawColor = match[1].trim().toLowerCase();
        break;
      }
    }

    // Extract doors (NEW)
    let rawDoors: string | null = null;
    const doorsMatch = html.match(/(\d)\s*-?\s*deurs/i);
    if (doorsMatch) {
      rawDoors = doorsMatch[1];
    }

    // Extract license plate (NEW) - Dutch format
    let rawLicensePlate: string | null = null;
    const licensePlatePatterns = [
      /kenteken[^<]*?<[^>]*>([A-Z0-9]{1,3}[-\s]?[A-Z0-9]{2,3}[-\s]?[A-Z0-9]{1,2})</i,
      /([A-Z]{2}[-\s]?\d{3}[-\s]?[A-Z]{1})/,
      /([A-Z]{1}[-\s]?\d{3}[-\s]?[A-Z]{2})/,
      /(\d{1,3}[-\s]?[A-Z]{2,3}[-\s]?[A-Z0-9]{1,2})/,
    ];
    for (const pattern of licensePlatePatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        rawLicensePlate = match[1].replace(/\s/g, '-').toUpperCase();
        break;
      }
    }

    // Extract options (NEW)
    let rawOptions: string | null = null;
    const optionsMatch = html.match(/uitrusting[^<]*?<[^>]*>([\s\S]{0,500}?)<\/div>/i);
    if (optionsMatch && optionsMatch[1]) {
      rawOptions = optionsMatch[1]
        .replace(/<[^>]+>/g, ', ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 500);
    }

    // Extract dealer info
    let dealerNameRaw: string | null = null;
    let dealerCityRaw: string | null = null;
    let dealerPageUrl: string | null = null;

    const dealerPatterns = [
      /class="[^"]*dealer[^"]*"[^>]*>([^<]+)</i,
      /verkoper[^<]*?<[^>]*>([^<]+)</i,
      /aangeboden\s+door[^<]*?<[^>]*>([^<]+)</i,
    ];
    for (const pattern of dealerPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        dealerNameRaw = match[1].trim();
        break;
      }
    }

    const cityPatterns = [
      /plaats[^<]*?<[^>]*>([^<]+)</i,
      /locatie[^<]*?<[^>]*>([^<]+)</i,
    ];
    for (const pattern of cityPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        dealerCityRaw = match[1].trim();
        break;
      }
    }

    const dealerLinkMatch = html.match(/href="(\/dealer\/[^"]+)"/i) ||
                            html.match(/href="(https:\/\/www\.gaspedaal\.nl\/dealer\/[^"]+)"/i);
    if (dealerLinkMatch) {
      dealerPageUrl = dealerLinkMatch[1].startsWith('/') 
        ? `https://www.gaspedaal.nl${dealerLinkMatch[1]}`
        : dealerLinkMatch[1];
    }

    return {
      url,
      raw_title: title,
      raw_price: rawPrice,
      raw_mileage: rawMileage,
      raw_year: rawYear,
      raw_fuel_type: rawFuelType,
      raw_transmission: rawTransmission,
      raw_body_type: rawBodyType,
      raw_color: rawColor,
      raw_doors: rawDoors,
      raw_license_plate: rawLicensePlate,
      raw_options: rawOptions,
      dealer_name_raw: dealerNameRaw,
      dealer_city_raw: dealerCityRaw,
      dealer_page_url: dealerPageUrl,
    };
  } catch (error) {
    console.error(`Error extracting details from ${url}:`, error);
    return null;
  }
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
    'hydrogen': 'waterstof',
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
    'semi-automaat': 'semi-automaat',
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
    'bus': 'mpv',
    'pick-up': 'pickup',
    'pickup': 'pickup',
    'crossover': 'suv',
    'roadster': 'cabrio',
  };
  return mapping[lower] || lower;
}

// ===== EXTRACT: Make/Model from title =====
function extractMakeModel(title: string): { make: string | null; model: string | null } {
  const makes = [
    'Audi', 'BMW', 'Mercedes-Benz', 'Mercedes', 'Volkswagen', 'VW', 'Opel', 'Ford',
    'Peugeot', 'Renault', 'Citroën', 'Citroen', 'Fiat', 'Toyota', 'Honda', 'Mazda',
    'Nissan', 'Hyundai', 'Kia', 'Volvo', 'Skoda', 'Škoda', 'Seat', 'SEAT', 'MINI', 
    'Porsche', 'Land Rover', 'Jaguar', 'Tesla', 'Lexus', 'Alfa Romeo', 'Jeep', 
    'Suzuki', 'Mitsubishi', 'Dacia', 'Smart', 'Chevrolet', 'Dodge', 'Ferrari', 
    'Lamborghini', 'Maserati', 'Bentley', 'Rolls-Royce', 'Aston Martin', 'DS',
    'Cupra', 'Polestar', 'Genesis', 'MG', 'BYD', 'Lynk & Co', 'NIO', 'XPeng'
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
      
      return { make: normalizedMake, model };
    }
  }

  return { make: null, model: null };
}

// ===== MAIN HANDLER =====
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const errorLog: Array<{ timestamp: string; message: string; url?: string }> = [];
  const stats = {
    pages: 0,
    found: 0,
    new: 0,
    updated: 0,
    gone: 0,
    errors: 0,
  };

  // Initialize safety state
  const safety: SafetyState = {
    creditsUsedToday: 0,
    sitemapRequests: 0,
    detailRequests: 0,
    totalProcessed: 0,
    successfulParses: 0,
    failedParses: 0,
    errors: 0,
    stopReason: null,
  };

  try {
    const { jobId, mode = 'incremental' } = await req.json();
    
    console.log(`Starting Gaspedaal discovery job ${jobId} in ${mode} mode`);

    // Initialize clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');

    if (!firecrawlKey) {
      throw new Error('FIRECRAWL_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get safety config from database
    const { data: configData } = await supabase
      .from('scraper_configs')
      .select('max_credits_per_day, error_rate_threshold, parse_quality_threshold')
      .eq('source', 'gaspedaal')
      .maybeSingle();

    const safetyConfig: SafetyConfig = {
      maxCreditsPerDay: configData?.max_credits_per_day ?? DEFAULT_MAX_CREDITS_PER_DAY,
      errorRateThreshold: parseFloat(configData?.error_rate_threshold ?? DEFAULT_ERROR_RATE_THRESHOLD),
      parseQualityThreshold: parseFloat(configData?.parse_quality_threshold ?? DEFAULT_PARSE_QUALITY_THRESHOLD),
    };

    console.log('Safety config:', safetyConfig);

    // Get today's credit usage
    safety.creditsUsedToday = await getTodayCreditUsage(supabase, 'gaspedaal');
    console.log(`Credits used today before job: ${safety.creditsUsedToday}`);

    // Pre-flight budget check
    if (safety.creditsUsedToday >= safetyConfig.maxCreditsPerDay) {
      throw new Error(`Daily credit budget already reached (${safety.creditsUsedToday}/${safetyConfig.maxCreditsPerDay})`);
    }

    // Update job status to running
    await supabase
      .from('scraper_jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', jobId);

    // ===== PHASE 1: Fetch and parse sitemaps =====
    const sitemapUrls = await fetchSitemapIndex(firecrawlKey, safety);
    stats.pages = sitemapUrls.length;

    if (sitemapUrls.length === 0) {
      errorLog.push({
        timestamp: new Date().toISOString(),
        message: 'No sitemaps found in index',
        url: SITEMAP_INDEX_URL,
      });
      stats.errors++;
    }

    // Fetch all sitemap entries (with safety checks)
    const allEntries: SitemapEntry[] = [];
    for (const sitemapUrl of sitemapUrls) {
      // Check safety before each sitemap fetch
      const safetyCheck = checkSafetyLimits(safety, safetyConfig);
      if (safetyCheck.shouldStop) {
        console.log(`Safety stop during sitemap fetch: ${safetyCheck.reason}`);
        safety.stopReason = safetyCheck.reason;
        break;
      }

      const entries = await fetchSitemapEntries(sitemapUrl, firecrawlKey, safety);
      allEntries.push(...entries);
      await delay(DELAY_BETWEEN_REQUESTS_MS);
    }

    console.log(`Total sitemap entries: ${allEntries.length}`);
    stats.found = allEntries.length;

    // ===== PHASE 2: Categorize listings =====
    const categorized = await categorizeListings(allEntries, supabase);

    // ===== PHASE 3: Mark gone listings (0 credits!) =====
    if (categorized.gone.length > 0 && !safety.stopReason) {
      console.log(`Marking ${categorized.gone.length} listings as gone`);
      
      const now = new Date().toISOString();
      
      for (let i = 0; i < categorized.gone.length; i += BATCH_SIZE) {
        const batch = categorized.gone.slice(i, i + BATCH_SIZE);
        
        const { error } = await supabase
          .from('listings')
          .update({ status: 'gone', last_seen_at: now })
          .in('url', batch);

        if (error) {
          console.error('Error marking gone listings:', error);
          stats.errors++;
        } else {
          stats.gone += batch.length;
        }
      }
    }

    // ===== PHASE 4: Update last_seen_at for unchanged listings (0 credits!) =====
    if (categorized.unchanged.length > 0 && !safety.stopReason) {
      console.log(`Updating last_seen_at for ${categorized.unchanged.length} unchanged listings`);
      
      const now = new Date().toISOString();
      const unchangedUrls = categorized.unchanged.map(e => e.url);
      
      for (let i = 0; i < unchangedUrls.length; i += BATCH_SIZE) {
        const batch = unchangedUrls.slice(i, i + BATCH_SIZE);
        
        await supabase
          .from('listings')
          .update({ last_seen_at: now })
          .in('url', batch);
      }
    }

    // ===== PHASE 5: Scrape new and changed listings (with safety limits!) =====
    if (!safety.stopReason) {
      const toScrape = [...categorized.new, ...categorized.changed];
      const limitedToScrape = toScrape.slice(0, MAX_LISTINGS_PER_RUN);
      
      console.log(`Scraping ${limitedToScrape.length} listings (${categorized.new.length} new, ${categorized.changed.length} changed)`);

      for (const entry of limitedToScrape) {
        // Check safety before each scrape
        const safetyCheck = checkSafetyLimits(safety, safetyConfig);
        if (safetyCheck.shouldStop) {
          console.log(`Safety stop during scraping: ${safetyCheck.reason}`);
          safety.stopReason = safetyCheck.reason;
          break;
        }

        try {
          safety.totalProcessed++;
          console.log(`[${safety.totalProcessed}] Scraping: ${entry.url}`);
          
          const html = await scrapeWithFirecrawl(entry.url, firecrawlKey, safety);
          
          if (!html) {
            errorLog.push({
              timestamp: new Date().toISOString(),
              message: 'Failed to scrape listing page',
              url: entry.url,
            });
            stats.errors++;
            safety.failedParses++;
            await delay(DELAY_BETWEEN_REQUESTS_MS);
            continue;
          }

          const rawData = extractListingDetails(html, entry.url);
          if (!rawData) {
            errorLog.push({
              timestamp: new Date().toISOString(),
              message: 'Failed to parse listing page',
              url: entry.url,
            });
            stats.errors++;
            safety.failedParses++;
            await delay(DELAY_BETWEEN_REQUESTS_MS);
            continue;
          }

          // Validate essential fields
          if (!rawData.raw_title || !rawData.raw_price) {
            errorLog.push({
              timestamp: new Date().toISOString(),
              message: 'Missing essential fields (title or price)',
              url: entry.url,
            });
            safety.failedParses++;
            await delay(DELAY_BETWEEN_REQUESTS_MS);
            continue;
          }

          safety.successfulParses++;

          // Parse values
          const parsedPrice = safeParsePrice(rawData.raw_price);
          const parsedMileage = safeParseMileage(rawData.raw_mileage);
          const parsedYear = safeParseYear(rawData.raw_year);
          const parsedDoors = safeParseDoors(rawData.raw_doors);
          const { make, model } = extractMakeModel(rawData.raw_title);

          // Create content hash
          const hashInput = `${rawData.raw_title}|${rawData.raw_price || ''}|${rawData.raw_mileage || ''}|${rawData.raw_year || ''}|${rawData.dealer_name_raw || ''}`;
          const contentHash = await createContentHash(hashInput);

          // Generate enhanced vehicle fingerprint
          const vehicleFingerprint = await createContentHash(generateVehicleFingerprint({
            make,
            model,
            year: parsedYear,
            mileage: parsedMileage,
            dealer_city: rawData.dealer_city_raw,
            color: rawData.raw_color,
            doors: parsedDoors,
          }));

          const now = new Date().toISOString();

          // Check if listing exists
          const { data: existingListing } = await supabase
            .from('listings')
            .select('id, content_hash, price, mileage')
            .eq('url', entry.url)
            .maybeSingle();

          // Upsert raw_listings
          await supabase
            .from('raw_listings')
            .upsert({
              source: 'gaspedaal',
              url: entry.url,
              raw_title: rawData.raw_title,
              raw_price: rawData.raw_price,
              raw_mileage: rawData.raw_mileage,
              raw_year: rawData.raw_year,
              raw_specs: {
                fuel_type: rawData.raw_fuel_type,
                transmission: rawData.raw_transmission,
                body_type: rawData.raw_body_type,
                color: rawData.raw_color,
                doors: rawData.raw_doors,
                license_plate: rawData.raw_license_plate,
                options: rawData.raw_options,
              },
              dealer_name_raw: rawData.dealer_name_raw,
              dealer_city_raw: rawData.dealer_city_raw,
              dealer_page_url: rawData.dealer_page_url,
              content_hash: contentHash,
              last_seen_at: now,
              scraped_at: now,
            }, { 
              onConflict: 'source,url',
              ignoreDuplicates: false 
            });

          if (!existingListing) {
            // NEW LISTING
            const { data: newListing, error: insertError } = await supabase
              .from('listings')
              .insert({
                source: 'gaspedaal',
                url: entry.url,
                title: rawData.raw_title,
                make,
                model,
                price: parsedPrice,
                mileage: parsedMileage,
                year: parsedYear,
                fuel_type: rawData.raw_fuel_type,
                transmission: rawData.raw_transmission,
                body_type: rawData.raw_body_type,
                color: rawData.raw_color,
                doors: parsedDoors,
                license_plate: rawData.raw_license_plate,
                options_raw: rawData.raw_options,
                dealer_name: rawData.dealer_name_raw,
                dealer_city: rawData.dealer_city_raw,
                status: 'active',
                content_hash: contentHash,
                vehicle_fingerprint: vehicleFingerprint,
                sitemap_lastmod: entry.lastmod,
                first_seen_at: now,
                last_seen_at: now,
              })
              .select('id')
              .single();

            if (insertError) {
              console.error('Listing insert error:', insertError);
              stats.errors++;
            } else if (newListing) {
              stats.new++;

              // Create initial snapshot
              await supabase.from('listing_snapshots').insert({
                listing_id: newListing.id,
                price: parsedPrice,
                mileage: parsedMileage,
                status: 'active',
                price_changed: false,
                mileage_changed: false,
                status_changed: false,
                content_hash: contentHash,
              });
            }
          } else {
            // EXISTING LISTING - Update
            const contentChanged = existingListing.content_hash !== contentHash;

            const updateData: Record<string, unknown> = {
              last_seen_at: now,
              sitemap_lastmod: entry.lastmod,
              title: rawData.raw_title,
              make,
              model,
              price: parsedPrice,
              mileage: parsedMileage,
              year: parsedYear,
              fuel_type: rawData.raw_fuel_type,
              transmission: rawData.raw_transmission,
              body_type: rawData.raw_body_type,
              color: rawData.raw_color,
              doors: parsedDoors,
              license_plate: rawData.raw_license_plate,
              options_raw: rawData.raw_options,
              dealer_name: rawData.dealer_name_raw,
              dealer_city: rawData.dealer_city_raw,
              vehicle_fingerprint: vehicleFingerprint,
              status: 'active',
            };

            if (contentChanged) {
              updateData.content_hash = contentHash;
              updateData.previous_price = existingListing.price;
              stats.updated++;

              // Create snapshot on change
              const priceChanged = parsedPrice !== existingListing.price;
              const mileageChanged = parsedMileage !== existingListing.mileage;
              const priceDelta = (priceChanged && parsedPrice !== null && existingListing.price !== null)
                ? parsedPrice - existingListing.price
                : null;

              await supabase.from('listing_snapshots').insert({
                listing_id: existingListing.id,
                price: parsedPrice,
                mileage: parsedMileage,
                status: 'active',
                price_changed: priceChanged,
                mileage_changed: mileageChanged,
                status_changed: false,
                price_delta: priceDelta,
                content_hash: contentHash,
              });
            }

            await supabase
              .from('listings')
              .update(updateData)
              .eq('id', existingListing.id);
          }

          await delay(DELAY_BETWEEN_REQUESTS_MS);

        } catch (listingError) {
          console.error(`Error processing ${entry.url}:`, listingError);
          errorLog.push({
            timestamp: new Date().toISOString(),
            message: listingError instanceof Error ? listingError.message : 'Unknown error',
            url: entry.url,
          });
          stats.errors++;
          safety.errors++;
          await delay(DELAY_BETWEEN_REQUESTS_MS);
        }
      }
    }

    // ===== Update credit usage =====
    const totalCreditsThisJob = safety.sitemapRequests + safety.detailRequests;
    await updateDailyCreditUsage(
      supabase, 
      'gaspedaal', 
      safety.creditsUsedToday, // This includes credits from before + this job
      safety.sitemapRequests,
      safety.detailRequests
    );

    // ===== Calculate quality metrics =====
    const parseSuccessRate = safety.successfulParses + safety.failedParses > 0
      ? (safety.successfulParses / (safety.successfulParses + safety.failedParses)) * 100
      : null;
    
    const errorRate = safety.totalProcessed > 0
      ? (safety.errors / safety.totalProcessed) * 100
      : null;

    // ===== Update job record =====
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);

    await supabase
      .from('scraper_jobs')
      .update({
        status: safety.stopReason ? 'failed' : 'completed',
        completed_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
        pages_processed: stats.pages,
        listings_found: stats.found,
        listings_new: stats.new,
        listings_updated: stats.updated,
        listings_gone: stats.gone,
        errors_count: stats.errors,
        error_log: errorLog,
        credits_used: totalCreditsThisJob,
        sitemap_requests: safety.sitemapRequests,
        detail_requests: safety.detailRequests,
        parse_success_rate: parseSuccessRate,
        error_rate: errorRate,
        stop_reason: safety.stopReason,
      })
      .eq('id', jobId);

    console.log(`Job ${jobId} ${safety.stopReason ? 'stopped' : 'completed'}:`, {
      ...stats,
      creditsUsed: totalCreditsThisJob,
      parseSuccessRate: parseSuccessRate?.toFixed(1) + '%',
      errorRate: errorRate?.toFixed(1) + '%',
      stopReason: safety.stopReason,
    });

    return new Response(
      JSON.stringify({
        success: !safety.stopReason,
        jobId,
        stats: {
          pagesProcessed: stats.pages,
          listingsFound: stats.found,
          listingsNew: stats.new,
          listingsUpdated: stats.updated,
          listingsGone: stats.gone,
          errorsCount: stats.errors,
        },
        safety: {
          creditsUsed: totalCreditsThisJob,
          parseSuccessRate,
          errorRate,
          stopReason: safety.stopReason,
        },
        duration: durationSeconds,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Discovery job error:', error);
    
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { jobId } = await req.clone().json().catch(() => ({ jobId: null }));
      
      if (jobId) {
        await supabase
          .from('scraper_jobs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            duration_seconds: durationSeconds,
            errors_count: stats.errors + 1,
            error_log: [
              ...errorLog,
              {
                timestamp: new Date().toISOString(),
                message: error instanceof Error ? error.message : 'Unknown error',
              },
            ],
            credits_used: safety.sitemapRequests + safety.detailRequests,
            stop_reason: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', jobId);
      }
    } catch (updateError) {
      console.error('Failed to update job status:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stats,
        safety: {
          creditsUsed: safety.sitemapRequests + safety.detailRequests,
          stopReason: error instanceof Error ? error.message : 'Unknown error',
        },
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
