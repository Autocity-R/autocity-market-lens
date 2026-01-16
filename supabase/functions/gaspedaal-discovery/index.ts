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

// ===== TYPES =====
type JobMode = 'discovery' | 'lifecycle_check';
type ListingStatus = 'active' | 'gone_suspected' | 'sold_confirmed' | 'returned';

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
  powerPk: number | null;
  // Raw values for backup
  rawPrice?: string | null;
  rawYear?: string | null;
  rawMileage?: string | null;
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

// ===== HELPER: Vehicle Fingerprint (Fallback matching) =====
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
  html: string | null,
  contentHash: string,
  stats: JobStats
): Promise<string | null> {
  try {
    const now = new Date().toISOString();
    
    // Check if raw listing already exists by URL
    const { data: existing } = await supabase
      .from('raw_listings')
      .select('id, content_hash, consecutive_misses')
      .eq('url', listing.url)
      .maybeSingle();

    if (existing) {
      // Update existing raw listing
      await supabase
        .from('raw_listings')
        .update({
          content_hash: contentHash,
          last_seen_at: now,
          scraped_at: now,
          raw_title: listing.title,
          raw_price: listing.rawPrice || String(listing.price || ''),
          raw_year: listing.rawYear || String(listing.year || ''),
          raw_mileage: listing.rawMileage || String(listing.mileage || ''),
          raw_specs: {
            fuel_type: listing.fuelType,
            transmission: listing.transmission,
            body_type: listing.bodyType,
            color: listing.color,
            doors: listing.doors,
            power_pk: listing.powerPk,
            outbound_sources: listing.outboundSources,
          },
          dealer_name_raw: listing.dealerName,
          dealer_city_raw: listing.dealerCity,
          consecutive_misses: 0,
        })
        .eq('id', existing.id);
      
      return existing.id;
    } else {
      // Insert new raw listing
      const { data: newRaw, error } = await supabase
        .from('raw_listings')
        .insert({
          url: listing.url,
          source: 'gaspedaal',
          content_hash: contentHash,
          raw_title: listing.title,
          raw_price: listing.rawPrice || String(listing.price || ''),
          raw_year: listing.rawYear || String(listing.year || ''),
          raw_mileage: listing.rawMileage || String(listing.mileage || ''),
          raw_specs: {
            fuel_type: listing.fuelType,
            transmission: listing.transmission,
            body_type: listing.bodyType,
            color: listing.color,
            doors: listing.doors,
            power_pk: listing.powerPk,
            outbound_sources: listing.outboundSources,
          },
          dealer_name_raw: listing.dealerName,
          dealer_city_raw: listing.dealerCity,
          first_seen_at: now,
          last_seen_at: now,
          scraped_at: now,
        })
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
  
  // Match listing cards - looking for article or div elements with listing data
  // Gaspedaal uses structured listing cards with data attributes and nested elements
  const cardPatterns = [
    /<article[^>]*class="[^"]*listing[^"]*"[^>]*>([\s\S]*?)<\/article>/gi,
    /<div[^>]*class="[^"]*listing-card[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi,
    /<div[^>]*class="[^"]*result-item[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]*class="[^"]*result-item|$)/gi,
    /<a[^>]*href="(\/occasion\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
  ];

  // Try to find all listing URLs first
  const urlPattern = /href="(\/occasion\/[^"]+)"/gi;
  const foundUrls = new Set<string>();
  let match;
  
  while ((match = urlPattern.exec(html)) !== null) {
    const url = `https://www.gaspedaal.nl${match[1]}`;
    foundUrls.add(url);
  }

  // For each URL, try to extract surrounding card data
  for (const url of foundUrls) {
    const listing = extractListingFromHtml(html, url);
    if (listing) {
      listings.push(listing);
    }
  }

  console.log(`Parsed ${listings.length} listings from index page`);
  return listings;
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

    // Extract outbound sources (portals where listing appears)
    const outboundSources: string[] = [];
    const sourcePatterns = [
      /(autotrack|autoscout24|anwb|marktplaats|viabovag|autoweek|gaspedaal)/gi,
      /Bekijk\s+(?:deze\s+)?auto\s+op[^<]*?([^<]+)/i,
    ];
    
    // Look for portal mentions
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
      powerPk: safeParsePower(rawPower),
      // Keep raw values for backup
      rawPrice,
      rawYear,
      rawMileage,
    };
  } catch (error) {
    console.error(`Error extracting listing from HTML:`, error);
    return null;
  }
}

