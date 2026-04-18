// Gaspedaal Discovery — Direct Fetch + AutoTrack ID Extraction
// No Firecrawl. Fetches Gaspedaal HTML with browser headers, extracts AutoTrack IDs
// from CDN image URLs, then fetches autotrack.nl detail pages and parses JSON-LD.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif," +
    "image/webp,*/*;q=0.8",
  "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

interface DiscoveryParams {
  make?: string;
  model?: string;
  pages: number;
  detailLimit: number;
  mode: "discovery" | "full";
}

interface AutoTrackHit {
  id: string;
  url: string;
  imageUrl: string | null;
  gaspedaalIndexUrl: string;
}

interface ParsedDetail {
  url: string;
  portal_listing_id: string;
  raw_title: string;
  raw_price: string | null;
  raw_mileage: string | null;
  raw_year: string | null;
  raw_specs: Record<string, string | null>;
  dealer_name_raw: string | null;
  dealer_city_raw: string | null;
  dealer_page_url: string | null;
  description_raw: string | null;
  image_url_main: string | null;
  image_count: number;
  options_raw_list: string[];
  options_raw_text: string | null;
  jsonld_present: boolean;
}

function buildIndexUrl(make: string | undefined, model: string | undefined, page: number): string {
  const base = "https://www.gaspedaal.nl";
  const m = (make || "").trim().toLowerCase();
  const mo = (model || "").trim().toLowerCase();
  let path = "/occasions";
  if (m && mo) path = `/${encodeURIComponent(m)}/${encodeURIComponent(mo)}`;
  else if (m) path = `/${encodeURIComponent(m)}`;
  return `${base}${path}?pagina=${page}`;
}

async function fetchHtml(
  url: string,
  extraHeaders: Record<string, string> = {},
  timeoutMs = 25_000,
): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { ...BROWSER_HEADERS, ...extraHeaders },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

const AUTOTRACK_HEADERS: Record<string, string> = {
  "Referer": "https://www.gaspedaal.nl/",
  "Sec-Fetch-Site": "cross-site",
};

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&euro;/g, "€")
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(parseInt(d, 10)));
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

// Extract AutoTrack listing IDs from Gaspedaal HTML
// Pattern: autotrack.nl/cdn-cgi/image/<width>/<id>/<filename>  (id = 6-9 digits)
function extractAutoTrackHits(html: string, indexUrl: string): AutoTrackHit[] {
  const hits = new Map<string, AutoTrackHit>();

  const cdnRe =
    /https?:\/\/(?:www\.)?autotrack\.nl\/cdn-cgi\/image\/[^"'\s)]*?\/(\d{6,9})\/[^"'\s)]+/gi;
  let m: RegExpExecArray | null;
  while ((m = cdnRe.exec(html)) !== null) {
    const id = m[1];
    if (!hits.has(id)) {
      hits.set(id, {
        id,
        url: `https://www.autotrack.nl/aanbod/${id}`,
        imageUrl: m[0],
        gaspedaalIndexUrl: indexUrl,
      });
    }
  }

  const directRe = /https?:\/\/(?:www\.)?autotrack\.nl\/aanbod\/(\d{6,9})/gi;
  while ((m = directRe.exec(html)) !== null) {
    const id = m[1];
    if (!hits.has(id)) {
      hits.set(id, {
        id,
        url: `https://www.autotrack.nl/aanbod/${id}`,
        imageUrl: null,
        gaspedaalIndexUrl: indexUrl,
      });
    }
  }

  return Array.from(hits.values());
}

function extractJsonLdBlocks(html: string): any[] {
  const blocks: any[] = [];
  const re =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) blocks.push(...parsed);
      else blocks.push(parsed);
    } catch {
      // ignore malformed
    }
  }
  return blocks;
}

function pickVehicleJsonLd(blocks: any[]): any | null {
  for (const b of blocks) {
    const t = b?.["@type"];
    if (
      t === "Vehicle" ||
      t === "Car" ||
      (Array.isArray(t) && (t.includes("Vehicle") || t.includes("Car")))
    ) {
      return b;
    }
    if (b?.mainEntity) {
      const me = b.mainEntity;
      const mt = me?.["@type"];
      if (mt === "Vehicle" || mt === "Car") return me;
    }
  }
  for (const b of blocks) {
    if (b && (b.vehicleIdentificationNumber || b.mileageFromOdometer || b.modelDate)) {
      return b;
    }
  }
  return null;
}

function getMeta(html: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const r1 = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`,
    "i",
  );
  const r2 = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`,
    "i",
  );
  const m = html.match(r1) || html.match(r2);
  return m ? decodeHtmlEntities(m[1]).trim() || null : null;
}

