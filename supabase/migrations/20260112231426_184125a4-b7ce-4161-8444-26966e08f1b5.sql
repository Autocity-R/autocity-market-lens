-- ============================================
-- GASPEDAAL SCRAPER DATABASE SCHEMA
-- ============================================

-- 1. RAW_LISTINGS (staging/audit table)
CREATE TABLE raw_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  url TEXT NOT NULL,
  portal_listing_id TEXT,
  
  raw_title TEXT NOT NULL,
  raw_price TEXT,
  raw_mileage TEXT,
  raw_year TEXT,
  raw_specs JSONB DEFAULT '{}',
  
  dealer_name_raw TEXT,
  dealer_city_raw TEXT,
  dealer_page_url TEXT,
  
  content_hash TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consecutive_misses INT DEFAULT 0,
  
  UNIQUE(source, url)
);

CREATE INDEX idx_raw_source_url ON raw_listings(source, url);
CREATE INDEX idx_raw_last_seen ON raw_listings(last_seen_at);

-- 2. LISTINGS (UI source of truth)
CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_listing_id UUID REFERENCES raw_listings(id),
  
  source TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  
  title TEXT NOT NULL,
  make TEXT,
  model TEXT,
  year INT,
  mileage INT,
  price INT,
  previous_price INT,
  
  fuel_type TEXT,
  transmission TEXT,
  power_pk INT,
  
  dealer_id UUID,
  dealer_name TEXT,
  dealer_city TEXT,
  
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'gone')),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  content_hash TEXT,
  
  is_normalized BOOLEAN DEFAULT false,
  normalization_confidence INT,
  courantheid_score INT,
  courantheid_trend TEXT CHECK (courantheid_trend IN ('up', 'down', 'stable'))
);

CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_source ON listings(source);
CREATE INDEX idx_listings_last_seen ON listings(last_seen_at);
CREATE INDEX idx_listings_make_model ON listings(make, model);

-- 3. LISTING_SNAPSHOTS (history, only on changes)
CREATE TABLE listing_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  price INT,
  mileage INT,
  status TEXT NOT NULL,
  
  price_changed BOOLEAN DEFAULT false,
  mileage_changed BOOLEAN DEFAULT false,
  status_changed BOOLEAN DEFAULT false,
  price_delta INT,
  content_hash TEXT
);

CREATE INDEX idx_snapshots_listing ON listing_snapshots(listing_id);
CREATE INDEX idx_snapshots_captured ON listing_snapshots(captured_at);

-- 4. DEALERS (best effort - only with stable dealer_page_url)
CREATE TABLE dealers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_page_url TEXT UNIQUE,
  dealer_website_url TEXT,
  name_raw TEXT,
  name_normalized TEXT,
  city TEXT,
  active_listings_count INT DEFAULT 0,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dealers_page_url ON dealers(dealer_page_url);

-- 5. SCRAPER_JOBS (job history and stats)
CREATE TABLE scraper_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  job_type TEXT NOT NULL CHECK (job_type IN ('discovery', 'deep_sync', 'lifecycle_check')),
  
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_seconds INT,
  
  pages_processed INT DEFAULT 0,
  listings_found INT DEFAULT 0,
  listings_new INT DEFAULT 0,
  listings_updated INT DEFAULT 0,
  listings_gone INT DEFAULT 0,
  errors_count INT DEFAULT 0,
  error_log JSONB DEFAULT '[]',
  
  triggered_by TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_jobs_source ON scraper_jobs(source);
CREATE INDEX idx_jobs_created ON scraper_jobs(created_at DESC);

-- 6. SCRAPER_CONFIGS (per-source configuration)
CREATE TABLE scraper_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT true,
  paused BOOLEAN DEFAULT false,
  discovery_frequency_minutes INT DEFAULT 240,
  max_pages_per_run INT DEFAULT 5,
  max_listings_per_run INT DEFAULT 100,
  delay_between_requests_ms INT DEFAULT 1500,
  gone_after_consecutive_misses INT DEFAULT 3,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default Gaspedaal config
INSERT INTO scraper_configs (source, max_pages_per_run, max_listings_per_run) 
VALUES ('gaspedaal', 3, 100);

-- Add foreign key constraint for dealers in listings
ALTER TABLE listings 
ADD CONSTRAINT fk_listings_dealer 
FOREIGN KEY (dealer_id) REFERENCES dealers(id) ON DELETE SET NULL;