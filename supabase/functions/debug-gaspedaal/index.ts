import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    let testMode = 'index'; // 'index' or 'detail'
    let testOccasionId: string | null = null;
    try {
      const body = await req.json();
      // Support both naming conventions
      testMode = body.testMode || body.mode || 'index';
      testOccasionId = body.testOccasionId || body.occasionId || null;
      console.log(`[DEBUG] Request: testMode=${testMode}, testOccasionId=${testOccasionId}`);
    } catch {}

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
          waitFor: 10000, // Increased from 5000 to 10000ms
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
      
      // Check if page actually loaded (look for SPA skeleton indicators)
      const isSkeletonOnly = html.includes('overflow: hidden') && 
                             html.length < 200000 && 
                             !html.includes('data-testid="occasion-detail"');
      
      // Check for actual vehicle content in markdown
      const hasVehicleContent = markdown.includes('€') || 
                                markdown.includes('km') || 
                                markdown.includes('Kenteken') ||
                                markdown.includes('Bouwjaar');
      
      // Extract specs from detail page - try multiple patterns
      const specsTable: Record<string, string> = {};
      
      // Pattern 1: Traditional table rows
      const tableRowPattern = /<tr[^>]*>[\s\S]*?<t[hd][^>]*>([^<]+)<\/t[hd]>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<\/tr>/gi;
      let match;
      while ((match = tableRowPattern.exec(html)) !== null) {
        specsTable[match[1].trim()] = match[2].trim();
      }
      
      // Pattern 2: dl/dt/dd definition lists
      const dlPattern = /<dt[^>]*>([^<]+)<\/dt>\s*<dd[^>]*>([^<]+)<\/dd>/gi;
      while ((match = dlPattern.exec(html)) !== null) {
        specsTable[match[1].trim()] = match[2].trim();
      }
      
      // Pattern 3: Label + value spans
      const labelValuePattern = /<span[^>]*class="[^"]*label[^"]*"[^>]*>([^<]+)<\/span>\s*[^<]*<span[^>]*>([^<]+)<\/span>/gi;
      while ((match = labelValuePattern.exec(html)) !== null) {
        specsTable[match[1].trim()] = match[2].trim();
      }
      
      // Extract specs from markdown (cleaner)
      const markdownSpecs: Record<string, string> = {};
      const mdLinePattern = /\*\*([^*]+)\*\*:\s*([^\n]+)/g;
      while ((match = mdLinePattern.exec(markdown)) !== null) {
        markdownSpecs[match[1].trim()] = match[2].trim();
      }
      
      // Pipe-separated markdown tables
      const mdTablePattern = /\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/g;
      while ((match = mdTablePattern.exec(markdown)) !== null) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (key && value && key !== '---' && !key.includes('---')) {
          markdownSpecs[key] = value;
        }
      }
      
      // Extract external portal links
      const externalLinkPattern = /href="(https?:\/\/(?!www\.gaspedaal\.nl)[^"]+)"/gi;
      const externalLinks: string[] = [];
      while ((match = externalLinkPattern.exec(html)) !== null) {
        if (!externalLinks.includes(match[1]) && externalLinks.length < 50) {
          externalLinks.push(match[1]);
        }
      }
      
      // Also check Firecrawl links array for external URLs
      const externalFromFirecrawl = (links as string[]).filter((url: string) => 
        !url.includes('gaspedaal.nl') && 
        (url.includes('autotrack') || url.includes('autoscout') || 
         url.includes('marktplaats') || url.includes('anwb') ||
         url.includes('dealer') || url.includes('occasion'))
      );
      
      // Categorize external links
      const portalLinks = externalLinks.filter(url => 
        url.includes('autotrack') || 
        url.includes('autoscout') || 
        url.includes('marktplaats') ||
        url.includes('anwb') ||
        url.includes('autowereld') ||
        url.includes('viabovag')
      );
      
      // Extract license plate - improved patterns
      const licensePlatePatterns = [
        /kenteken[:\s]*<[^>]*>([A-Z0-9]{1,3}[-\s]?[A-Z0-9]{2,3}[-\s]?[A-Z0-9]{1,2})</i,
        /Kenteken[:\s]*([A-Z0-9]{1,3}[-\s]?[A-Z0-9]{2,3}[-\s]?[A-Z0-9]{1,2})/i,
        /([A-Z]{2}[-\s]?\d{3}[-\s]?[A-Z]{1})/,
        /([A-Z]{1}[-\s]?\d{3}[-\s]?[A-Z]{2})/,
        /(\d{1,3}[-\s]?[A-Z]{2,3}[-\s]?[A-Z0-9]{1,2})/,
      ];
      let licensePlate: string | null = null;
      // Try HTML first
      for (const pattern of licensePlatePatterns) {
        const lpMatch = html.match(pattern);
        if (lpMatch && lpMatch[1]) {
          licensePlate = lpMatch[1].replace(/\s/g, '-').toUpperCase();
          break;
        }
      }
      // Try markdown if not found
      if (!licensePlate) {
        const mdPlateMatch = markdown.match(/Kenteken[:\s]*([A-Z0-9-]+)/i);
        if (mdPlateMatch) {
          licensePlate = mdPlateMatch[1].replace(/\s/g, '-').toUpperCase();
        }
      }
      
      // Extract options section
      let optionsHtml: string | null = null;
      let optionsList: string[] = [];
      const optionsSectionPatterns = [
        /uitrusting[^<]*?<[^>]*>([\s\S]*?)<\/(?:div|section|ul)>/i,
        /opties[^<]*?<[^>]*>([\s\S]*?)<\/(?:div|section|ul)>/i,
        /class="[^"]*options[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section)>/i,
        /class="[^"]*equipment[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section)>/i,
      ];
      for (const pattern of optionsSectionPatterns) {
        const optMatch = html.match(pattern);
        if (optMatch && optMatch[1] && optMatch[1].length > 20) {
          optionsHtml = optMatch[1].substring(0, 2000);
          const listItems = optMatch[1].match(/<li[^>]*>([^<]+)<\/li>/gi);
          if (listItems) {
            optionsList = listItems.map((item: string) => item.replace(/<[^>]+>/g, '').trim()).filter((item: string) => item.length > 0);
          }
          break;
        }
      }
      
      // Extract options from markdown
      const mdOptionsMatch = markdown.match(/(?:Uitrusting|Opties|Accessoires)[:\s]*([\s\S]*?)(?:\n\n|$)/i);
      const markdownOptions: string[] = [];
      if (mdOptionsMatch) {
        const optLines = mdOptionsMatch[1].split('\n').filter((l: string) => l.trim().startsWith('-') || l.trim().startsWith('•'));
        for (const line of optLines) {
          const opt = line.replace(/^[-•*]\s*/, '').trim();
          if (opt.length > 2) markdownOptions.push(opt);
        }
      }
      
      // Extract sample of the page content
      const sampleContent = html.substring(0, 5000);
      const markdownSample = markdown.substring(0, 3000);
      
      return new Response(
        JSON.stringify({
          success: true,
          mode: 'detail',
          occasionId: testOccasionId,
          url: detailUrl,
          htmlLength: html.length,
          markdownLength: markdown.length,
          linksFromFirecrawl: links.length,
          
          // Rendering status
          renderingStatus: {
            isSkeletonOnly,
            hasVehicleContent,
            recommendation: hasVehicleContent 
              ? 'Page rendered successfully with vehicle data'
              : isSkeletonOnly 
                ? 'Page is SPA skeleton - content not rendered'
                : 'Page rendered but no vehicle data found'
          },
          
          // Key extractions - HTML
          specsTableCount: Object.keys(specsTable).length,
          specsTable,
          licensePlate,
          optionsCount: optionsList.length,
          optionsList: optionsList.slice(0, 20),
          
          // Key extractions - Markdown
          markdownSpecsCount: Object.keys(markdownSpecs).length,
          markdownSpecs,
          markdownOptionsCount: markdownOptions.length,
          markdownOptions: markdownOptions.slice(0, 20),
          
          // External links (crucial for two-phase scraping)
          externalLinksCount: externalLinks.length,
          externalFromFirecrawlCount: externalFromFirecrawl.length,
          portalLinks,
          externalLinksSample: externalLinks.slice(0, 10),
          externalFromFirecrawl: externalFromFirecrawl.slice(0, 10),
          
          // Raw content samples
          sampleContent,
          markdownSample,
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
    
    // ===== OCCASION ID EXTRACTION (NEW!) =====
    // Pattern 1: id="oc129649001" on listing cards
    const occasionIdPattern = /id="oc(\d+)"/g;
    const occasionIds: string[] = [];
    let match;
    while ((match = occasionIdPattern.exec(html)) !== null) {
      if (!occasionIds.includes(match[1])) {
        occasionIds.push(match[1]);
      }
    }
    console.log(`[DEBUG] Found ${occasionIds.length} occasion IDs`);
    
    // Pattern 2: data-id="123456" or data-occasion-id="123456"
    const dataIdPattern = /data-(?:occasion-)?id="(\d{6,12})"/g;
    const dataIds: string[] = [];
    while ((match = dataIdPattern.exec(html)) !== null) {
      if (!dataIds.includes(match[1]) && !occasionIds.includes(match[1])) {
        dataIds.push(match[1]);
      }
    }
    
    // Construct sample Gaspedaal detail URLs
    const sampleDetailUrls = occasionIds.slice(0, 5).map(id => ({
      occasionId: id,
      gaspedaalDetailUrl: `https://www.gaspedaal.nl/occasion/${id}`,
    }));
    
    // ===== ENHANCED ANALYSIS =====
    
    // 1. Parse __NEXT_DATA__ completely
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
            hasUrl: 'url' in pageProps.listings[0],
            hasId: 'id' in pageProps.listings[0],
            hasSlug: 'slug' in pageProps.listings[0],
            urlValue: pageProps.listings[0].url || pageProps.listings[0].slug || pageProps.listings[0].id || 'NO_URL_FOUND',
            outboundLinks: pageProps.listings[0].outboundLinks || pageProps.listings[0].externalLinks || 'NONE',
            fullSample: JSON.stringify(pageProps.listings[0]).substring(0, 2000),
          } : null,
        };
      } catch (e) {
        nextDataAnalysis = { found: true, parseError: String(e) };
      }
    }
    
    // 2. Find occasion links in HTML
    const occasionLinkPattern = /href="(\/occasion\/\d+[^"]*)"/gi;
    const occasionLinksInHtml: string[] = [];
    while ((match = occasionLinkPattern.exec(html)) !== null) {
      if (!occasionLinksInHtml.includes(match[1])) {
        occasionLinksInHtml.push(match[1]);
      }
    }
    
    // 3. Extract first listing card with occasion ID for inspection
    let sampleListingCard = '';
    const firstOccasionIdIndex = html.indexOf('id="oc');
    if (firstOccasionIdIndex > -1) {
      const cardStart = Math.max(0, firstOccasionIdIndex - 200);
      const cardEnd = Math.min(html.length, firstOccasionIdIndex + 3000);
      sampleListingCard = html.substring(cardStart, cardEnd);
    }
    
    // 4. Check for external URLs (autotrack, autoscout, etc) anywhere in the HTML
    const externalUrlPattern = /href="(https?:\/\/(?!www\.gaspedaal\.nl)[^"]+)"/gi;
    const externalUrls: string[] = [];
    while ((match = externalUrlPattern.exec(html)) !== null) {
      if (!externalUrls.includes(match[1]) && externalUrls.length < 30) {
        externalUrls.push(match[1]);
      }
    }
    
    // Categorize external URLs
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
        
        // ===== NEW: OCCASION ID EXTRACTION =====
        occasionIdExtraction: {
          totalFound: occasionIds.length,
          pattern: 'id="oc{ID}"',
          sampleIds: occasionIds.slice(0, 10),
          additionalDataIds: dataIds.slice(0, 5),
          sampleDetailUrls,
          recommendation: occasionIds.length > 0 
            ? `SUCCESS: Found ${occasionIds.length} occasion IDs. Use https://www.gaspedaal.nl/occasion/{ID} for detail scrapes.`
            : 'FAILED: No occasion IDs found. Need alternative approach.',
        },
        
        // Occasion links found as href
        occasionLinksInHtml: occasionLinksInHtml.slice(0, 10),
        
        // __NEXT_DATA__ analysis
        nextDataAnalysis,
        
        // External URL analysis
        externalUrlsCount: externalUrls.length,
        externalByDomain: Object.fromEntries(
          Object.entries(externalByDomain).map(([k, v]) => [k, v.slice(0, 3)])
        ),
        
        // Sample content for inspection
        sampleListingCard: sampleListingCard.substring(0, 4000),
        
        // Original analysis
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