function extractPrice(html: string, jsonld: any): string | null {
  const offers = jsonld?.offers;
  if (offers) {
    if (typeof offers.price !== "undefined" && offers.price !== null) return String(offers.price);
    if (Array.isArray(offers) && offers[0]?.price) return String(offers[0].price);
  }
  const og = getMeta(html, "product:price:amount") || getMeta(html, "og:price:amount");
  if (og) return og;
  const m = html.match(/€\s*([\d.\s]{3,})/);
  if (m) return m[1].replace(/[\s.]/g, "");
  return null;
}

function extractMileage(html: string, jsonld: any): string | null {
  const mfo = jsonld?.mileageFromOdometer;
  if (mfo) {
    if (typeof mfo === "object" && mfo.value) return String(mfo.value);
    if (typeof mfo === "number" || typeof mfo === "string") return String(mfo);
  }
  const m = html.match(/([\d.]{3,})\s*km\b/i);
  return m ? m[1].replace(/\./g, "") : null;
}

function extractYear(html: string, jsonld: any): string | null {
  if (jsonld?.modelDate) return String(jsonld.modelDate);
  if (jsonld?.productionDate) return String(jsonld.productionDate).slice(0, 4);
  if (jsonld?.vehicleModelDate) return String(jsonld.vehicleModelDate).slice(0, 4);
  const m = html.match(/Bouwjaar[^0-9]{0,10}(\d{4})/i);
  return m ? m[1] : null;
}

function extractTitle(html: string, jsonld: any): string {
  if (jsonld?.name) return String(jsonld.name).trim();
  const og = getMeta(html, "og:title");
  if (og) return og;
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return t ? decodeHtmlEntities(t[1]).trim() : "Untitled";
}

function extractMainImage(html: string, jsonld: any): string | null {
  if (jsonld?.image) {
    if (typeof jsonld.image === "string") return jsonld.image;
    if (Array.isArray(jsonld.image)) return String(jsonld.image[0] || "") || null;
    if (jsonld.image.url) return String(jsonld.image.url);
  }
  return getMeta(html, "og:image");
}

function extractImageCount(html: string): number {
  const matches = html.match(
    /https?:\/\/(?:www\.)?autotrack\.nl\/cdn-cgi\/image\/[^"'\s)]+\.(?:jpg|jpeg|png|webp)/gi,
  );
  if (!matches) return 0;
  return new Set(matches).size;
}

function extractDealer(html: string, jsonld: any): {
  name: string | null;
  city: string | null;
  page: string | null;
} {
  let name: string | null = null;
  let city: string | null = null;
  let page: string | null = null;

  const seller = jsonld?.offers?.seller || jsonld?.seller;
  if (seller) {
    name = seller.name ? String(seller.name) : null;
    const addr = seller.address;
    if (addr) city = addr.addressLocality ? String(addr.addressLocality) : null;
    if (seller.url) page = String(seller.url);
  }

  if (!name) {
    const m = html.match(/data-dealer-name=["']([^"']+)["']/i);
    if (m) name = decodeHtmlEntities(m[1]);
  }
  if (!city) {
    const m = html.match(/data-dealer-city=["']([^"']+)["']/i);
    if (m) city = decodeHtmlEntities(m[1]);
  }
  if (!page) {
    const m = html.match(/href=["'](https?:\/\/(?:www\.)?autotrack\.nl\/dealer\/[^"']+)["']/i);
    if (m) page = m[1];
  }

  return { name, city, page };
}

function extractDescription(html: string, jsonld: any): string | null {
  if (jsonld?.description) return String(jsonld.description).trim().slice(0, 5000) || null;
  return getMeta(html, "og:description") || getMeta(html, "description");
}

function extractOptions(html: string): { list: string[]; text: string | null } {
  const sec =
    html.match(/Opties[\s\S]{0,200}?<ul[^>]*>([\s\S]{0,8000}?)<\/ul>/i) ||
    html.match(/Accessoires[\s\S]{0,200}?<ul[^>]*>([\s\S]{0,8000}?)<\/ul>/i);
  if (!sec) return { list: [], text: null };
  const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  const list: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = liRe.exec(sec[1])) !== null) {
    const t = stripTags(m[1]);
    if (t) list.push(t);
  }
  return { list, text: list.join(" | ") || null };
}