// ===== DETAIL PAGE: Extract additional data =====
function extractDetailPageData(html: string): {
  licensePlate: string | null;
  options: string | null;
  dealerPageUrl: string | null;
} {
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

  // Extract options
  let options: string | null = null;
  const optionsMatch = html.match(/uitrusting[^<]*?<[^>]*>([\s\S]{0,1000}?)<\/div>/i);
  if (optionsMatch && optionsMatch[1]) {
    options = optionsMatch[1]
      .replace(/<[^>]+>/g, ', ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 500);
  }

  // Extract dealer page URL
  let dealerPageUrl: string | null = null;
  const dealerLinkMatch = html.match(/href="(\/dealer\/[^"]+)"/i) ||
                          html.match(/href="(https:\/\/www\.gaspedaal\.nl\/dealer\/[^"]+)"/i);
  if (dealerLinkMatch) {
    dealerPageUrl = dealerLinkMatch[1].startsWith('/') 
      ? `https://www.gaspedaal.nl${dealerLinkMatch[1]}`
      : dealerLinkMatch[1];
  }

  return { licensePlate, options, dealerPageUrl };
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

// ===== DISCOVERY MODE: Main logic =====
async function runDiscoveryMode(
  supabase: any,
  firecrawlKey: string,
  safety: SafetyState,
  safetyConfig: SafetyConfig,
  stats: JobStats,
  errorLog: any[],
  maxPages: number,
  dryRun: boolean = false
): Promise<void> {
  console.log(`Starting discovery mode (max ${maxPages} pages, dryRun=${dryRun})`);
  
  for (let page = 1; page <= maxPages; page++) {
    // Check safety limits
    const safetyCheck = checkSafetyLimits(safety, safetyConfig);
    if (safetyCheck.shouldStop) {
      console.log(`Safety stop: ${safetyCheck.reason}`);
      safety.stopReason = safetyCheck.reason;
      break;
    }

    const indexUrl = buildIndexPageUrl(page);
    console.log(`[Page ${page}] Fetching: ${indexUrl}`);
    
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
      // Simulate finding some listings for testing
      stats.listingsFound += 20;
      continue;
    }
    
    // Parse listings from index page
    const listings = parseIndexPageListings(html);
    stats.listingsFound += listings.length;
    
    if (listings.length === 0) {
      console.log(`No more listings found on page ${page}, stopping`);
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
          console.log(`Skipping listing with unknown year/price (budget: ${(unknownPercent * 100).toFixed(1)}%)`);
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

      // Generate content hash
      const contentHash = await createContentHash(listing);
      
      // ===== CRITICAL: Save to raw_listings FIRST =====
      const rawListingId = await saveRawListing(supabase, listing, html, contentHash, stats);
      if (!rawListingId) {
        console.error(`Failed to save raw listing for ${listing.url}`);
        safety.failedParses++;
        continue;
      }
      
      console.log(`Saved raw listing ${rawListingId} for ${listing.url}`);

      // Check if listing exists in database
      const { data: existingListing } = await supabase
        .from('listings')
        .select('id, status, price, mileage, content_hash, first_seen_at, gone_detected_at, license_plate_hash, vehicle_fingerprint')
        .eq('url', listing.url)
        .maybeSingle();

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

      if (!existingListing) {
        // NEW LISTING - check if it's a return (false sale)
        const { data: matchByFingerprint } = await supabase
          .from('listings')
          .select('id, status, gone_detected_at, license_plate_hash')
          .eq('vehicle_fingerprint', fingerprint)
          .eq('status', 'gone_suspected')
          .maybeSingle();

        let isReturn = false;
        let returnedListingId: string | null = null;

        if (matchByFingerprint) {
          const daysSinceGone = daysSince(matchByFingerprint.gone_detected_at);
          if (daysSinceGone < SOLD_CONFIRMED_DAYS) {
            isReturn = true;
            returnedListingId = matchByFingerprint.id;
          }
        }

        if (isReturn && returnedListingId) {
          // RETURNED (false sale) - update existing listing
          await supabase
            .from('listings')
            .update({
              status: 'returned',
              url: listing.url,
              price: listing.price,
              mileage: listing.mileage,
              last_seen_at: now,
              content_hash: contentHash,
              raw_listing_id: rawListingId,
            })
            .eq('id', returnedListingId);

          await logVehicleEvent(supabase, returnedListingId, 'returned', {
            price: listing.price,
            isRealSale: false,
            reason: { matched_by: 'fingerprint', new_url: listing.url },
          });

          stats.listingsReturned++;
          safety.successfulParses++;
        } else {
          // Truly new listing - need detail page for license plate
          let licensePlateHash: string | null = null;
          let options: string | null = null;
          let dealerPageUrl: string | null = null;

          // Only scrape detail if we have budget
          const budgetCheck = checkSafetyLimits(safety, safetyConfig);
          if (!budgetCheck.shouldStop) {
            const detailHtml = await scrapeWithFirecrawl(listing.url, firecrawlKey, safety, false, dryRun);
            if (detailHtml) {
              const detailData = extractDetailPageData(detailHtml);
              licensePlateHash = await hashLicensePlate(detailData.licensePlate);
              options = detailData.options;
              dealerPageUrl = detailData.dealerPageUrl;
            }
            await delay(DELAY_BETWEEN_REQUESTS_MS);
          }

          // Calculate buckets
          const priceBucket = listing.price ? Math.floor(listing.price / 5000) * 5000 : null;
          const mileageBucket = listing.mileage ? Math.floor(listing.mileage / 5000) * 5000 : null;

          // Insert new listing with raw_listing_id link
          const { data: newListing, error: insertError } = await supabase
            .from('listings')
            .insert({
              url: listing.url,
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
              price_bucket: priceBucket,
              mileage_bucket: mileageBucket,
              outbound_sources: listing.outboundSources,
              options_raw: options,
              raw_listing_id: rawListingId,
            })
            .select('id')
            .single();

          if (insertError) {
            console.error('Error inserting listing:', insertError);
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
        }
      } else {
        // EXISTING LISTING - check for updates
        
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
              reason: { days_gone: daysSinceGone },
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
          // Just update last_seen_at
          await supabase
            .from('listings')
            .update({ last_seen_at: now, status: 'active' })
            .eq('id', existingListing.id);
        }

        safety.successfulParses++;
      }
    }

    await delay(DELAY_BETWEEN_REQUESTS_MS);
  }
}

