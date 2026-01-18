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
type DetailStatus = 'pending' | 'ok' | 'partial' | 'failed';

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
  outboundLinks: Array<{ source: string; url: string }>;
  powerPk: number | null;
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
  avgCompletenessScore: number;
  completenessScores: number[];
  missingFieldsCounts: Record<string, number>;
}

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

// ===== CANONICAL URL: Normalize Gaspedaal URLs =====
function canonicalizeGaspedaalUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove tracking params
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'origin', 'fbclid', 'gclid', 'msclkid'];
    trackingParams.forEach(p => urlObj.searchParams.delete(p));
    // Remove trailing slash
    let canonical = urlObj.toString().replace(/\/$/, '');
    // Normalize www
    canonical = canonical.replace('://gaspedaal.nl', '://www.gaspedaal.nl');
    return canonical;
  } catch {
    return url;
  }
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

// ===== HELPER: Vehicle Fingerprint (for non-dedup purposes only - logging) =====
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
  
  // 5000km buckets for robustness
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
  chosenDetailUrl: string | null
): Promise<string | null> {
  try {
    const now = new Date().toISOString();
    const canonicalUrl = canonicalizeGaspedaalUrl(listing.url);
    
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
    const html = data.data?.html || data.html || null;
    
    if (html) {
      console.log(`[FIRECRAWL] Success: ${url} (${html.length} bytes)`);
    } else {
      console.error(`[FIRECRAWL] No HTML returned for ${url}`);
    }
    
    return html;
  } catch (error) {
    console.error(`[FIRECRAWL] Fetch error for ${url}:`, error);
    safety.errors++;
    return null;
  }
}

// ===== SELECT BEST DETAIL URL (prioriteer dealersite) =====
function selectBestDetailUrl(
  gaspedaalUrl: string,
  outboundLinks: Array<{ source: string; url: string }>
): { url: string; source: string } {
  // Primary priority order: dealersite gets highest priority (most complete data)
  const primaryPriority = ['dealersite', 'autotrack', 'autoscout24', 'marktplaats', 'anwb'];
  
  for (const source of primaryPriority) {
    const link = outboundLinks.find(l => l.source === source);
    if (link && link.url) {
      return { url: link.url, source };
    }
  }
  
  // Secondary priority: additional portals
  const secondaryPriority = ['autowereld', 'autoweek', 'viabovag'];
  
  for (const source of secondaryPriority) {
    const link = outboundLinks.find(l => l.source === source);
    if (link && link.url) {
      return { url: link.url, source };
    }
  }
  
  // Last resort: use ANY available outbound link before falling back to Gaspedaal
  if (outboundLinks.length > 0) {
    const anyLink = outboundLinks.find(l => l.url && l.source !== 'gaspedaal');
    if (anyLink) {
      console.log(`[DETAIL] Using any available link: ${anyLink.source}`);
      return { url: anyLink.url, source: anyLink.source };
    }
  }
  
  // Ultimate fallback: Gaspedaal URL
  return { url: gaspedaalUrl, source: 'gaspedaal' };
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

// ===== INDEX PAGE: Parse listing cards =====
function parseIndexPageListings(html: string): IndexPageListing[] {
  const listings: IndexPageListing[] = [];
  
  // NEW APPROACH: Find listing cards by the isOccTitle class (title element)
  // Each listing has a <h2 class="isOccTitle ...">Title</h2>
  // We split the HTML into sections around each title
  
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
      // Filter out obvious non-listings (menu items, etc.)
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
    
    const listing = extractListingFromCardHtml(cardHtml, title, i);
    if (listing) {
      listings.push(listing);
    }
  }

  console.log(`[PARSE] Successfully parsed ${listings.length} listings from index page`);
  return listings;
}

