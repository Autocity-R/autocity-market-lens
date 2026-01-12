import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// User-Agent for respectful scraping
const USER_AGENT = 'AutocityMarketIntelBot/0.1 (contact: info@auto-city.nl)';
const DELAY_MS = 1500;
const MAX_LISTINGS_PER_RUN = 100;

// ===== HELPER: SHA-256 Content Hash =====
async function createContentHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ===== HELPER: Safe Parse Functions =====
function safeParsePrice(raw: string | null): number | null {
  if (!raw) return null;
  // "€ 24.950", "€24.950,-", "Prijs op aanvraag" → 24950 or null
  const cleaned = raw.replace(/[^\d]/g, '');
  const value = parseInt(cleaned, 10);
  return isNaN(value) ? null : value;
}

function safeParseMileage(raw: string | null): number | null {
  if (!raw) return null;
  // "45.000 km", "N.v.t.", "-" → 45000 or null
  const cleaned = raw.replace(/[^\d]/g, '');
  const value = parseInt(cleaned, 10);
  return isNaN(value) ? null : value;
}

function safeParseYear(raw: string | null): number | null {
  if (!raw) return null;
  // "2021", "01-2021", "07/2022" → last 4 digits
  const match = raw.match(/\d{4}/);
  return match ? parseInt(match[0], 10) : null;
}

// ===== HELPER: Delay =====
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== HELPER: Fetch with error handling =====
async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
      },
    });
    
    if (!response.ok) {
      console.error(`Fetch failed for ${url}: ${response.status}`);
      return null;
    }
    
    return await response.text();
  } catch (error) {
    console.error(`Fetch error for ${url}:`, error);
    return null;
  }
}

// ===== PHASE 1: Extract listing URLs from search page =====
function extractListingUrls(html: string): string[] {
  const urls: string[] = [];
  
  // Pattern for Gaspedaal listing URLs
  // Gaspedaal uses links like /occasion/12345678 or full URLs
  const patterns = [
    /href="(\/occasion\/\d+[^"]*?)"/gi,
    /href="(https:\/\/www\.gaspedaal\.nl\/occasion\/\d+[^"]*?)"/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      let url = match[1];
      if (url.startsWith('/')) {
        url = `https://www.gaspedaal.nl${url}`;
      }
      // Dedupe
      if (!urls.includes(url)) {
        urls.push(url);
      }
    }
  }
  
  console.log(`Extracted ${urls.length} listing URLs from search page`);
  return urls;
}

// ===== PHASE 2: Extract listing details from detail page =====
interface RawListingData {
  url: string;
  raw_title: string;
  raw_price: string | null;
  raw_mileage: string | null;
  raw_year: string | null;
  dealer_name_raw: string | null;
  dealer_city_raw: string | null;
  dealer_page_url: string | null;
}

function extractListingDetails(html: string, url: string): RawListingData | null {
  try {
    // Extract title - look for h1 or title patterns
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
    
    // Extract price - look for price patterns
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
      /[^\d](\d{4})[^\d]/,
    ];
    for (const pattern of yearPatterns) {
      const match = html.match(pattern);
      if (match) {
        rawYear = match[1] || match[0];
        break;
      }
    }
    
    // Extract dealer info
    let dealerNameRaw: string | null = null;
    let dealerCityRaw: string | null = null;
    let dealerPageUrl: string | null = null;
    
    // Look for dealer section
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
    
    // Try to extract city
    const cityPatterns = [
      /plaats[^<]*?<[^>]*>([^<]+)</i,
      /locatie[^<]*?<[^>]*>([^<]+)</i,
      /(\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\s*$/,
    ];
    for (const pattern of cityPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        dealerCityRaw = match[1].trim();
        break;
      }
    }
    
    // Look for dealer page link
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
      dealer_name_raw: dealerNameRaw,
      dealer_city_raw: dealerCityRaw,
      dealer_page_url: dealerPageUrl,
    };
  } catch (error) {
    console.error(`Error extracting details from ${url}:`, error);
    return null;
  }
}

