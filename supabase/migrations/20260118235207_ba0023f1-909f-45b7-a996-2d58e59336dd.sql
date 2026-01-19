-- Golden Masterplan v4: Waterdichte Scraper & Herkenning
-- Nieuwe kolommen voor identity, dealer tracking, en readiness gates

-- Identity & Dealer tracking
ALTER TABLE listings ADD COLUMN IF NOT EXISTS dealer_key TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS dealer_key_confidence TEXT DEFAULT 'LOW';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS external_canonical_url_hash TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS fingerprint_hash_v2 TEXT;

-- Detail source tracking
ALTER TABLE listings ADD COLUMN IF NOT EXISTS detail_sources_tried JSONB DEFAULT '[]'::jsonb;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS detail_best_score INTEGER DEFAULT 0;

-- Readiness flags
ALTER TABLE listings ADD COLUMN IF NOT EXISTS listing_ready BOOLEAN DEFAULT false;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS taxation_ready BOOLEAN DEFAULT false;

-- Image tracking
ALTER TABLE listings ADD COLUMN IF NOT EXISTS image_url_thumbnail TEXT;

-- Performance indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_listings_external_url_hash ON listings(external_canonical_url_hash) WHERE external_canonical_url_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listings_fingerprint_v2 ON listings(fingerprint_hash_v2) WHERE fingerprint_hash_v2 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listings_dealer_key ON listings(dealer_key) WHERE dealer_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listings_taxation_ready ON listings(taxation_ready) WHERE taxation_ready = true;
CREATE INDEX IF NOT EXISTS idx_listings_listing_ready ON listings(listing_ready) WHERE listing_ready = true;

-- Composite index for dealer-scoped fingerprint lookup (critical for soft matching)
CREATE INDEX IF NOT EXISTS idx_listings_dealer_fingerprint ON listings(dealer_key, fingerprint_hash_v2) WHERE dealer_key IS NOT NULL AND fingerprint_hash_v2 IS NOT NULL;