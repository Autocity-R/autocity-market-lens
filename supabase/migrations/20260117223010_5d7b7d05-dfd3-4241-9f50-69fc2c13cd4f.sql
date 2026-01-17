-- Add canonical_url and detail quality tracking to raw_listings
ALTER TABLE raw_listings ADD COLUMN IF NOT EXISTS canonical_url text;
ALTER TABLE raw_listings ADD COLUMN IF NOT EXISTS chosen_detail_source text;
ALTER TABLE raw_listings ADD COLUMN IF NOT EXISTS chosen_detail_url text;
ALTER TABLE raw_listings ADD COLUMN IF NOT EXISTS vin_hash text;

-- Add canonical_url and detail quality tracking to listings
ALTER TABLE listings ADD COLUMN IF NOT EXISTS canonical_url text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS detail_status text DEFAULT 'pending';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS detail_completeness_score integer DEFAULT 0;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS detail_attempts integer DEFAULT 0;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS last_detail_error text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS needs_detail_rescrape boolean DEFAULT false;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS detail_scraped_at timestamptz;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS chosen_detail_source text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS chosen_detail_url text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS vin_hash text;

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_listings_canonical_url ON listings(canonical_url);
CREATE INDEX IF NOT EXISTS idx_raw_listings_canonical_url ON raw_listings(canonical_url);
CREATE INDEX IF NOT EXISTS idx_listings_needs_rescrape ON listings(needs_detail_rescrape) WHERE needs_detail_rescrape = true;
CREATE INDEX IF NOT EXISTS idx_listings_detail_status ON listings(detail_status);
CREATE INDEX IF NOT EXISTS idx_listings_vin_hash ON listings(vin_hash) WHERE vin_hash IS NOT NULL;