-- Add new columns to listings table for options parsing and generation
ALTER TABLE listings ADD COLUMN IF NOT EXISTS options_parsed TEXT[];
ALTER TABLE listings ADD COLUMN IF NOT EXISTS generation TEXT;

-- Create valuation_cache table for market statistics
CREATE TABLE IF NOT EXISTS valuation_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  fuel_type TEXT,
  -- Market statistics
  live_median INTEGER,
  sold_median INTEGER,
  live_count INTEGER,
  sold_count INTEGER,
  courantheid_score INTEGER,
  avg_days_on_market INTEGER,
  -- Trend
  trend_7d_vs_30d DECIMAL,
  -- Calculated at
  calculated_at TIMESTAMPTZ DEFAULT now(),
  -- Unique constraint
  UNIQUE(make, model, fuel_type)
);

-- Create option_premiums table for IQR-validated option prices
CREATE TABLE IF NOT EXISTS option_premiums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  make TEXT NOT NULL,
  option_key TEXT NOT NULL,
  premium_median INTEGER,
  iqr_lower INTEGER,
  iqr_upper INTEGER,
  sample_size INTEGER,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(make, option_key)
);

-- Enable RLS on new tables
ALTER TABLE valuation_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE option_premiums ENABLE ROW LEVEL SECURITY;

-- Create public read policies (valuation data is not user-specific)
CREATE POLICY "Valuation cache is publicly readable" 
ON valuation_cache 
FOR SELECT 
USING (true);

CREATE POLICY "Option premiums are publicly readable" 
ON option_premiums 
FOR SELECT 
USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_valuation_cache_lookup ON valuation_cache(make, model, fuel_type);
CREATE INDEX IF NOT EXISTS idx_option_premiums_lookup ON option_premiums(make, option_key);
CREATE INDEX IF NOT EXISTS idx_listings_options_parsed ON listings USING GIN(options_parsed);
CREATE INDEX IF NOT EXISTS idx_listings_generation ON listings(generation);