-- Add Gaspedaal occasion ID columns to listings table
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS gaspedaal_occasion_id TEXT;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS gaspedaal_detail_url TEXT;

-- Create index for fast lookup by occasion ID
CREATE INDEX IF NOT EXISTS idx_listings_gaspedaal_occasion_id ON public.listings(gaspedaal_occasion_id);

-- Add to raw_listings as well
ALTER TABLE public.raw_listings ADD COLUMN IF NOT EXISTS gaspedaal_occasion_id TEXT;
ALTER TABLE public.raw_listings ADD COLUMN IF NOT EXISTS gaspedaal_detail_url TEXT;

COMMENT ON COLUMN public.listings.gaspedaal_occasion_id IS 'Unique Gaspedaal occasion ID extracted from listing card (e.g., 129649001)';
COMMENT ON COLUMN public.listings.gaspedaal_detail_url IS 'Constructed Gaspedaal detail page URL (e.g., https://www.gaspedaal.nl/occasion/129649001)';