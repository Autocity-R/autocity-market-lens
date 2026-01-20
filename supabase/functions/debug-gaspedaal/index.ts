import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ===== REDIRECT API PATTERNS TO TEST =====
const REDIRECT_PATTERNS = [
  // ===== OPENAI SUGGESTED PATTERNS (PRIORITY!) =====
  { name: 'proxy_redirect_dealersite', template: 'https://www.gaspedaal.nl/api/proxy/redirect/vehicle/{occasionId}?app_source=react&portals_amount=1&portals_dealersite=1' },
  { name: 'proxy_redirect_autotrack', template: 'https://www.gaspedaal.nl/api/proxy/redirect/vehicle/{occasionId}?app_source=react&portals_amount=1&portals_autotrack=1' },
  { name: 'proxy_redirect_autoscout24', template: 'https://www.gaspedaal.nl/api/proxy/redirect/vehicle/{occasionId}?app_source=react&portals_amount=1&portals_autoscout24=1' },
  { name: 'proxy_redirect_anwb', template: 'https://www.gaspedaal.nl/api/proxy/redirect/vehicle/{occasionId}?app_source=react&portals_amount=1&portals_anwb=1' },
  { name: 'proxy_redirect_marktplaats', template: 'https://www.gaspedaal.nl/api/proxy/redirect/vehicle/{occasionId}?app_source=react&portals_amount=1&portals_marktplaats=1' },
  
  // Pattern A: API redirect endpoints (original)
  { name: 'api_redirect', template: 'https://www.gaspedaal.nl/api/redirect/{occasionId}?source={source}' },
  { name: 'api_occasion_redirect', template: 'https://www.gaspedaal.nl/api/occasion/{occasionId}/redirect?type={source}' },
  { name: 'api_gaspedaal', template: 'https://api.gaspedaal.nl/redirect/vehicle/{occasionId}' },
  
  // Pattern B: Click-through URLs
  { name: 'out_source', template: 'https://www.gaspedaal.nl/out/{occasionId}/{source}' },
  { name: 'click', template: 'https://www.gaspedaal.nl/click/{occasionId}?source={source}' },
  { name: 'goto', template: 'https://www.gaspedaal.nl/goto/{occasionId}?source={source}' },
  
  // Pattern C: Occasion page redirect
  { name: 'occasion_redirect', template: 'https://www.gaspedaal.nl/occasion/{occasionId}/redirect' },
  { name: 'occasion_out', template: 'https://www.gaspedaal.nl/occasion/{occasionId}/out?source={source}' },
  
  // Pattern D: Direct API
  { name: 'v1_api', template: 'https://api.gaspedaal.nl/v1/occasions/{occasionId}' },
  { name: 'v1_outbound', template: 'https://api.gaspedaal.nl/v1/occasions/{occasionId}/outbound' },
];

const SOURCES_TO_TEST = ['dealersite', 'autotrack', 'autoscout24', 'anwb', 'marktplaats'];

// ===== COOKIE HANDSHAKE (OpenAI suggestion) =====
async function getGaspedaalCookieJar(): Promise<{ cookies: string | null; headers: Record<string, string> }> {
  console.log('[COOKIE] Fetching Gaspedaal homepage for cookies...');
  try {
    const res = await fetch('https://www.gaspedaal.nl/', {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
      },
    });
    
    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    
    // Get set-cookie headers - Deno style
    const setCookieHeader = res.headers.get('set-cookie');
    let cookies: string | null = null;
    
    if (setCookieHeader) {
      // Parse multiple cookies from set-cookie header
      cookies = setCookieHeader
        .split(',')
        .map(c => c.split(';')[0].trim())
        .filter(c => c.length > 0)
        .join('; ');
    }
    
    console.log(`[COOKIE] Got cookies: ${cookies ? 'YES' : 'NO'}, length: ${cookies?.length || 0}`);
    console.log(`[COOKIE] Response headers: ${JSON.stringify(Object.keys(responseHeaders))}`);
    
    return { cookies, headers: responseHeaders };
  } catch (error) {
    console.error('[COOKIE] Error fetching cookies:', error);
    return { cookies: null, headers: {} };
  }
}

// ===== OPENAI REDIRECT RESOLVER (with cookies) =====
async function resolveExternalDetailUrl(
  vehicleId: string,
  cookieJar: string | null,
  portalSource: string = 'dealersite'
): Promise<{ 
  url: string | null; 
  source: string; 
  status: number; 
  debug: Record<string, unknown>;
}> {
  // Build the OpenAI-suggested proxy URL
  const redirectUrl = `https://www.gaspedaal.nl/api/proxy/redirect/vehicle/${vehicleId}?app_source=react&portals_amount=1&portals_${portalSource}=1`;
  
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
    'Referer': 'https://www.gaspedaal.nl/',
    'Origin': 'https://www.gaspedaal.nl',
    'X-Requested-With': 'XMLHttpRequest',
  };
  
  if (cookieJar) {
    headers['Cookie'] = cookieJar;
  }
  
  console.log(`[REDIRECT] vehicleId=${vehicleId}, portal=${portalSource}`);
  console.log(`[REDIRECT] URL: ${redirectUrl}`);
  console.log(`[REDIRECT] Using cookies: ${cookieJar ? 'YES' : 'NO'}`);
  
  try {
    // Use redirect: 'manual' to capture Location header
    const res = await fetch(redirectUrl, {
      method: 'GET',
      redirect: 'manual',
      headers,
    });
    
    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    
    console.log(`[REDIRECT] Status: ${res.status}`);
    
    // Check for redirect (301/302/303/307/308)
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      console.log(`[REDIRECT] SUCCESS! Location: ${location}`);
      
      if (location && !location.includes('gaspedaal.nl')) {
        const detectedSource = detectLinkSourceInternal(location);
        return {
          url: location,
          source: detectedSource,
          status: res.status,
          debug: { redirectUrl, responseHeaders, method: 'redirect_header' }
        };
      }
    }
    
    // If 200, check body for JSON with URL
    if (res.status === 200) {
      const text = await res.text();
      console.log(`[REDIRECT] 200 response, body length: ${text.length}`);
      console.log(`[REDIRECT] Body preview: ${text.substring(0, 300)}`);
      
      if (text.startsWith('{') || text.startsWith('[')) {
        try {
          const json = JSON.parse(text);
          const url = json.url || json.redirect || json.location || json.redirectUrl || json.external_url;
          if (url && !url.includes('gaspedaal.nl')) {
            const detectedSource = detectLinkSourceInternal(url);
            console.log(`[REDIRECT] Found URL in JSON: ${url}`);
            return {
              url,
              source: detectedSource,
              status: res.status,
              debug: { redirectUrl, responseHeaders, method: 'json_body', jsonKeys: Object.keys(json) }
            };
          }
        } catch (e) {
          console.log(`[REDIRECT] JSON parse failed: ${e}`);
        }
      }
      
      return {
        url: null,
        source: portalSource,
        status: res.status,
        debug: { redirectUrl, responseHeaders, bodyPreview: text.substring(0, 500), method: 'no_url_found' }
      };
    }
    
    // 403 or other error
    let bodyPreview = '';
    try {
      bodyPreview = await res.text();
      bodyPreview = bodyPreview.substring(0, 500);
    } catch {}
    
    console.error(`[REDIRECT] Failed with status ${res.status}`);
    console.error(`[REDIRECT] Response headers: ${JSON.stringify(responseHeaders)}`);
    console.error(`[REDIRECT] Body preview: ${bodyPreview}`);
    
    return {
      url: null,
      source: portalSource,
      status: res.status,
      debug: { redirectUrl, responseHeaders, bodyPreview, method: 'error', headersUsed: Object.keys(headers) }
    };
  } catch (error) {
    console.error(`[REDIRECT] Exception: ${error}`);
    return {
      url: null,
      source: portalSource,
      status: 0,
      debug: { redirectUrl, error: String(error), method: 'exception' }
    };
  }
}

