-- Add available_sources column to track which portals are indicated by "Bekijk deze auto op:" text
ALTER TABLE raw_listings 
ADD COLUMN IF NOT EXISTS available_sources TEXT[];

-- Add portal search tracking columns
ALTER TABLE raw_listings 
ADD COLUMN IF NOT EXISTS portal_matched_url TEXT,
ADD COLUMN IF NOT EXISTS portal_match_score INTEGER,
ADD COLUMN IF NOT EXISTS portal_source TEXT;

-- Index for processing queue - find listings needing portal search
CREATE INDEX IF NOT EXISTS idx_raw_listings_available_sources 
  ON raw_listings USING GIN(available_sources)
  WHERE available_sources IS NOT NULL;