// ===== MAIN HANDLER =====
serve(async (req) => {
  // Handle CORS preflight
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
    errors: 0,
  };

  try {
    const { jobId, maxPages = 3 } = await req.json();
    
    console.log(`Starting Gaspedaal discovery job ${jobId} with maxPages=${maxPages}`);
    
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // ===== PHASE 1: Fetch search pages and collect URLs =====
    const allListingUrls: string[] = [];
    
    for (let page = 1; page <= maxPages; page++) {
      // Gaspedaal search URL sorted by newest
      const searchUrl = `https://www.gaspedaal.nl/zoeken?sort=date-desc&page=${page}`;
      console.log(`Fetching search page ${page}: ${searchUrl}`);
      
      const html = await fetchPage(searchUrl);
      if (!html) {
        errorLog.push({
          timestamp: new Date().toISOString(),
          message: `Failed to fetch search page ${page}`,
          url: searchUrl,
        });
        stats.errors++;
        continue;
      }
      
      const urls = extractListingUrls(html);
      allListingUrls.push(...urls);
      stats.pages++;
      
      // Rate limiting
      await delay(DELAY_MS);
      
      // Stop if we have enough URLs
      if (allListingUrls.length >= MAX_LISTINGS_PER_RUN) {
        console.log(`Reached max listings limit (${MAX_LISTINGS_PER_RUN})`);
        break;
      }
    }
    
    // Limit to max listings
    const urlsToProcess = allListingUrls.slice(0, MAX_LISTINGS_PER_RUN);
    console.log(`Processing ${urlsToProcess.length} listings`);
    
    // ===== PHASE 2: Fetch detail pages and process listings =====
    for (const listingUrl of urlsToProcess) {
      try {
        console.log(`Fetching listing: ${listingUrl}`);
        const html = await fetchPage(listingUrl);
        
        if (!html) {
          errorLog.push({
            timestamp: new Date().toISOString(),
            message: `Failed to fetch listing page`,
            url: listingUrl,
          });
          stats.errors++;
          await delay(DELAY_MS);
          continue;
        }
        
        const rawData = extractListingDetails(html, listingUrl);
        if (!rawData) {
          errorLog.push({
            timestamp: new Date().toISOString(),
            message: `Failed to parse listing page`,
            url: listingUrl,
          });
          stats.errors++;
          await delay(DELAY_MS);
          continue;
        }
        
        stats.found++;
        
        // Create content hash (SHA-256)
        const hashInput = `${rawData.raw_title}|${rawData.raw_price || ''}|${rawData.raw_mileage || ''}|${rawData.raw_year || ''}|${rawData.dealer_name_raw || ''}`;
        const contentHash = await createContentHash(hashInput);
        
        const now = new Date().toISOString();
        
        // ===== Upsert raw_listings =====
        const { error: rawError } = await supabase
          .from('raw_listings')
          .upsert({
            source: 'gaspedaal',
            url: listingUrl,
            raw_title: rawData.raw_title,
            raw_price: rawData.raw_price,
            raw_mileage: rawData.raw_mileage,
            raw_year: rawData.raw_year,
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
        
        if (rawError) {
          console.error('Raw listing upsert error:', rawError);
          stats.errors++;
        }
        
        // ===== Check if listing exists =====
        const { data: existingListing } = await supabase
          .from('listings')
          .select('id, content_hash, price, mileage')
          .eq('url', listingUrl)
          .maybeSingle();
        
        // Parse values
        const parsedPrice = safeParsePrice(rawData.raw_price);
        const parsedMileage = safeParseMileage(rawData.raw_mileage);
        const parsedYear = safeParseYear(rawData.raw_year);
        
        if (!existingListing) {
          // ===== NEW LISTING =====
          const { data: newListing, error: insertError } = await supabase
            .from('listings')
            .insert({
              source: 'gaspedaal',
              url: listingUrl,
              title: rawData.raw_title,
              price: parsedPrice,
              mileage: parsedMileage,
              year: parsedYear,
              dealer_name: rawData.dealer_name_raw,
              dealer_city: rawData.dealer_city_raw,
              status: 'active',
              content_hash: contentHash,
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
          // ===== EXISTING LISTING - Always update last_seen_at =====
          const updateData: Record<string, unknown> = {
            last_seen_at: now,
            title: rawData.raw_title,
            price: parsedPrice,
            mileage: parsedMileage,
            year: parsedYear,
            dealer_name: rawData.dealer_name_raw,
            dealer_city: rawData.dealer_city_raw,
          };
          
          // Check if content changed
          const contentChanged = existingListing.content_hash !== contentHash;
          
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
        
        // Rate limiting
        await delay(DELAY_MS);
        
      } catch (listingError) {
        console.error(`Error processing ${listingUrl}:`, listingError);
        errorLog.push({
          timestamp: new Date().toISOString(),
          message: listingError instanceof Error ? listingError.message : 'Unknown error',
          url: listingUrl,
        });
        stats.errors++;
        await delay(DELAY_MS);
      }
    }
    
    // ===== Update job record =====
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    
    await supabase
      .from('scraper_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
        pages_processed: stats.pages,
        listings_found: stats.found,
        listings_new: stats.new,
        listings_updated: stats.updated,
        errors_count: stats.errors,
        error_log: errorLog,
      })
      .eq('id', jobId);
    
    console.log(`Job ${jobId} completed:`, stats);
    
    return new Response(
      JSON.stringify({
        success: true,
        jobId,
        stats: {
          pagesProcessed: stats.pages,
          listingsFound: stats.found,
          listingsNew: stats.new,
          listingsUpdated: stats.updated,
          errorsCount: stats.errors,
        },
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
    
  } catch (error) {
    console.error('Fatal error in gaspedaal-discovery:', error);
    
    // Try to update job as failed
    try {
      const { jobId } = await req.json().catch(() => ({ jobId: null }));
      if (jobId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        await supabase
          .from('scraper_jobs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            duration_seconds: Math.round((Date.now() - startTime) / 1000),
            errors_count: stats.errors + 1,
            error_log: [...errorLog, {
              timestamp: new Date().toISOString(),
              message: error instanceof Error ? error.message : 'Fatal error',
            }],
          })
          .eq('id', jobId);
      }
    } catch {
      // Ignore update errors
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
