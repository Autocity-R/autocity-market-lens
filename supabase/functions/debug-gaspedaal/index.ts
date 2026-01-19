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

    const url = 'https://www.gaspedaal.nl/zoeken?sort=date_desc&min_year=2014&min_price=2000&page=1';
    
    console.log('[DEBUG] Fetching:', url);
    
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
    
    // 2. Find ALL anchor tags with href containing gaspedaal.nl (internal links)
    const internalLinkPattern = /href="(https:\/\/www\.gaspedaal\.nl\/[^"]+)"/gi;
    const internalLinks: string[] = [];
    let match;
    while ((match = internalLinkPattern.exec(html)) !== null) {
      if (!internalLinks.includes(match[1])) {
        internalLinks.push(match[1]);
      }
    }
    
    // 3. Find occasion links specifically
    const occasionLinks = internalLinks.filter(l => l.includes('/occasion/') || l.includes('/auto/'));
    
    // 4. Look for listing wrapper elements with hrefs
    const listingWrapperPatterns = [
      /<a[^>]*href="([^"]*)"[^>]*class="[^"]*listing[^"]*"[^>]*>/gi,
      /<a[^>]*class="[^"]*listing[^"]*"[^>]*href="([^"]*)"[^>]*>/gi,
      /<a[^>]*href="([^"]*\/occasion\/[^"]*)"[^>]*>/gi,
      /<a[^>]*href="([^"]*\/auto\/[^"]*)"[^>]*>/gi,
    ];
    
    const listingWrapperLinks: string[] = [];
    for (const pattern of listingWrapperPatterns) {
      while ((match = pattern.exec(html)) !== null) {
        if (!listingWrapperLinks.includes(match[1])) {
          listingWrapperLinks.push(match[1]);
        }
      }
    }
    
    // 5. Find the anchor tag wrapping each isOccTitle
    const anchorAroundTitlePattern = /<a[^>]*href="([^"]*)"[^>]*>[\s\S]{0,500}<h2[^>]*class="isOccTitle/gi;
    const anchorAroundTitles: string[] = [];
    while ((match = anchorAroundTitlePattern.exec(html)) !== null) {
      anchorAroundTitles.push(match[1]);
    }
    
    // 6. Reverse pattern - find h2 and look backward for anchor
    const titleIndices: number[] = [];
    const titlePattern = /isOccTitle/gi;
    while ((match = titlePattern.exec(html)) !== null) {
      titleIndices.push(match.index);
    }
    
    const anchorBeforeTitles: string[] = [];
    for (const idx of titleIndices.slice(0, 5)) {
      const windowStart = Math.max(0, idx - 1000);
      const window = html.substring(windowStart, idx);
      // Find the last <a href before this point
      const lastAnchorMatch = window.match(/.*<a[^>]*href="([^"]*)"[^>]*>/s);
      if (lastAnchorMatch) {
        anchorBeforeTitles.push(lastAnchorMatch[1]);
      }
    }
    
    // 7. Extract a more focused sample around the first listing
    let sampleListingCard = '';
    const firstTitleIndex = html.indexOf('isOccTitle');
    if (firstTitleIndex > -1) {
      // Go back to find the start of the card (look for opening tag patterns)
      const searchBackStart = Math.max(0, firstTitleIndex - 2000);
      const beforeTitle = html.substring(searchBackStart, firstTitleIndex);
      
      // Find the outermost <a tag or card container
      const cardStartMatch = beforeTitle.match(/.*(<a[^>]*href="[^"]*"[^>]*>)/s);
      const startOffset = cardStartMatch ? beforeTitle.lastIndexOf(cardStartMatch[1]) : 0;
      
      const cardStart = searchBackStart + startOffset;
      const cardEnd = Math.min(html.length, firstTitleIndex + 1500);
      sampleListingCard = html.substring(cardStart, cardEnd);
    }
    
    // 8. Check for any external URLs (autotrack, autoscout, etc) anywhere in the HTML
    const externalUrlPattern = /href="(https?:\/\/(?!www\.gaspedaal\.nl)[^"]+)"/gi;
    const externalUrls: string[] = [];
    while ((match = externalUrlPattern.exec(html)) !== null) {
      if (!externalUrls.includes(match[1]) && externalUrls.length < 30) {
        externalUrls.push(match[1]);
      }
    }
    
    // Categorize external URLs
    const externalByDomain: Record<string, string[]> = {};
    for (const url of externalUrls) {
      try {
        const domain = new URL(url).hostname;
        if (!externalByDomain[domain]) externalByDomain[domain] = [];
        externalByDomain[domain].push(url);
      } catch {}
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        htmlLength: html.length,
        linksFromFirecrawl: links.length,
        
        // __NEXT_DATA__ analysis
        nextDataAnalysis,
        
        // Link analysis
        internalLinksCount: internalLinks.length,
        occasionLinks: occasionLinks.slice(0, 20),
        listingWrapperLinks: listingWrapperLinks.slice(0, 20),
        anchorAroundTitles: anchorAroundTitles.slice(0, 10),
        anchorBeforeTitles: anchorBeforeTitles.slice(0, 10),
        
        // External URL analysis
        externalUrlsCount: externalUrls.length,
        externalByDomain: Object.fromEntries(
          Object.entries(externalByDomain).map(([k, v]) => [k, v.slice(0, 3)])
        ),
        
        // Sample content for inspection
        sampleListingCard: sampleListingCard.substring(0, 4000),
        
        // Original analysis
        hasReactRoot: html.includes('__next') || html.includes('__NEXT_DATA__'),
        occTitleFound: firstTitleIndex > -1,
        titleCount: titleIndices.length,
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
