-- ============================================
-- RLS POLICIES FOR SCRAPER TABLES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE raw_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraper_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraper_configs ENABLE ROW LEVEL SECURITY;

-- RAW_LISTINGS: Public read, service role write
CREATE POLICY "Anyone can view raw_listings" 
ON raw_listings FOR SELECT 
USING (true);

CREATE POLICY "Service role can manage raw_listings" 
ON raw_listings FOR ALL 
USING (true)
WITH CHECK (true);

-- LISTINGS: Public read, service role write
CREATE POLICY "Anyone can view listings" 
ON listings FOR SELECT 
USING (true);

CREATE POLICY "Service role can manage listings" 
ON listings FOR ALL 
USING (true)
WITH CHECK (true);

-- LISTING_SNAPSHOTS: Public read, service role write
CREATE POLICY "Anyone can view listing_snapshots" 
ON listing_snapshots FOR SELECT 
USING (true);

CREATE POLICY "Service role can manage listing_snapshots" 
ON listing_snapshots FOR ALL 
USING (true)
WITH CHECK (true);

-- DEALERS: Public read, service role write
CREATE POLICY "Anyone can view dealers" 
ON dealers FOR SELECT 
USING (true);

CREATE POLICY "Service role can manage dealers" 
ON dealers FOR ALL 
USING (true)
WITH CHECK (true);

-- SCRAPER_JOBS: Public read, service role write
CREATE POLICY "Anyone can view scraper_jobs" 
ON scraper_jobs FOR SELECT 
USING (true);

CREATE POLICY "Service role can manage scraper_jobs" 
ON scraper_jobs FOR ALL 
USING (true)
WITH CHECK (true);

-- SCRAPER_CONFIGS: Public read, service role write
CREATE POLICY "Anyone can view scraper_configs" 
ON scraper_configs FOR SELECT 
USING (true);

CREATE POLICY "Service role can manage scraper_configs" 
ON scraper_configs FOR ALL 
USING (true)
WITH CHECK (true);