// Internal helper to detect source (same as detectLinkSource but for internal use)
function detectLinkSourceInternal(url: string): string {
  if (url.includes('autotrack')) return 'autotrack';
  if (url.includes('autoscout24')) return 'autoscout24';
  if (url.includes('anwb.nl')) return 'anwb';
  if (url.includes('marktplaats')) return 'marktplaats';
  if (url.includes('autowereld')) return 'autowereld';
  if (url.includes('autoweek')) return 'autoweek';
  if (url.includes('viabovag')) return 'viabovag';
  
  const knownNonDealerDomains = ['gaspedaal.nl', 'autotrack.nl', 'autoscout24.nl', 'anwb.nl', 
                        'marktplaats.nl', 'autowereld.nl', 'autoweek.nl', 'viabovag.nl',
                        'apple.com', 'google.com', 'facebook.com', 'instagram.com',
                        'youtube.com', 'twitter.com', 'linkedin.com'];
  const isKnownNonDealer = knownNonDealerDomains.some(domain => url.includes(domain));
  
  if (!isKnownNonDealer && url.startsWith('http')) {
    return 'dealersite';
  }
  
  return 'other';
}

// ===== REDIRECT RESOLVER FUNCTION =====
async function testRedirectPattern(
  pattern: string,
  occasionId: string,
  source: string
): Promise<{ 
  pattern: string; 
  status: number; 
  location: string | null; 
  isRedirect: boolean;
  headers: Record<string, string>;
  bodyPreview: string | null;
  error: string | null;
}> {
  const url = pattern
    .replace('{occasionId}', occasionId)
    .replace('{source}', source);
  
  try {
    // Try HEAD first (faster, no body)
    const headResponse = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://www.gaspedaal.nl/',
      },
    });
    
    const headersObj: Record<string, string> = {};
    headResponse.headers.forEach((value, key) => {
      headersObj[key] = value;
    });
    
    const location = headResponse.headers.get('location');
    const isRedirect = headResponse.status >= 300 && headResponse.status < 400;
    
    // If not a redirect, try GET to see if body contains redirect info
    let bodyPreview: string | null = null;
    if (!isRedirect && headResponse.status === 200) {
      try {
        const getResponse = await fetch(url, {
          method: 'GET',
          redirect: 'manual',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.gaspedaal.nl/',
          },
        });
        const text = await getResponse.text();
        bodyPreview = text.substring(0, 500);
        
        // Check for JSON response with URL
        if (text.startsWith('{')) {
          try {
            const json = JSON.parse(text);
            if (json.url || json.redirect || json.location) {
              return {
                pattern: url,
                status: getResponse.status,
                location: json.url || json.redirect || json.location,
                isRedirect: true,
                headers: headersObj,
                bodyPreview,
                error: null,
              };
            }
          } catch {}
        }
      } catch {}
    }
    
    return {
      pattern: url,
      status: headResponse.status,
      location,
      isRedirect,
      headers: headersObj,
      bodyPreview,
      error: null,
    };
  } catch (error) {
    return {
      pattern: url,
      status: 0,
      location: null,
      isRedirect: false,
      headers: {},
      bodyPreview: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ===== REDIRECT RESOLVER WITH COOKIES =====
async function testRedirectPatternWithCookies(
  pattern: string,
  occasionId: string,
  source: string,
  cookieJar: string | null
): Promise<{ 
  pattern: string; 
  status: number; 
  location: string | null; 
  isRedirect: boolean;
  headers: Record<string, string>;
  bodyPreview: string | null;
  error: string | null;
}> {
  const url = pattern
    .replace('{occasionId}', occasionId)
    .replace('{source}', source);
  
  const requestHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
    'Referer': 'https://www.gaspedaal.nl/',
    'Origin': 'https://www.gaspedaal.nl',
  };
  
  if (cookieJar) {
    requestHeaders['Cookie'] = cookieJar;
  }
  
  try {
    // Try HEAD first (faster, no body)
    const headResponse = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual',
      headers: requestHeaders,
    });
    
    const headersObj: Record<string, string> = {};
    headResponse.headers.forEach((value, key) => {
      headersObj[key] = value;
    });
    
    const location = headResponse.headers.get('location');
    const isRedirect = headResponse.status >= 300 && headResponse.status < 400;
    
    // If not a redirect, try GET to see if body contains redirect info
    let bodyPreview: string | null = null;
    if (!isRedirect && headResponse.status === 200) {
      try {
        const getResponse = await fetch(url, {
          method: 'GET',
          redirect: 'manual',
          headers: requestHeaders,
        });
        const text = await getResponse.text();
        bodyPreview = text.substring(0, 500);
        
        // Check for JSON response with URL
        if (text.startsWith('{')) {
          try {
            const json = JSON.parse(text);
            if (json.url || json.redirect || json.location) {
              return {
                pattern: url,
                status: getResponse.status,
                location: json.url || json.redirect || json.location,
                isRedirect: true,
                headers: headersObj,
                bodyPreview,
                error: null,
              };
            }
          } catch {}
        }
      } catch {}
    }
    
    return {
      pattern: url,
      status: headResponse.status,
      location,
      isRedirect,
      headers: headersObj,
      bodyPreview,
      error: null,
    };
  } catch (error) {
    return {
      pattern: url,
      status: 0,
      location: null,
      isRedirect: false,
      headers: {},
      bodyPreview: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function extractLinksFromGaspedaalPage(
  occasionId: string,
  apiKey: string
): Promise<{
  success: boolean;
  html?: string;
  links?: string[];
  externalLinks?: Array<{ source: string; url: string }>;
  outboundSources?: string[];
  error?: string;
}> {
  const url = `https://www.gaspedaal.nl/occasion/${occasionId}`;
  
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['html', 'links'],
        onlyMainContent: false,
        waitFor: 8000,
      }),
    });
    
    if (!response.ok) {
      return { success: false, error: `Firecrawl HTTP ${response.status}` };
    }
    
    const data = await response.json();
    const html = data.data?.html || data.html || '';
    const links = data.data?.links || data.links || [];
    
    // Extract external portal links
    const externalLinks: Array<{ source: string; url: string }> = [];
    const seenUrls = new Set<string>();
    
    // Pattern 1: Direct href links
    const hrefPattern = /href="(https?:\/\/(?!www\.gaspedaal\.nl)[^"]+)"/gi;
    let match;
    while ((match = hrefPattern.exec(html)) !== null) {
      const foundUrl = match[1];
      if (!seenUrls.has(foundUrl)) {
        seenUrls.add(foundUrl);
        const source = detectLinkSource(foundUrl);
        if (source !== 'other') {
          externalLinks.push({ source, url: foundUrl });
        }
      }
    }
    
    // Pattern 2: data-url attributes
    const dataUrlPattern = /data-(?:url|href|redirect)="(https?:\/\/[^"]+)"/gi;
    while ((match = dataUrlPattern.exec(html)) !== null) {
      const foundUrl = match[1];
      if (!foundUrl.includes('gaspedaal.nl') && !seenUrls.has(foundUrl)) {
        seenUrls.add(foundUrl);
        const source = detectLinkSource(foundUrl);
        externalLinks.push({ source, url: foundUrl });
      }
    }
    
    // Pattern 3: JSON embedded URLs
    const jsonUrlPattern = /"(?:url|href|redirect|link)":\s*"(https?:\/\/[^"]+)"/gi;
    while ((match = jsonUrlPattern.exec(html)) !== null) {
      const foundUrl = match[1];
      if (!foundUrl.includes('gaspedaal.nl') && !seenUrls.has(foundUrl)) {
        seenUrls.add(foundUrl);
        const source = detectLinkSource(foundUrl);
        externalLinks.push({ source, url: foundUrl });
      }
    }
    
    // Pattern 4: Check Firecrawl links array
    for (const link of links) {
      if (!link.includes('gaspedaal.nl') && !seenUrls.has(link)) {
        const source = detectLinkSource(link);
        if (source !== 'other') {
          seenUrls.add(link);
          externalLinks.push({ source, url: link });
        }
      }
    }
    
    // Extract outbound sources from "Bekijk deze auto op:" text
    const outboundSources: string[] = [];
    const bekijkMatch = html.match(/Bekijk\s+(?:deze\s+auto|dit\s+voertuig)\s+op[:\s]*([^<]+)/i);
    if (bekijkMatch) {
      const sources = bekijkMatch[1].split(/[,\s]+/).filter((s: string) => s.length > 2);
      for (const s of sources) {
        const normalized = s.toLowerCase().trim();
        if (['dealersite', 'autotrack', 'autoscout24', 'anwb', 'marktplaats'].includes(normalized)) {
          outboundSources.push(normalized);
        }
      }
    }
    
    return {
      success: true,
      html,
      links,
      externalLinks,
      outboundSources,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

function detectLinkSource(url: string): string {
  if (url.includes('autotrack')) return 'autotrack';
  if (url.includes('autoscout24')) return 'autoscout24';
  if (url.includes('anwb.nl')) return 'anwb';
  if (url.includes('marktplaats')) return 'marktplaats';
  if (url.includes('autowereld')) return 'autowereld';
  if (url.includes('autoweek')) return 'autoweek';
  if (url.includes('viabovag')) return 'viabovag';
  
  const knownPortals = ['gaspedaal.nl', 'autotrack.nl', 'autoscout24.nl', 'anwb.nl', 
                        'marktplaats.nl', 'autowereld.nl', 'autoweek.nl', 'viabovag.nl',
                        'apple.com', 'google.com', 'facebook.com', 'instagram.com',
                        'youtube.com', 'twitter.com', 'linkedin.com'];
  const isKnownPortal = knownPortals.some(domain => url.includes(domain));
  
  if (!isKnownPortal && url.startsWith('http')) {
    return 'dealersite';
  }
  
  return 'other';
}

// ===== PORTAL BUTTON SELECTORS TO TEST =====
const PORTAL_SELECTORS = {
  // Priority order: dealersite first
  dealersite: [
    'a[data-portal="dealersite"]',
    'button[data-source="dealersite"]',
    '.portal-button--dealersite',
    'a[href*="out/"][href*="dealer"]',
    '[data-testid="portal-dealersite"]',
    '.outbound-link:first-child',
    'a.btn-dealersite',
    // Generic patterns
    'a[href*="/out/"]',
    'button:has-text("Dealersite")',
    'a:has-text("Bekijk op dealersite")',
  ],
  autotrack: [
    'a[data-portal="autotrack"]',
    'a[href*="autotrack.nl"]',
    '.portal-button--autotrack',
    '[data-testid="portal-autotrack"]',
    'a:has-text("AutoTrack")',
  ],
  autoscout24: [
    'a[data-portal="autoscout24"]',
    'a[href*="autoscout24"]',
    '.portal-button--autoscout24',
  ],
  marktplaats: [
    'a[data-portal="marktplaats"]',
    'a[href*="marktplaats.nl"]',
    '.portal-button--marktplaats',
  ],
};

// ===== FIRECRAWL ACTIONS HELPER =====
async function scrapeWithFirecrawlActions(
  url: string,
  apiKey: string,
  actions: Array<{ type: string; selector?: string; milliseconds?: number; key?: string; direction?: string }>
): Promise<{
  success: boolean;
  html?: string;
  markdown?: string;
  finalUrl?: string;
  actionsResult?: any;
  error?: string;
}> {
  console.log(`[ACTIONS] Scraping ${url} with ${actions.length} actions`);
  
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['html', 'markdown'],
        onlyMainContent: false,
        waitFor: 5000, // Wait for initial page load
        actions,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ACTIONS] Firecrawl error: ${response.status}`, errorText);
      return { success: false, error: `HTTP ${response.status}: ${errorText.substring(0, 200)}` };
    }

    const data = await response.json();
    console.log(`[ACTIONS] Response keys: ${Object.keys(data).join(', ')}`);
    
    // Firecrawl v1 nests data
    const nestedData = data.data || data;
    
    return {
      success: true,
      html: nestedData.html || '',
      markdown: nestedData.markdown || '',
      finalUrl: nestedData.url || nestedData.metadata?.sourceURL || url,
      actionsResult: nestedData.actions || null,
    };
  } catch (error) {
    console.error(`[ACTIONS] Exception:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ===== EXTRACT PORTAL BUTTONS FROM HTML =====
function extractPortalButtonsFromHtml(html: string): Array<{
  type: string;
  selector: string;
  href: string | null;
  text: string;
  dataAttributes: Record<string, string>;
}> {
  const buttons: Array<{
    type: string;
    selector: string;
    href: string | null;
    text: string;
    dataAttributes: Record<string, string>;
  }> = [];
  
  // Pattern 1: Links with portal-related data attributes
  const dataPortalPattern = /<a[^>]*data-portal="([^"]+)"[^>]*(?:href="([^"]*)")?[^>]*>([^<]*)</gi;
  let match;
  while ((match = dataPortalPattern.exec(html)) !== null) {
    buttons.push({
      type: match[1],
      selector: `a[data-portal="${match[1]}"]`,
      href: match[2] || null,
      text: match[3].trim(),
      dataAttributes: { portal: match[1] },
    });
  }
  
  // Pattern 2: Outbound links (common Gaspedaal pattern)
  const outboundPattern = /<a[^>]*href="([^"]*(?:\/out\/|outbound|redirect)[^"]*)"[^>]*(?:class="([^"]*)")?[^>]*>([^<]*)</gi;
  while ((match = outboundPattern.exec(html)) !== null) {
    const href = match[1];
    // Detect portal type from URL
    let type = 'unknown';
    if (href.includes('dealersite') || href.includes('dealer')) type = 'dealersite';
    else if (href.includes('autotrack')) type = 'autotrack';
    else if (href.includes('autoscout')) type = 'autoscout24';
    else if (href.includes('marktplaats')) type = 'marktplaats';
    else if (href.includes('/out/')) type = 'outbound';
    
    buttons.push({
      type,
      selector: `a[href*="${href.split('/').slice(-2).join('/')}"]`,
      href,
      text: match[3].trim(),
      dataAttributes: { class: match[2] || '' },
    });
  }
  
  // Pattern 3: Buttons with text indicating portal
  const bekijkPattern = /Bekijk\s+(?:op|deze\s+auto\s+op)\s+(\w+)/gi;
  const bekijkMatches = html.matchAll(bekijkPattern);
  for (const bekijkMatch of bekijkMatches) {
    const portal = bekijkMatch[1].toLowerCase();
    if (['dealersite', 'autotrack', 'autoscout24', 'marktplaats', 'anwb'].includes(portal)) {
      buttons.push({
        type: portal,
        selector: `:has-text("Bekijk op ${bekijkMatch[1]}")`,
        href: null,
        text: bekijkMatch[0],
        dataAttributes: {},
      });
    }
  }
  
  // Pattern 4: Generic external link buttons in portal section
  const portalSectionPattern = /<(?:div|section)[^>]*(?:portal|outbound|bekijk)[^>]*>([\s\S]*?)<\/(?:div|section)>/gi;
  while ((match = portalSectionPattern.exec(html)) !== null) {
    const sectionHtml = match[1];
    const linksInSection = sectionHtml.match(/<a[^>]*href="([^"]+)"[^>]*>([^<]*)</gi);
    if (linksInSection) {
      for (const linkMatch of linksInSection) {
        const linkParts = linkMatch.match(/href="([^"]+)"[^>]*>([^<]*)</i);
        if (linkParts && !linkParts[1].includes('gaspedaal.nl')) {
          buttons.push({
            type: 'section_link',
            selector: `a[href="${linkParts[1]}"]`,
            href: linkParts[1],
            text: linkParts[2].trim(),
            dataAttributes: { context: 'portal_section' },
          });
        }
      }
    }
  }
  
  return buttons;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'FIRECRAWL_API_KEY not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body for optional test mode
    let testMode = 'index'; // 'index', 'detail', 'redirect', 'proxy', or 'actions'
    let testOccasionId: string | null = null;
    let clickPortal: string | null = null; // For actions mode: which portal to click
    try {
      const body = await req.json();
      testMode = body.testMode || body.mode || 'index';
      testOccasionId = body.testOccasionId || body.occasionId || null;
      clickPortal = body.clickPortal || null;
      console.log(`[DEBUG] Request: testMode=${testMode}, testOccasionId=${testOccasionId}, clickPortal=${clickPortal}`);
    } catch {}

    // ===== FIRECRAWL ACTIONS TEST MODE =====
    if (testMode === 'actions') {
      if (!testOccasionId) {
        return new Response(
          JSON.stringify({ error: 'testOccasionId required for actions test' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const occasionUrl = `https://www.gaspedaal.nl/occasion/${testOccasionId}`;
      console.log(`[ACTIONS] Testing Firecrawl Actions on: ${occasionUrl}`);
      
      // STEP 1: First, render the page WITHOUT clicking to discover portal buttons
      // Use longer wait and scroll to trigger lazy loading
      console.log('[ACTIONS] Step 1: Rendering page to discover portal buttons...');
      const discoverResult = await scrapeWithFirecrawlActions(occasionUrl, apiKey, [
        { type: 'wait', milliseconds: 5000 }, // Wait longer for initial load
        { type: 'scroll', direction: 'down' }, // Scroll to trigger lazy content
        { type: 'wait', milliseconds: 3000 }, // Wait for lazy loaded content
        { type: 'scrape' },
      ]);
      
      if (!discoverResult.success) {
        return new Response(
          JSON.stringify({
            success: false,
            mode: 'actions',
            step: 'discover',
            occasionId: testOccasionId,
            error: discoverResult.error,
            recommendation: 'Firecrawl failed to render page. Check API key and credits.',
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const html = discoverResult.html || '';
      const markdown = discoverResult.markdown || '';
      console.log(`[ACTIONS] Rendered HTML length: ${html.length}, Markdown length: ${markdown.length}`);
      
      // Extract portal buttons from rendered HTML
      const portalButtons = extractPortalButtonsFromHtml(html);
      console.log(`[ACTIONS] Found ${portalButtons.length} portal buttons`);
      
      // Check if page has real content
      const hasVehicleContent = html.includes('€') || 
                                markdown.includes('km') ||
                                html.includes('Kenteken') ||
                                markdown.includes('Bouwjaar');
      
      const isSkeletonOnly = html.length < 50000 && !hasVehicleContent;
      
      // STEP 2: If clickPortal specified, try to click that button
      let clickResult: any = null;
      if (clickPortal && portalButtons.length > 0) {
        console.log(`[ACTIONS] Step 2: Attempting to click ${clickPortal} button...`);
        
        // Find the selector for the requested portal
        const portalButton = portalButtons.find(b => b.type === clickPortal);
        const selectors = PORTAL_SELECTORS[clickPortal as keyof typeof PORTAL_SELECTORS] || [];
        const selectorToTry = portalButton?.selector || selectors[0] || 'a[href*="/out/"]';
        
        console.log(`[ACTIONS] Using selector: ${selectorToTry}`);
        
        const clickActions = [
          { type: 'wait', milliseconds: 2000 },
          { type: 'click', selector: selectorToTry },
          { type: 'wait', milliseconds: 4000 }, // Wait for redirect/navigation
          { type: 'scrape' }, // Capture final page
        ];
        
        const clickScrapeResult = await scrapeWithFirecrawlActions(occasionUrl, apiKey, clickActions);
        
        clickResult = {
          success: clickScrapeResult.success,
          selectorUsed: selectorToTry,
          finalUrl: clickScrapeResult.finalUrl,
          isExternalUrl: clickScrapeResult.finalUrl && !clickScrapeResult.finalUrl.includes('gaspedaal.nl'),
          htmlLength: clickScrapeResult.html?.length || 0,
          error: clickScrapeResult.error,
          actionsResult: clickScrapeResult.actionsResult,
        };
        
        // Detect source of final URL
        if (clickResult.isExternalUrl && clickScrapeResult.finalUrl) {
          clickResult.resolvedSource = detectLinkSource(clickScrapeResult.finalUrl);
        }
      }
      
      // Extract any direct external links found in rendered HTML
      const externalLinks: Array<{ source: string; url: string }> = [];
      const seenUrls = new Set<string>();
      const hrefPattern = /href="(https?:\/\/(?!www\.gaspedaal\.nl)[^"]+)"/gi;
      let match;
      while ((match = hrefPattern.exec(html)) !== null) {
        const foundUrl = match[1];
        if (!seenUrls.has(foundUrl)) {
          seenUrls.add(foundUrl);
          const source = detectLinkSource(foundUrl);
          if (source !== 'other') {
            externalLinks.push({ source, url: foundUrl });
          }
        }
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          mode: 'actions',
          occasionId: testOccasionId,
          occasionUrl,
          
          // Page rendering status
          renderingStatus: {
            htmlLength: html.length,
            markdownLength: markdown.length,
            hasVehicleContent,
            isSkeletonOnly,
            recommendation: hasVehicleContent
              ? 'Page rendered successfully with vehicle content'
              : isSkeletonOnly
                ? 'Page appears to be SPA skeleton - may need more wait time'
                : 'Page rendered but unclear if content loaded',
          },
          
          // Portal button discovery
          portalButtonDiscovery: {
            totalFound: portalButtons.length,
            buttons: portalButtons,
            suggestedSelectors: portalButtons.map(b => b.selector),
            byType: {
              dealersite: portalButtons.filter(b => b.type === 'dealersite'),
              autotrack: portalButtons.filter(b => b.type === 'autotrack'),
              other: portalButtons.filter(b => !['dealersite', 'autotrack'].includes(b.type)),
            },
          },
          
          // Direct external links (no click required)
          directExternalLinks: {
            count: externalLinks.length,
            links: externalLinks,
            recommendation: externalLinks.length > 0
              ? `Found ${externalLinks.length} external links directly in HTML - may not need click action!`
              : 'No direct external links found - click action required',
          },
          
          // Click test result (if requested)
          clickTestResult: clickResult,
          
          // Recommendations
          recommendations: [
            portalButtons.length > 0 
              ? `Found ${portalButtons.length} portal buttons - try clickPortal: "${portalButtons[0].type}" to test`
              : 'No portal buttons found - page may use different structure',
            externalLinks.length > 0
              ? 'Direct external links available - can use without click action'
              : 'No direct links - must use click action to resolve',
            clickResult?.isExternalUrl
              ? `SUCCESS: Click resolved to external URL: ${clickResult.finalUrl}`
              : clickResult
                ? 'Click did not result in external URL navigation'
                : 'Run with clickPortal parameter to test click navigation',
          ].filter(Boolean),
          
          // Debug info
          debug: {
            firecrawlFinalUrl: discoverResult.finalUrl,
            htmlPreview: html.substring(0, 2000),
            markdownPreview: markdown.substring(0, 1500),
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== PROXY REDIRECT TEST MODE (OpenAI suggested approach) =====
    if (testMode === 'proxy') {
      if (!testOccasionId) {
        return new Response(
          JSON.stringify({ error: 'testOccasionId required for proxy test' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`[PROXY] Testing OpenAI proxy pattern for occasion ID: ${testOccasionId}`);
      
      // Step 1: Get cookies from Gaspedaal homepage
      const { cookies: cookieJar, headers: cookieResponseHeaders } = await getGaspedaalCookieJar();
      
      // Step 2: Try each portal source with the proxy pattern
      const proxyResults: Array<{
        portal: string;
        result: { url: string | null; source: string; status: number; debug: Record<string, unknown> };
      }> = [];
      
      for (const portal of SOURCES_TO_TEST) {
        console.log(`[PROXY] Testing portal: ${portal}`);
        const result = await resolveExternalDetailUrl(testOccasionId, cookieJar, portal);
        proxyResults.push({ portal, result });
        
        // If we found a working URL, highlight it
        if (result.url) {
          console.log(`[PROXY] SUCCESS with ${portal}: ${result.url}`);
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Find successful results
      const successfulResults = proxyResults.filter(r => r.result.url !== null);
      const dealersiteResult = proxyResults.find(r => r.portal === 'dealersite');
      
      return new Response(
        JSON.stringify({
          success: true,
          mode: 'proxy',
          occasionId: testOccasionId,
          
          // Cookie handshake info
          cookieHandshake: {
            hasCookies: !!cookieJar,
            cookiePreview: cookieJar?.substring(0, 150) || null,
            cookieLength: cookieJar?.length || 0,
            responseHeaders: cookieResponseHeaders,
          },
          
          // Summary
          summary: {
            totalPortalsTested: proxyResults.length,
            successfulResolutions: successfulResults.length,
            portalsWithUrls: successfulResults.map(r => r.portal),
            recommendation: successfulResults.length > 0
              ? `SUCCESS: Found ${successfulResults.length} external URLs! Use ${successfulResults[0].portal} for scraping.`
              : cookieJar
                ? 'FAILED: Cookie handshake worked but still no URLs resolved. Gaspedaal may be blocking proxy requests entirely.'
                : 'FAILED: No cookies obtained. Cookie handshake failed.',
          },
          
          // Best result (prioritize dealersite)
          bestResult: successfulResults.length > 0
            ? successfulResults.find(r => r.portal === 'dealersite') || successfulResults[0]
            : null,
          
          // Dealersite specific (most important for us)
          dealersiteResult: dealersiteResult ? {
            status: dealersiteResult.result.status,
            url: dealersiteResult.result.url,
            debug: dealersiteResult.result.debug,
          } : null,
          
          // All results
          allResults: proxyResults.map(r => ({
            portal: r.portal,
            status: r.result.status,
            url: r.result.url,
            source: r.result.source,
            debug: r.result.debug,
          })),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== REDIRECT TEST MODE (original pattern testing) =====
    if (testMode === 'redirect') {
      if (!testOccasionId) {
        return new Response(
          JSON.stringify({ error: 'testOccasionId required for redirect test' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`[DEBUG] Testing redirect patterns for occasion ID: ${testOccasionId}`);
      
      // Also get cookies for this test
      const { cookies: cookieJar } = await getGaspedaalCookieJar();
      console.log(`[DEBUG] Using cookies: ${cookieJar ? 'YES' : 'NO'}`);
      
      const results: Array<{
        patternName: string;
        source: string;
        result: {
          pattern: string;
          status: number;
          location: string | null;
          isRedirect: boolean;
          headers: Record<string, string>;
          bodyPreview: string | null;
          error: string | null;
        };
      }> = [];
      
      // Test all patterns with all sources (now with cookies)
      for (const pattern of REDIRECT_PATTERNS) {
        for (const source of SOURCES_TO_TEST) {
          console.log(`[DEBUG] Testing pattern: ${pattern.name} with source: ${source}`);
          const result = await testRedirectPatternWithCookies(pattern.template, testOccasionId, source, cookieJar);
          results.push({
            patternName: pattern.name,
            source,
            result,
          });
          
          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Also try to extract links from the Gaspedaal page itself
      console.log(`[DEBUG] Extracting links from Gaspedaal occasion page`);
      const pageLinks = await extractLinksFromGaspedaalPage(testOccasionId, apiKey);
      
      // Summarize successful patterns
      const successfulRedirects = results.filter(r => 
        r.result.isRedirect && 
        r.result.location && 
        !r.result.location.includes('gaspedaal.nl')
      );
      
      const successfulJsonResponses = results.filter(r =>
        r.result.status === 200 &&
        r.result.location &&
        !r.result.location.includes('gaspedaal.nl')
      );
      
      return new Response(
        JSON.stringify({
          success: true,
          mode: 'redirect',
          occasionId: testOccasionId,
          hasCookies: !!cookieJar,
          
          // Summary
          summary: {
            totalPatternsTested: results.length,
            successfulRedirects: successfulRedirects.length,
            successfulJsonResponses: successfulJsonResponses.length,
            pageLinksFound: pageLinks.externalLinks?.length || 0,
            recommendation: successfulRedirects.length > 0 
              ? `SUCCESS: Found ${successfulRedirects.length} working redirect patterns!`
              : pageLinks.externalLinks && pageLinks.externalLinks.length > 0
                ? `PARTIAL: No redirects, but found ${pageLinks.externalLinks.length} links on page`
                : 'FAILED: No external URLs found. Try testMode=proxy for OpenAI approach.',
          },
          
          // Successful redirects
          successfulRedirects: successfulRedirects.map(r => ({
            pattern: r.patternName,
            source: r.source,
            url: r.result.pattern,
            externalUrl: r.result.location,
          })),
          
          // Links from page scrape
          pageLinks: {
            success: pageLinks.success,
            externalLinks: pageLinks.externalLinks,
            outboundSources: pageLinks.outboundSources,
            totalLinksOnPage: pageLinks.links?.length || 0,
            error: pageLinks.error,
          },
          
          // Full results for debugging
          allResults: results.map(r => ({
            patternName: r.patternName,
            source: r.source,
            status: r.result.status,
            isRedirect: r.result.isRedirect,
            location: r.result.location,
            error: r.result.error,
          })),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If testing a specific occasion detail page
    if (testMode === 'detail' && testOccasionId) {
      const detailUrl = `https://www.gaspedaal.nl/occasion/${testOccasionId}`;
      console.log(`[DEBUG] Testing Gaspedaal occasion page: ${detailUrl}`);
      
      // Try with longer wait time and also request markdown for better parsing
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: detailUrl,
          formats: ['html', 'links', 'markdown'],
          onlyMainContent: false,
          waitFor: 10000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[DEBUG] Firecrawl error:', errorText);
        return new Response(
          JSON.stringify({ error: `Firecrawl error: ${response.status}`, details: errorText }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      const html = data.data?.html || data.html || '';
      const links = data.data?.links || data.links || [];
      const markdown = data.data?.markdown || data.markdown || '';
      
      console.log('[DEBUG] Detail page HTML length:', html.length);
      console.log('[DEBUG] Detail page Markdown length:', markdown.length);
      
      // Check if page actually loaded
      const isSkeletonOnly = html.includes('overflow: hidden') && 
                             html.length < 200000 && 
                             !html.includes('data-testid="occasion-detail"');
      
      const hasVehicleContent = markdown.includes('€') || 
                                markdown.includes('km') || 
                                markdown.includes('Kenteken') ||
                                markdown.includes('Bouwjaar');
      
      // Extract specs from detail page
      const specsTable: Record<string, string> = {};
      const tableRowPattern = /<tr[^>]*>[\s\S]*?<t[hd][^>]*>([^<]+)<\/t[hd]>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<\/tr>/gi;
      let match;
      while ((match = tableRowPattern.exec(html)) !== null) {
        specsTable[match[1].trim()] = match[2].trim();
      }
      
      const dlPattern = /<dt[^>]*>([^<]+)<\/dt>\s*<dd[^>]*>([^<]+)<\/dd>/gi;
      while ((match = dlPattern.exec(html)) !== null) {
        specsTable[match[1].trim()] = match[2].trim();
      }
      
      // Extract external portal links
      const externalLinkPattern = /href="(https?:\/\/(?!www\.gaspedaal\.nl)[^"]+)"/gi;
      const externalLinks: string[] = [];
      while ((match = externalLinkPattern.exec(html)) !== null) {
        if (!externalLinks.includes(match[1]) && externalLinks.length < 50) {
          externalLinks.push(match[1]);
        }
      }
      
      const externalFromFirecrawl = (links as string[]).filter((url: string) => 
        !url.includes('gaspedaal.nl') && 
        (url.includes('autotrack') || url.includes('autoscout') || 
         url.includes('marktplaats') || url.includes('anwb') ||
         url.includes('dealer') || url.includes('occasion'))
      );
      
      const portalLinks = externalLinks.filter(url => 
        url.includes('autotrack') || 
        url.includes('autoscout') || 
        url.includes('marktplaats') ||
        url.includes('anwb') ||
        url.includes('autowereld') ||
        url.includes('viabovag')
      );
      
      // Extract license plate
      const licensePlatePatterns = [
        /kenteken[:\s]*<[^>]*>([A-Z0-9]{1,3}[-\s]?[A-Z0-9]{2,3}[-\s]?[A-Z0-9]{1,2})</i,
        /Kenteken[:\s]*([A-Z0-9]{1,3}[-\s]?[A-Z0-9]{2,3}[-\s]?[A-Z0-9]{1,2})/i,
        /([A-Z]{2}[-\s]?\d{3}[-\s]?[A-Z]{1})/,
        /([A-Z]{1}[-\s]?\d{3}[-\s]?[A-Z]{2})/,
        /(\d{1,3}[-\s]?[A-Z]{2,3}[-\s]?[A-Z0-9]{1,2})/,
      ];
      let licensePlate: string | null = null;
      for (const pattern of licensePlatePatterns) {
        const lpMatch = html.match(pattern);
        if (lpMatch && lpMatch[1]) {
          licensePlate = lpMatch[1].replace(/\s/g, '-').toUpperCase();
          break;
        }
      }
      if (!licensePlate) {
        const mdPlateMatch = markdown.match(/Kenteken[:\s]*([A-Z0-9-]+)/i);
        if (mdPlateMatch) {
          licensePlate = mdPlateMatch[1].replace(/\s/g, '-').toUpperCase();
        }
      }
      
      // Extract options
      let optionsList: string[] = [];
      const optionsSectionPatterns = [
        /uitrusting[^<]*?<[^>]*>([\s\S]*?)<\/(?:div|section|ul)>/i,
        /opties[^<]*?<[^>]*>([\s\S]*?)<\/(?:div|section|ul)>/i,
      ];
      for (const pattern of optionsSectionPatterns) {
        const optMatch = html.match(pattern);
        if (optMatch && optMatch[1] && optMatch[1].length > 20) {
          const listItems = optMatch[1].match(/<li[^>]*>([^<]+)<\/li>/gi);
          if (listItems) {
            optionsList = listItems.map((item: string) => item.replace(/<[^>]+>/g, '').trim()).filter((item: string) => item.length > 0);
          }
          break;
        }
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          mode: 'detail',
          occasionId: testOccasionId,
          url: detailUrl,
          htmlLength: html.length,
          markdownLength: markdown.length,
          linksFromFirecrawl: links.length,
          
          renderingStatus: {
            isSkeletonOnly,
            hasVehicleContent,
            recommendation: hasVehicleContent 
              ? 'Page rendered successfully with vehicle data'
              : isSkeletonOnly 
                ? 'Page is SPA skeleton - content not rendered'
                : 'Page rendered but no vehicle data found'
          },
          
          specsTableCount: Object.keys(specsTable).length,
          specsTable,
          licensePlate,
          optionsCount: optionsList.length,
          optionsList: optionsList.slice(0, 20),
          
          externalLinksCount: externalLinks.length,
          externalFromFirecrawlCount: externalFromFirecrawl.length,
          portalLinks,
          externalLinksSample: externalLinks.slice(0, 10),
          externalFromFirecrawl: externalFromFirecrawl.slice(0, 10),
          
          sampleContent: html.substring(0, 5000),
          markdownSample: markdown.substring(0, 3000),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== INDEX PAGE TEST =====
    const url = 'https://www.gaspedaal.nl/zoeken?sort=date_desc&min_year=2014&min_price=2000&page=1';
    
    console.log('[DEBUG] Fetching index page:', url);
    
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['html', 'links'],
        onlyMainContent: false,
        waitFor: 5000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DEBUG] Firecrawl error:', errorText);
      return new Response(
        JSON.stringify({ error: `Firecrawl error: ${response.status}`, details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const html = data.data?.html || data.html || '';
    const links = data.data?.links || data.links || [];
    
    console.log('[DEBUG] HTML length:', html.length);
    console.log('[DEBUG] Links count:', links.length);
    
    // Extract occasion IDs
    const occasionIdPattern = /id="oc(\d+)"/g;
    const occasionIds: string[] = [];
    let match;
    while ((match = occasionIdPattern.exec(html)) !== null) {
      if (!occasionIds.includes(match[1])) {
        occasionIds.push(match[1]);
      }
    }
    console.log(`[DEBUG] Found ${occasionIds.length} occasion IDs`);
    
    // Pattern 2: data-id="123456"
    const dataIdPattern = /data-(?:occasion-)?id="(\d{6,12})"/g;
    const dataIds: string[] = [];
    while ((match = dataIdPattern.exec(html)) !== null) {
      if (!dataIds.includes(match[1]) && !occasionIds.includes(match[1])) {
        dataIds.push(match[1]);
      }
    }
    
    const sampleDetailUrls = occasionIds.slice(0, 5).map(id => ({
      occasionId: id,
      gaspedaalDetailUrl: `https://www.gaspedaal.nl/occasion/${id}`,
    }));
    
    // Parse __NEXT_DATA__
    let nextDataAnalysis: any = { found: false };
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const pageProps = nextData?.props?.pageProps || {};
        nextDataAnalysis = {
          found: true,
          keys: Object.keys(pageProps),
          hasListings: !!pageProps.listings,
          listingsCount: pageProps.listings?.length || 0,
          sampleListing: pageProps.listings?.[0] ? {
            keys: Object.keys(pageProps.listings[0]),
            fullSample: JSON.stringify(pageProps.listings[0]).substring(0, 2000),
          } : null,
        };
      } catch (e) {
        nextDataAnalysis = { found: true, parseError: String(e) };
      }
    }
    
    // Find occasion links in HTML
    const occasionLinkPattern = /href="(\/occasion\/\d+[^"]*)"/gi;
    const occasionLinksInHtml: string[] = [];
    while ((match = occasionLinkPattern.exec(html)) !== null) {
      if (!occasionLinksInHtml.includes(match[1])) {
        occasionLinksInHtml.push(match[1]);
      }
    }
    
    // Extract sample listing card
    let sampleListingCard = '';
    const firstOccasionIdIndex = html.indexOf('id="oc');
    if (firstOccasionIdIndex > -1) {
      const cardStart = Math.max(0, firstOccasionIdIndex - 200);
      const cardEnd = Math.min(html.length, firstOccasionIdIndex + 3000);
      sampleListingCard = html.substring(cardStart, cardEnd);
    }
    
    // Check for external URLs
    const externalUrlPattern = /href="(https?:\/\/(?!www\.gaspedaal\.nl)[^"]+)"/gi;
    const externalUrls: string[] = [];
    while ((match = externalUrlPattern.exec(html)) !== null) {
      if (!externalUrls.includes(match[1]) && externalUrls.length < 30) {
        externalUrls.push(match[1]);
      }
    }
    
    const externalByDomain: Record<string, string[]> = {};
    for (const extUrl of externalUrls) {
      try {
        const domain = new URL(extUrl).hostname;
        if (!externalByDomain[domain]) externalByDomain[domain] = [];
        externalByDomain[domain].push(extUrl);
      } catch {}
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        mode: 'index',
        htmlLength: html.length,
        linksFromFirecrawl: links.length,
        
        occasionIdExtraction: {
          totalFound: occasionIds.length,
          pattern: 'id="oc{ID}"',
          sampleIds: occasionIds.slice(0, 10),
          additionalDataIds: dataIds.slice(0, 5),
          sampleDetailUrls,
          recommendation: occasionIds.length > 0 
            ? `SUCCESS: Found ${occasionIds.length} occasion IDs. Use testMode='redirect' to test URL resolution.`
            : 'FAILED: No occasion IDs found.',
        },
        
        occasionLinksInHtml: occasionLinksInHtml.slice(0, 10),
        nextDataAnalysis,
        
        externalUrlsCount: externalUrls.length,
        externalByDomain: Object.fromEntries(
          Object.entries(externalByDomain).map(([k, v]) => [k, v.slice(0, 3)])
        ),
        
        sampleListingCard: sampleListingCard.substring(0, 4000),
        hasReactRoot: html.includes('__next') || html.includes('__NEXT_DATA__'),
        titleCount: (html.match(/isOccTitle/g) || []).length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[DEBUG] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