function extractSpec(html: string, jsonld: any, label: string, jsonldKey?: string): string | null {
  if (jsonldKey && jsonld?.[jsonldKey]) {
    const v = jsonld[jsonldKey];
    if (typeof v === "string" || typeof v === "number") return String(v);
  }
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<dt[^>]*>\\s*${escaped}\\s*<\\/dt>\\s*<dd[^>]*>([\\s\\S]*?)<\\/dd>`, "i");
  const m = html.match(re);
  if (m) return stripTags(m[1]) || null;
  const re2 = new RegExp(`${escaped}\\s*[:\\-]\\s*([^<\\n\\r|]{1,80})`, "i");
  const m2 = html.match(re2);
  return m2 ? m2[1].trim() : null;
}

function parseDetailHtml(html: string, url: string, id: string): ParsedDetail {
  const blocks = extractJsonLdBlocks(html);
  const vehicle = pickVehicleJsonLd(blocks);

  const opts = extractOptions(html);
  const dealer = extractDealer(html, vehicle);

  const specs: Record<string, string | null> = {
    brandstof: extractSpec(html, vehicle, "Brandstof", "fuelType"),
    transmissie: extractSpec(html, vehicle, "Transmissie", "vehicleTransmission"),
    vermogen: extractSpec(html, vehicle, "Vermogen"),
    carrosserie: extractSpec(html, vehicle, "Carrosserie", "bodyType"),
    kleur: extractSpec(html, vehicle, "Kleur", "color"),
    deuren: extractSpec(html, vehicle, "Aantal deuren", "numberOfDoors"),
    kenteken: extractSpec(html, vehicle, "Kenteken"),
    opties: opts.text,
  };

  return {
    url,
    portal_listing_id: id,
    raw_title: extractTitle(html, vehicle),
    raw_price: extractPrice(html, vehicle),
    raw_mileage: extractMileage(html, vehicle),
    raw_year: extractYear(html, vehicle),
    raw_specs: specs,
    dealer_name_raw: dealer.name,
    dealer_city_raw: dealer.city,
    dealer_page_url: dealer.page,
    description_raw: extractDescription(html, vehicle),
    image_url_main: extractMainImage(html, vehicle),
    image_count: extractImageCount(html),
    options_raw_list: opts.list,
    options_raw_text: opts.text,
    jsonld_present: !!vehicle,
  };
}

async function upsertRawListing(
  supabase: ReturnType<typeof createClient>,
  detail: ParsedDetail,
): Promise<{ inserted: boolean; updated: boolean; error?: string }> {
  const contentBasis = JSON.stringify({
    t: detail.raw_title,
    p: detail.raw_price,
    m: detail.raw_mileage,
    y: detail.raw_year,
    s: detail.raw_specs,
  });
  const content_hash = await sha256(contentBasis);

  const { data: existing, error: selErr } = await supabase
    .from("raw_listings")
    .select("id, content_hash")
    .eq("url", detail.url)
    .maybeSingle();

  if (selErr) return { inserted: false, updated: false, error: selErr.message };

  const nowIso = new Date().toISOString();
  const row = {
    source: "autotrack",
    url: detail.url,
    portal_listing_id: detail.portal_listing_id,
    raw_title: detail.raw_title,
    raw_price: detail.raw_price,
    raw_mileage: detail.raw_mileage,
    raw_year: detail.raw_year,
    raw_specs: detail.raw_specs,
    dealer_name_raw: detail.dealer_name_raw,
    dealer_city_raw: detail.dealer_city_raw,
    dealer_page_url: detail.dealer_page_url,
    content_hash,
    last_seen_at: nowIso,
    scraped_at: nowIso,
    description_raw: detail.description_raw,
    image_url_main: detail.image_url_main,
    image_count: detail.image_count,
    options_raw_list: detail.options_raw_list,
    options_raw_text: detail.options_raw_text,
    chosen_detail_source: "autotrack_direct",
    chosen_detail_url: detail.url,
    portal_source: "autotrack",
    portal_matched_url: detail.url,
    detail_scraped_at: nowIso,
    available_sources: ["autotrack"],
  };

  if (!existing) {
    const { error: insErr } = await supabase
      .from("raw_listings")
      .insert({ ...row, first_seen_at: nowIso });
    if (insErr) return { inserted: false, updated: false, error: insErr.message };
    return { inserted: true, updated: false };
  } else {
    const { error: updErr } = await supabase
      .from("raw_listings")
      .update(row)
      .eq("id", existing.id);
    if (updErr) return { inserted: false, updated: false, error: updErr.message };
    return { inserted: false, updated: true };
  }
}

async function createJob(
  supabase: ReturnType<typeof createClient>,
  jobType: "discovery" | "deep_sync",
): Promise<string | null> {
  const { data, error } = await supabase
    .from("scraper_jobs")
    .insert({
      source: "gaspedaal",
      job_type: jobType,
      status: "running",
      started_at: new Date().toISOString(),
      triggered_by: "manual",
    })
    .select("id")
    .single();
  if (error) {
    console.error("createJob error:", error.message);
    return null;
  }
  return data?.id ?? null;
}

async function finalizeJob(
  supabase: ReturnType<typeof createClient>,
  jobId: string | null,
  payload: Record<string, unknown>,
  status: "completed" | "failed",
) {
  if (!jobId) return;
  await supabase
    .from("scraper_jobs")
    .update({ ...payload, status, completed_at: new Date().toISOString() })
    .eq("id", jobId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startedAt = Date.now();
  let body: any = {};
  try {
    if (req.method === "POST") body = await req.json();
  } catch {
    body = {};
  }

  const url = new URL(req.url);
  const params: DiscoveryParams = {
    make: body.make ?? url.searchParams.get("make") ?? undefined,
    model: body.model ?? url.searchParams.get("model") ?? undefined,
    pages: Math.max(1, Math.min(20, Number(body.pages ?? url.searchParams.get("pages") ?? 1))),
    detailLimit: Math.max(
      0,
      Math.min(500, Number(body.detailLimit ?? url.searchParams.get("detailLimit") ?? 25)),
    ),
    mode:
      (body.mode ?? url.searchParams.get("mode") ?? "discovery") === "full"
        ? "full"
        : "discovery",
  };

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const jobId = await createJob(
    supabase,
    params.mode === "full" ? "deep_sync" : "discovery",
  );

  const errors: Array<{ stage: string; url?: string; message: string }> = [];
  const indexUrls: string[] = [];
  let totalHits: AutoTrackHit[] = [];

  // Stage A — Discovery: fetch Gaspedaal index pages, extract AutoTrack IDs
  for (let p = 1; p <= params.pages; p++) {
    const idxUrl = buildIndexUrl(params.make, params.model, p);
    indexUrls.push(idxUrl);
    try {
      const html = await fetchHtml(idxUrl);
      totalHits.push(...extractAutoTrackHits(html, idxUrl));
    } catch (e) {
      errors.push({
        stage: "index_fetch",
        url: idxUrl,
        message: e instanceof Error ? e.message : String(e),
      });
    }
    await new Promise((r) => setTimeout(r, 700));
  }

  // dedupe by ID
  const dedup = new Map<string, AutoTrackHit>();
  for (const h of totalHits) if (!dedup.has(h.id)) dedup.set(h.id, h);
  totalHits = Array.from(dedup.values());

  // Stage B — Detail fetching (only in mode=full)
  let detailsAttempted = 0;
  let detailsParsed = 0;
  let inserted = 0;
  let updated = 0;

  if (params.mode === "full" && totalHits.length > 0) {
    const slice = totalHits.slice(0, params.detailLimit);
    for (const hit of slice) {
      detailsAttempted++;
      try {
        const html = await fetchHtml(hit.url, AUTOTRACK_HEADERS);
        const parsed = parseDetailHtml(html, hit.url, hit.id);
        detailsParsed++;
        const res = await upsertRawListing(supabase, parsed);
        if (res.error) {
          errors.push({ stage: "upsert", url: hit.url, message: res.error });
        } else {
          if (res.inserted) inserted++;
          if (res.updated) updated++;
        }
      } catch (e) {
        errors.push({
          stage: "detail_fetch",
          url: hit.url,
          message: e instanceof Error ? e.message : String(e),
        });
      }
      // Randomized 2000-3000ms delay to look more human
      await new Promise((r) => setTimeout(r, 2000 + Math.floor(Math.random() * 1000)));
    }
  }

  const durationMs = Date.now() - startedAt;
  const summary = {
    ok: true,
    mode: params.mode,
    params,
    indexUrls,
    discovered: totalHits.length,
    sample_ids: totalHits.slice(0, 10).map((h) => h.id),
    detailsAttempted,
    detailsParsed,
    inserted,
    updated,
    errors,
    durationMs,
  };

  await finalizeJob(
    supabase,
    jobId,
    {
      pages_processed: params.pages,
      listings_found: totalHits.length,
      listings_new: inserted,
      listings_updated: updated,
      errors_count: errors.length,
      error_log: errors.slice(0, 50),
      duration_seconds: Math.round(durationMs / 1000),
      stop_reason: errors.length ? "completed_with_errors" : null,
    },
    errors.length && detailsParsed === 0 && totalHits.length === 0 ? "failed" : "completed",
  );

  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