// ===== LIFECYCLE CHECK MODE: Main logic =====
async function runLifecycleCheckMode(
  supabase: any,
  safety: SafetyState,
  stats: JobStats,
  targetMakes?: string[]
): Promise<void> {
  console.log(`Starting lifecycle check mode`);
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
    console.error('Error fetching stale listings:', staleError);
    return;
  }

  console.log(`Found ${staleListings?.length || 0} stale listings to mark as gone_suspected`);

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
    console.error('Error fetching old gone listings:', oldGoneError);
    return;
  }

  console.log(`Found ${oldGoneListings?.length || 0} listings to confirm as sold`);

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
    } = body;
    
    console.log(`Starting Gaspedaal ${mode} job ${jobId} (dryRun=${dryRun})`);
    console.log(`Config: maxPages=${maxPages}, maxCredits=${maxCredits}, targetMakes=${targetMakes.join(',') || 'all'}`);

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

    console.log('Safety config:', safetyConfig);

    // Get today's credit usage (skip in dry run)
    if (!dryRun) {
      safety.creditsUsedToday = await getTodayCreditUsage(supabase, 'gaspedaal');
      console.log(`Credits used today before job: ${safety.creditsUsedToday}`);

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
        dryRun
      );
    } else if (mode === 'lifecycle_check') {
      await runLifecycleCheckMode(
        supabase,
        safety,
        stats,
        targetMakes
      );
    }

    // Calculate duration
    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
    const parseSuccessRate = safety.totalProcessed > 0 
      ? safety.successfulParses / safety.totalProcessed 
      : 1;
    const errorRate = safety.totalProcessed > 0 
      ? safety.errors / safety.totalProcessed 
      : 0;

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
        stop_reason: dryRun ? 'dry_run_complete' : safety.stopReason,
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

    const result = {
      success: true,
      jobId,
      mode,
      dryRun,
      duration: durationSeconds,
      stats: {
        ...stats,
        creditsUsed: dryRun ? 0 : safety.creditsUsedThisRun,
        indexRequests: safety.indexRequests,
        detailRequests: safety.detailRequests,
        parseSuccessRate: (parseSuccessRate * 100).toFixed(1) + '%',
        errorRate: (errorRate * 100).toFixed(1) + '%',
        rawListingsSaved: stats.rawListingsSaved,
      },
      stopReason: dryRun ? 'dry_run_complete' : safety.stopReason,
    };

    console.log('Job completed:', JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Fatal error in gaspedaal-discovery:', error);

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
      // Ignore cleanup errors
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