// ===== INDEX PAGE: Extract listing from card HTML =====
function extractListingFromCardHtml(cardHtml: string, title: string, listingIndex: number): IndexPageListing | null {
  try {
    // Generate a unique URL for this listing based on the title (since /occasion/ URLs are not in HTML)
    // Format: normalize title to URL-friendly slug
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 80);
    const url = `https://www.gaspedaal.nl/occasion/${slug}-${listingIndex}`;
    
    // Extract price from data-testid="price" element or € symbol
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
    
    // Extract year (look for 4-digit year after Bouwjaar or in span elements)
    let rawYear: string | null = null;
    const yearPatterns = [
      />(\d{4})<\/span>/,  // Year in span
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
    
    // Extract mileage (look for number followed by km)
    let rawMileage: string | null = null;
    const mileagePatterns = [
      />(\d{1,3}(?:[.,]?\d{3})*)<[^>]*><!-- -->\s*<!-- -->km/i,
      />(\d+)<\/span>[^<]*km/i,
      /(\d{1,3}(?:[.,]?\d{3})*)\s*km/i,
    ];
    for (const pattern of mileagePatterns) {
      const match = cardHtml.match(pattern);
      if (match && match[1]) {
        rawMileage = match[1].replace(/[.,]/g, '');
        break;
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
    
    // Extract power (kW)
    let powerPk: number | null = null;
    const powerPatterns = [
      />(\d+)<[^>]*><!-- -->kW/i,
      />(\d+)\s*kW/i,
      /(\d+)\s*kW/i,
      />(\d+)<[^>]*><!-- -->pk/i,
      /(\d+)\s*pk/i,
    ];
    for (const pattern of powerPatterns) {
      const match = cardHtml.match(pattern);
      if (match && match[1]) {
        const value = parseInt(match[1], 10);
        if (pattern.source.includes('kW')) {
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
    const doorsMatch = cardHtml.match(/>(\d)<[^>]*><!-- -->-deurs/i) || cardHtml.match(/(\d)\s*-?\s*deurs/i);
    if (doorsMatch) {
      doors = parseInt(doorsMatch[1], 10);
    }
    
    // Extract engine CC
    let engineCc: number | null = null;
    const ccMatch = cardHtml.match(/>(\d+)<[^>]*><!-- -->cc/i) || cardHtml.match(/(\d+)\s*cc/i);
    if (ccMatch) {
      engineCc = parseInt(ccMatch[1], 10);
    }
    
    // Extract dealer info (look for pumpkin/orange colored text followed by city)
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
    
    // Extract outbound sources from "Bekijk deze auto op:" text
    const outboundSources: string[] = [];
    const outboundLinks: Array<{ source: string; url: string }> = [];
    
    const bekijkMatch = cardHtml.match(/Bekijk deze auto op:\s*([^<]+)/i);
    if (bekijkMatch) {
      const sources = bekijkMatch[1].split(',').map(s => s.trim().toLowerCase());
      for (const source of sources) {
        if (source.includes('dealersite')) outboundSources.push('dealersite');
        else if (source.includes('autotrack')) outboundSources.push('autotrack');
        else if (source.includes('autoscout24')) outboundSources.push('autoscout24');
        else if (source.includes('anwb')) outboundSources.push('anwb');
        else if (source.includes('marktplaats')) outboundSources.push('marktplaats');
        else if (source.includes('autowereld')) outboundSources.push('autowereld');
        else if (source.includes('viabovag')) outboundSources.push('viabovag');
        else if (source.length > 2) outboundSources.push(source);
      }
    }
    
    // Look for external links in card
    const linkPattern = /href="(https?:\/\/(?!www\.gaspedaal\.nl)[^"]+)"/gi;
    let linkMatch;
    while ((linkMatch = linkPattern.exec(cardHtml)) !== null) {
      const linkUrl = linkMatch[1];
      let source = 'other';
      if (linkUrl.includes('autotrack')) source = 'autotrack';
      else if (linkUrl.includes('autoscout24')) source = 'autoscout24';
      else if (linkUrl.includes('anwb.nl')) source = 'anwb';
      else if (linkUrl.includes('marktplaats')) source = 'marktplaats';
      else if (linkUrl.includes('autowereld')) source = 'autowereld';
      else source = 'dealersite';
      
      if (!outboundLinks.find(l => l.source === source)) {
        outboundLinks.push({ source, url: linkUrl });
        if (!outboundSources.includes(source)) {
          outboundSources.push(source);
        }
      }
    }
    
    // Create the listing object
    const listing: IndexPageListing = {
      url,
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
      rawPrice,
      rawYear,
      rawMileage,
    };
    
    // Log parsed data for debugging
    console.log(`[PARSE] Listing ${listingIndex}: ${title.substring(0, 40)}... | €${listing.price} | ${listing.year} | ${listing.mileage}km | ${listing.fuelType} | Dealer: ${dealerName}`);
    
    return listing;
  } catch (error) {
    console.error(`[PARSE] Error extracting listing: ${error}`);
    return null;
  }
}

// ===== INDEX PAGE: Extract single listing data =====
function extractListingFromHtml(html: string, url: string): IndexPageListing | null {
  try {
    // Find the section of HTML around this URL
    const urlPath = url.replace('https://www.gaspedaal.nl', '');
    const urlIndex = html.indexOf(urlPath);
    
    if (urlIndex === -1) return null;
    
    // Get a window of HTML around this URL (3000 chars before and after)
    const start = Math.max(0, urlIndex - 3000);
    const end = Math.min(html.length, urlIndex + 3000);
    const cardHtml = html.substring(start, end);
    
    // Extract title
    let title = '';
    const titlePatterns = [
      /class="[^"]*title[^"]*"[^>]*>([^<]+)</i,
      /class="[^"]*heading[^"]*"[^>]*>([^<]+)</i,
      /<h[23][^>]*>([^<]+)</i,
    ];
    for (const pattern of titlePatterns) {
      const match = cardHtml.match(pattern);
      if (match && match[1] && match[1].length > 5) {
        title = match[1].trim();
        break;
      }
    }
    
    if (!title) {
      // Try to extract from URL
      const urlMatch = urlPath.match(/\/occasion\/([^\/]+)/);
      if (urlMatch) {
        title = urlMatch[1].replace(/-/g, ' ');
      }
    }
    
    if (!title) return null;

    // Extract price (keep raw value for backup)
    let rawPrice: string | null = null;
    const pricePatterns = [
      /€\s*([\d.,]+)/,
      /class="[^"]*price[^"]*"[^>]*>([^<]+)</i,
      /data-price="(\d+)"/i,
    ];
    for (const pattern of pricePatterns) {
      const match = cardHtml.match(pattern);
      if (match) {
        rawPrice = match[1] || match[0];
        break;
      }
    }

    // Extract year (keep raw value for backup)
    let rawYear: string | null = null;
    const yearPatterns = [
      /(\d{2}[-\/])?(\d{4})/,
      /bouwjaar[^<]*?(\d{4})/i,
    ];
    for (const pattern of yearPatterns) {
      const match = cardHtml.match(pattern);
      if (match) {
        rawYear = match[2] || match[1] || match[0];
        break;
      }
    }

    // Extract mileage (keep raw value for backup)
    let rawMileage: string | null = null;
    const mileagePatterns = [
      /(\d{1,3}(?:[.,]\d{3})*)\s*km/i,
    ];
    for (const pattern of mileagePatterns) {
      const match = cardHtml.match(pattern);
      if (match) {
        rawMileage = match[1];
        break;
      }
    }

    // Extract fuel type
    let fuelType: string | null = null;
    const fuelPatterns = [
      /(benzine|diesel|elektrisch|hybride|plug-in|lpg|cng|waterstof)/i,
    ];
    for (const pattern of fuelPatterns) {
      const match = cardHtml.match(pattern);
      if (match) {
        fuelType = normalizeFuelType(match[1]);
        break;
      }
    }

    // Extract transmission
    let transmission: string | null = null;
    const transPatterns = [
      /(automaat|handgeschakeld|manueel|cvt|dsg)/i,
    ];
    for (const pattern of transPatterns) {
      const match = cardHtml.match(pattern);
      if (match) {
        transmission = normalizeTransmission(match[1]);
        break;
      }
    }

    // Extract body type
    let bodyType: string | null = null;
    const bodyPatterns = [
      /(hatchback|sedan|suv|stationwagon|stationwagen|mpv|cabrio|coup[eé]|terreinwagen)/i,
    ];
    for (const pattern of bodyPatterns) {
      const match = cardHtml.match(pattern);
      if (match) {
        bodyType = normalizeBodyType(match[1]);
        break;
      }
    }

    // Extract color
    let color: string | null = null;
    const colorPatterns = [
      /kleur[^<]*?([a-zë]+)/i,
      /(zwart|wit|grijs|zilver|blauw|rood|groen|geel|oranje|bruin|beige|paars)/i,
    ];
    for (const pattern of colorPatterns) {
      const match = cardHtml.match(pattern);
      if (match && match[1]) {
        color = match[1].toLowerCase();
        break;
      }
    }

    // Extract doors
    let rawDoors: string | null = null;
    const doorsMatch = cardHtml.match(/(\d)\s*-?\s*deurs/i);
    if (doorsMatch) {
      rawDoors = doorsMatch[1];
    }

    // Extract dealer info
    let dealerName: string | null = null;
    let dealerCity: string | null = null;
    
    const dealerPatterns = [
      /class="[^"]*dealer[^"]*"[^>]*>([^<]+)</i,
      /verkoper[^<]*?([^<]+)</i,
    ];
    for (const pattern of dealerPatterns) {
      const match = cardHtml.match(pattern);
      if (match && match[1] && match[1].length > 2) {
        dealerName = match[1].trim();
        break;
      }
    }

    const cityPatterns = [
      /\(([A-Z]{2})\)/,  // Match province codes like (GE), (NH)
      /([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s*\([A-Z]{2}\)/,  // City with province
    ];
    for (const pattern of cityPatterns) {
      const match = cardHtml.match(pattern);
      if (match && match[1]) {
        dealerCity = match[1].length === 2 ? null : match[1].trim();
        break;
      }
    }

    // Extract outbound sources and links (portals where listing appears)
    const outboundSources: string[] = [];
    const outboundLinks: Array<{ source: string; url: string }> = [];
    
    // Known portal domains to exclude when finding dealersite
    const knownPortalDomains = [
      'gaspedaal.nl',
      'autotrack.nl',
      'autoscout24.nl',
      'autoscout24.be',
      'anwb.nl',
      'marktplaats.nl',
      'autowereld.nl',
      'autoweek.nl',
      'viabovag.nl',
    ];
    
    // Helper to check if URL is a known portal
    const isKnownPortal = (url: string): boolean => {
      return knownPortalDomains.some(domain => url.includes(domain));
    };
    
    // Look for ALL external links in the card
    const allLinkPattern = /href="(https?:\/\/[^"]+)"/gi;
    let linkMatch;
    
    while ((linkMatch = allLinkPattern.exec(cardHtml)) !== null) {
      const linkUrl = linkMatch[1];
      
      // Skip internal gaspedaal links (occasion pages, etc.)
      if (linkUrl.includes('gaspedaal.nl/occasion') || linkUrl.includes('gaspedaal.nl/zoeken')) {
        continue;
      }
      
      // Determine source type
      let source = 'other';
      if (linkUrl.includes('autotrack')) {
        source = 'autotrack';
      } else if (linkUrl.includes('autoscout24')) {
        source = 'autoscout24';
      } else if (linkUrl.includes('anwb.nl')) {
        source = 'anwb';
      } else if (linkUrl.includes('marktplaats')) {
        source = 'marktplaats';
      } else if (linkUrl.includes('autowereld')) {
        source = 'autowereld';
      } else if (linkUrl.includes('autoweek')) {
        source = 'autoweek';
      } else if (linkUrl.includes('viabovag')) {
        source = 'viabovag';
      } else if (!isKnownPortal(linkUrl)) {
        // External link that's NOT a known portal = dealersite!
        source = 'dealersite';
      }
      
      // Add ALL external links (no 'unknown' skip anymore)
      if (!outboundSources.includes(source)) {
        outboundSources.push(source);
        outboundLinks.push({ source, url: linkUrl });
      }
    }
    
    // Also look for "dealersite" or "website" button/link patterns
    const dealersiteLinkPatterns = [
      /href="([^"]+)"[^>]*>[^<]*(?:dealersite|website|dealer)[^<]*<\/a>/gi,
      /data-dealer-url="([^"]+)"/gi,
      /class="[^"]*dealer[^"]*"[^>]*href="([^"]+)"/gi,
    ];
    
    for (const pattern of dealersiteLinkPatterns) {
      let dsMatch;
      while ((dsMatch = pattern.exec(cardHtml)) !== null) {
        const dsUrl = dsMatch[1];
        // Make sure it's a full URL and not a known portal
        if (dsUrl.startsWith('http') && !isKnownPortal(dsUrl)) {
          if (!outboundSources.includes('dealersite')) {
            outboundSources.push('dealersite');
            outboundLinks.push({ source: 'dealersite', url: dsUrl });
          }
        }
      }
    }
    
    // Also check for portal names without links (for source tracking)
    const portalMatch = cardHtml.match(/(?:Dealersite|AutoTrack|ANWB|AutoScout24|Marktplaats)/gi);
    if (portalMatch) {
      for (const portal of portalMatch) {
        const normalized = portal.toLowerCase();
        if (!outboundSources.includes(normalized)) {
          outboundSources.push(normalized);
        }
      }
    }

    // Extract power
    let rawPower: string | null = null;
    const powerMatch = cardHtml.match(/(\d+)\s*(?:pk|kw)/i);
    if (powerMatch) {
      rawPower = powerMatch[0];
    }

    return {
      url,
      title,
      price: safeParsePrice(rawPrice),
      year: safeParseYear(rawYear),
      mileage: safeParseMileage(rawMileage),
      fuelType,
      transmission,
      bodyType,
      color,
      doors: safeParseDoors(rawDoors),
      dealerName,
      dealerCity,
      outboundSources,
      outboundLinks,
      powerPk: safeParsePower(rawPower),
      // Keep raw values for backup
      rawPrice,
      rawYear,
      rawMileage,
    };
  } catch (error) {
    console.error(`[PARSE] Error extracting listing from HTML:`, error);
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
  
  // Find options section (multiple patterns)
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
      
      // Extract text without HTML tags
      optionsRawText = match[1]
        .replace(/<[^>]+>/g, '\n')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Extract individual options as list
      const listItems = match[1].match(/<li[^>]*>([^<]+)<\/li>/gi);
      if (listItems) {
        optionsRawList = listItems.map(item => 
          item.replace(/<[^>]+>/g, '').trim()
        ).filter(item => item.length > 0);
      } else {
        // Try splitting by common separators
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

  // ===== SPECS TABLE: ALLE KEY/VALUE PAIRS OPSLAAN =====
  const specsTableRaw: Record<string, string> = {};
  
  // Pattern 1: Table rows
  const tableRowPattern = /<tr[^>]*>[\s\S]*?<t[hd][^>]*>([^<]+)<\/t[hd]>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<\/tr>/gi;
  let tableMatch;
  while ((tableMatch = tableRowPattern.exec(html)) !== null) {
    const key = tableMatch[1].trim();
    const value = tableMatch[2].trim();
    if (key && value && key.length < 50 && value.length < 200) {
      specsTableRaw[key] = value;
    }
  }
  
  // Pattern 2: Definition lists
  const dlPattern = /<dt[^>]*>([^<]+)<\/dt>[\s\S]*?<dd[^>]*>([^<]+)<\/dd>/gi;
  while ((tableMatch = dlPattern.exec(html)) !== null) {
    const key = tableMatch[1].trim();
    const value = tableMatch[2].trim();
    if (key && value && key.length < 50 && value.length < 200) {
      specsTableRaw[key] = value;
    }
  }
  
  // Pattern 3: Spec divs with label/value
  const specDivPattern = /class="[^"]*(?:spec|kenmerk)[^"]*"[^>]*>[\s\S]*?<[^>]*class="[^"]*label[^"]*"[^>]*>([^<]+)<[\s\S]*?<[^>]*class="[^"]*value[^"]*"[^>]*>([^<]+)</gi;
  while ((tableMatch = specDivPattern.exec(html)) !== null) {
    const key = tableMatch[1].trim();
    const value = tableMatch[2].trim();
    if (key && value && key.length < 50 && value.length < 200) {
      specsTableRaw[key] = value;
    }
  }
  
  console.log(`[DETAIL] Specs table: ${Object.keys(specsTableRaw).length} key/value pairs`);

  // ===== ENGINE/EV SPECS EXTRAHEREN =====
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
    /motorinhoud[^<]*?(\d{3,4})/i,
  ];
  for (const pattern of ccPatterns) {
    const match = html.match(pattern);
    if (match) {
      let value = match[1];
      // Convert "2.0" liter to 2000cc
      if (value.includes('.') || value.includes(',')) {
        value = String(Math.round(parseFloat(value.replace(',', '.')) * 1000));
      }
      engineCc = parseInt(value, 10);
      if (!isNaN(engineCc)) break;
    }
  }
  
  // Battery capacity (kWh)
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
  
  // Electric range (km)
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
  
  // Main image
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
  
  // Count all images
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
    'Polestar', 'Genesis', 'MG', 'BYD', 'Lynk & Co', 'NIO', 'XPeng'
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

// ===== LOOKUP EXISTING LISTING: HARD IDENTITY ONLY =====
async function lookupExistingListing(
  supabase: any,
  listing: IndexPageListing,
  detailData: DetailPageData | null
): Promise<{ existingListing: any | null; matchType: string | null }> {
  const canonicalUrl = canonicalizeGaspedaalUrl(listing.url);
  
  // 1. Primary lookup: canonical URL
  const { data: byCanonicalUrl } = await supabase
    .from('listings')
    .select('id, status, price, mileage, content_hash, first_seen_at, gone_detected_at, license_plate_hash, vehicle_fingerprint, raw_listing_id, detail_status, detail_attempts, detail_scraped_at, canonical_url, vin_hash')
    .eq('canonical_url', canonicalUrl)
    .maybeSingle();
  
  if (byCanonicalUrl) {
    return { existingListing: byCanonicalUrl, matchType: 'canonical_url' };
  }
  
  // 2. Fallback: original URL (for backwards compatibility)
  const { data: byUrl } = await supabase
    .from('listings')
    .select('id, status, price, mileage, content_hash, first_seen_at, gone_detected_at, license_plate_hash, vehicle_fingerprint, raw_listing_id, detail_status, detail_attempts, detail_scraped_at, canonical_url, vin_hash')
    .eq('url', listing.url)
    .maybeSingle();
  
  if (byUrl) {
    return { existingListing: byUrl, matchType: 'url' };
  }
  
  // 3. Secondary lookup: license_plate_hash (only if detail data has plate)
  if (detailData?.licensePlate) {
    const plateHash = await hashLicensePlate(detailData.licensePlate);
    if (plateHash) {
      const { data: byPlate } = await supabase
        .from('listings')
        .select('id, status, price, mileage, content_hash, first_seen_at, gone_detected_at, license_plate_hash, vehicle_fingerprint, raw_listing_id, detail_status, detail_attempts, detail_scraped_at, canonical_url, url, vin_hash')
        .eq('license_plate_hash', plateHash)
        .maybeSingle();
      
      if (byPlate) {
        console.log(`[DEDUP] Found existing listing by license_plate_hash: ${byPlate.id} (old URL: ${byPlate.url?.substring(0, 50)}...)`);
        return { existingListing: byPlate, matchType: 'license_plate_hash' };
      }
    }
  }
  
  // 4. Tertiary lookup: vin_hash (only if detail data has VIN)
  if (detailData?.vin) {
    const vinHash = await hashVin(detailData.vin);
    if (vinHash) {
      const { data: byVin } = await supabase
        .from('listings')
        .select('id, status, price, mileage, content_hash, first_seen_at, gone_detected_at, license_plate_hash, vehicle_fingerprint, raw_listing_id, detail_status, detail_attempts, detail_scraped_at, canonical_url, url, vin_hash')
        .eq('vin_hash', vinHash)
        .maybeSingle();
      
      if (byVin) {
        console.log(`[DEDUP] Found existing listing by vin_hash: ${byVin.id}`);
        return { existingListing: byVin, matchType: 'vin_hash' };
      }
    }
  }
  
  // NO SOFT MATCHING - if no hard ID match, it's a new listing
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
    .select('id, url, canonical_url, outbound_links, detail_attempts, detail_scraped_at, detail_status, chosen_detail_source')
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
    // Check safety limits
    const safetyCheck = checkSafetyLimits(safety, safetyConfig);
    if (safetyCheck.shouldStop) {
      console.log(`[HEALING] Stopping: ${safetyCheck.reason}`);
      break;
    }
    
    console.log(`[HEALING] Processing listing ${candidate.id} (attempt ${candidate.detail_attempts + 1}/${HEALING_MAX_RETRIES})`);
    
    // Select best URL for detail scrape
    const outboundLinks = candidate.outbound_links || [];
    const bestUrl = selectBestDetailUrl(candidate.url, outboundLinks);
    
    // Scrape detail page
    const detailHtml = await scrapeWithFirecrawl(bestUrl.url, firecrawlKey, safety, false, dryRun);
    stats.detailAttempted++;
    
    if (!detailHtml) {
      // Failed to scrape - update attempts and error
      await supabase
        .from('listings')
        .update({
          detail_attempts: candidate.detail_attempts + 1,
          last_detail_error: `Failed to scrape ${bestUrl.source}: No HTML returned`,
          detail_scraped_at: new Date().toISOString(),
        })
        .eq('id', candidate.id);
      stats.detailFailed++;
      await delay(DELAY_BETWEEN_REQUESTS_MS);
      continue;
    }
    
    // Extract detail data
    const detailData = extractDetailPageData(detailHtml);
    const completeness = calculateCompletenessScore(detailData, {} as IndexPageListing);
    
    // Update listing with new detail data
    const updateData: Record<string, any> = {
      detail_attempts: candidate.detail_attempts + 1,
      detail_scraped_at: new Date().toISOString(),
      detail_status: completeness.status,
      detail_completeness_score: completeness.score,
      chosen_detail_source: bestUrl.source,
      chosen_detail_url: bestUrl.url,
      needs_detail_rescrape: completeness.status !== 'ok',
      last_detail_error: completeness.status !== 'ok' 
        ? `Missing fields: ${completeness.missingFields.join(', ')}` 
        : null,
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
      
      // Update license plate hash if found
      if (detailData.licensePlate) {
        updateData.license_plate_hash = await hashLicensePlate(detailData.licensePlate);
      }
      
      // Update VIN hash if found
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
    
    // Track missing fields
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
    // Check safety limits
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
    
    // In dry run mode with simulated HTML, we can't parse real listings
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

      // Pre-filter: year >= 2014 and price >= 2000
      if (listing.year !== null && listing.year < MIN_YEAR) {
        continue;
      }
      if (listing.price !== null && listing.price < MIN_PRICE) {
        continue;
      }

      // Generate content hash and canonical URL
      const contentHash = await createContentHash(listing);
      const canonicalUrl = canonicalizeGaspedaalUrl(listing.url);
      
      const { make, model } = extractMakeModel(listing.title);
      const fingerprint = generateVehicleFingerprint({
        make,
        model,
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
      
      // First, do a preliminary lookup without detail data
      const { existingListing: preliminaryLookup, matchType: preliminaryMatchType } = await lookupExistingListing(supabase, listing, null);
      const isNewListing = !preliminaryLookup;
      
      if (indexOnly) {
        // INDEX ONLY MODE: Skip detail page scraping
        if (isNewListing) {
          stats.skippedIndexOnly++;
          console.log(`[INDEX ONLY] Skipping detail page for new listing: ${listing.url}`);
        }
      } else if (isNewListing) {
        // NEW LISTING: Scrape detail page - prioritize dealersite if available
        const budgetCheck = checkSafetyLimits(safety, safetyConfig);
        if (!budgetCheck.shouldStop) {
          // Select best URL: dealersite > autotrack > autoscout24 > marktplaats > anwb > gaspedaal
          const bestUrl = selectBestDetailUrl(listing.url, listing.outboundLinks);
          chosenDetailSource = bestUrl.source;
          chosenDetailUrl = bestUrl.url;
          console.log(`[DETAIL] Selected source: ${bestUrl.source} -> ${bestUrl.url.substring(0, 80)}...`);
          
          stats.detailAttempted++;
          detailHtml = await scrapeWithFirecrawl(bestUrl.url, firecrawlKey, safety, false, dryRun);
          if (detailHtml) {
            detailData = extractDetailPageData(detailHtml);
            console.log(`[DETAIL] Extracted ${detailData.optionsRawList?.length || 0} options from ${bestUrl.source}`);
          } else if (bestUrl.source !== 'gaspedaal') {
            // Fallback to Gaspedaal if dealersite/portal scrape failed
            console.log(`[DETAIL] ${bestUrl.source} failed, falling back to Gaspedaal...`);
            chosenDetailSource = 'gaspedaal';
            chosenDetailUrl = listing.url;
            detailHtml = await scrapeWithFirecrawl(listing.url, firecrawlKey, safety, false, dryRun);
            if (detailHtml) {
              detailData = extractDetailPageData(detailHtml);
            }
          }
          await delay(DELAY_BETWEEN_REQUESTS_MS);
        }
      }

      // Now do final lookup with detail data (might find by plate/VIN)
      const { existingListing, matchType } = await lookupExistingListing(supabase, listing, detailData);

      // ===== SAVE TO raw_listings (ALWAYS - with or without detail) =====
      const rawListingId = await saveRawListing(
        supabase, 
        listing, 
        detailData, 
        detailHtml, 
        contentHash, 
        stats,
        safety,
        chosenDetailSource,
        chosenDetailUrl
      );
      
      if (!rawListingId) {
        console.error(`[ERROR] Failed to save raw listing for ${listing.url}`);
        safety.failedParses++;
        continue;
      }
      
      console.log(`[RAW] Saved raw listing ${rawListingId} for ${listing.url}`);

      // Calculate completeness score if detail data was scraped
      let completeness: CompletenessResult = { score: 0, status: 'pending', missingFields: [] };
      if (detailData) {
        completeness = calculateCompletenessScore(detailData, listing);
        stats.completenessScores.push(completeness.score);
        
        // Track missing fields
        for (const field of completeness.missingFields) {
          stats.missingFieldsCounts[field] = (stats.missingFieldsCounts[field] || 0) + 1;
        }
        
        // Update detail stats
        if (completeness.status === 'ok') stats.detailOk++;
        else if (completeness.status === 'partial') stats.detailPartial++;
        else if (completeness.status === 'failed') stats.detailFailed++;
      }

      if (!existingListing) {
        // TRULY NEW LISTING - no hard ID match found
        const licensePlateHash = detailData?.licensePlate 
          ? await hashLicensePlate(detailData.licensePlate) 
          : null;
        const vinHash = detailData?.vin
          ? await hashVin(detailData.vin)
          : null;

        // Calculate buckets
        const priceBucket = listing.price ? Math.floor(listing.price / 5000) * 5000 : null;
        const mileageBucket = listing.mileage ? Math.floor(listing.mileage / 5000) * 5000 : null;

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
          detail_status: detailData ? completeness.status : 'pending',
          detail_completeness_score: completeness.score,
          detail_attempts: detailData ? 1 : 0,
          detail_scraped_at: detailData ? now : null,
          needs_detail_rescrape: detailData ? (completeness.status !== 'ok') : true,
          last_detail_error: completeness.status !== 'ok' && completeness.missingFields.length > 0
            ? `Missing: ${completeness.missingFields.join(', ')}`
            : null,
          chosen_detail_source: chosenDetailSource,
          chosen_detail_url: chosenDetailUrl,
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

          // Log creation event
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
        
        // Handle returned listings (was gone_suspected, now seen again)
        if (existingListing.status === 'gone_suspected') {
          const daysSinceGone = daysSince(existingListing.gone_detected_at);
          
          if (daysSinceGone < SOLD_CONFIRMED_DAYS) {
            // RETURNED (false sale)
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
            })
            .eq('id', existingListing.id);

          // Log price change event
          await logVehicleEvent(supabase, existingListing.id, 'price_changed', {
            price: listing.price,
            reason: { previous_price: existingListing.price },
          });

          // Create snapshot
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
          // Just update last_seen_at and ensure canonical URL is set
          await supabase
            .from('listings')
            .update({ 
              last_seen_at: now, 
              status: 'active',
              canonical_url: canonicalUrl,
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

  // 1. Find listings not seen in > GONE_SUSPECTED_DAYS days and still active
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

  // Mark stale listings as gone_suspected
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

  // 2. Confirm sales for listings gone > SOLD_CONFIRMED_DAYS days
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
    // Detail stats
    detailAttempted: 0,
    detailOk: 0,
    detailPartial: 0,
    detailFailed: 0,
    detailHealed: 0,
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
    
    console.log(`[START] Gaspedaal ${mode} job ${jobId}`);
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

    // Get safety config from database
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

    // Get today's credit usage (skip in dry run)
    if (!dryRun) {
      safety.creditsUsedToday = await getTodayCreditUsage(supabase, 'gaspedaal');
      console.log(`[CREDITS] Used today before job: ${safety.creditsUsedToday}`);

      // Pre-flight budget check
      if (safety.creditsUsedToday >= safetyConfig.maxCreditsPerDay) {
        throw new Error(`Daily credit budget already reached (${safety.creditsUsedToday}/${safetyConfig.maxCreditsPerDay})`);
      }
    }

    // Update job status to running
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
    
    // Calculate average completeness score
    if (stats.completenessScores.length > 0) {
      stats.avgCompletenessScore = Math.round(
        stats.completenessScores.reduce((a, b) => a + b, 0) / stats.completenessScores.length
      );
    }

    // Determine stop reason
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

    // Update daily credit usage (skip in dry run)
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
        // Detail stats
        detailStats: {
          attempted: stats.detailAttempted,
          ok: stats.detailOk,
          partial: stats.detailPartial,
          failed: stats.detailFailed,
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

    // Try to update job as failed
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
