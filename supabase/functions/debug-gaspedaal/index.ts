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
        waitFor: 5000, // Longer wait for dynamic content
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
    
    // Search for /occasion/ links in the raw HTML and the links array
    const occasionLinksFromHtml: string[] = [];
    const occasionPattern = /\/occasion\/[a-zA-Z0-9\-_]+/gi;
    let match;
    while ((match = occasionPattern.exec(html)) !== null) {
      occasionLinksFromHtml.push(match[0]);
    }
    
    const occasionLinksFromArray = links.filter((l: string) => l.includes('/occasion/'));
    
    // Find where listings are in the HTML
    const occTitleIndex = html.indexOf('isOccTitle');
    const dataTestIdListing = html.indexOf('data-testid="listing-card"');
    const listingCard = html.indexOf('listing-card');
    const carCard = html.indexOf('car-card');
    
    // Find typical SPA patterns
    const hasReactRoot = html.includes('__next') || html.includes('react-root') || html.includes('__NEXT_DATA__');
    const hasStateHydration = html.includes('__APOLLO_STATE__') || html.includes('__INITIAL_STATE__');
    
    // Extract a sample around isOccTitle to understand structure
    let sampleAroundOccTitle = '';
    if (occTitleIndex > -1) {
      const start = Math.max(0, occTitleIndex - 500);
      const end = Math.min(html.length, occTitleIndex + 2000);
      sampleAroundOccTitle = html.substring(start, end);
    }
    
    // Find data attributes that might contain listing data
    const dataMatches = html.match(/data-[a-z-]+="[^"]*"/gi) || [];
    const uniqueDataAttrs = [...new Set(dataMatches.map((m: string) => m.split('=')[0]))].slice(0, 30);
    
    // Look for embedded JSON with listing data
    const jsonInScript = html.match(/<script[^>]*>(\s*\{[\s\S]*?"listings"[\s\S]*?\})\s*<\/script>/i);
    const hasEmbeddedListings = !!jsonInScript;
    
    // Count total hrefs
    const hrefCount = (html.match(/href="/gi) || []).length;
    
    return new Response(
      JSON.stringify({
        success: true,
        htmlLength: html.length,
        linksFromFirecrawl: links.length,
        occasionLinksFromHtml: [...new Set(occasionLinksFromHtml)].slice(0, 50),
        occasionLinksFromArray: occasionLinksFromArray.slice(0, 50),
        occTitleFound: occTitleIndex > -1,
        occTitleIndex,
        dataTestIdListing: dataTestIdListing > -1,
        listingCardFound: listingCard > -1,
        carCardFound: carCard > -1,
        hasReactRoot,
        hasStateHydration,
        hasEmbeddedListings,
        hrefCount,
        uniqueDataAttrs,
        sampleAroundOccTitle: sampleAroundOccTitle.substring(0, 3000),
        sampleLinks: links.slice(0, 30),
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