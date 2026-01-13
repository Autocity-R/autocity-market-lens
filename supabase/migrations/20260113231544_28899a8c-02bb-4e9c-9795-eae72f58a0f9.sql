-- Add vehicle_fingerprint for cross-portal matching
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS vehicle_fingerprint TEXT;

-- Add sitemap_lastmod for incremental discovery
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS sitemap_lastmod TIMESTAMPTZ;

-- Index for fingerprint-based matching
CREATE INDEX IF NOT EXISTS idx_listings_vehicle_fingerprint ON public.listings(vehicle_fingerprint);

-- Index for sitemap-based discovery
CREATE INDEX IF NOT EXISTS idx_listings_sitemap_lastmod ON public.listings(sitemap_lastmod);