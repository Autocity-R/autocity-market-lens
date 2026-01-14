-- Add new columns to listings table for enhanced vehicle data
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS body_type TEXT,
ADD COLUMN IF NOT EXISTS color TEXT,
ADD COLUMN IF NOT EXISTS doors INTEGER,
ADD COLUMN IF NOT EXISTS registration_date DATE,
ADD COLUMN IF NOT EXISTS options_raw TEXT,
ADD COLUMN IF NOT EXISTS license_plate TEXT;

-- Add new columns to scraper_configs for budget control
ALTER TABLE public.scraper_configs
ADD COLUMN IF NOT EXISTS max_credits_per_day INTEGER DEFAULT 15000,
ADD COLUMN IF NOT EXISTS error_rate_threshold NUMERIC(3,2) DEFAULT 0.10,
ADD COLUMN IF NOT EXISTS parse_quality_threshold NUMERIC(3,2) DEFAULT 0.50;

-- Add credit tracking columns to scraper_jobs
ALTER TABLE public.scraper_jobs
ADD COLUMN IF NOT EXISTS credits_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sitemap_requests INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS detail_requests INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS parse_success_rate NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS error_rate NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS stop_reason TEXT;

-- Create daily credit usage tracking table
CREATE TABLE IF NOT EXISTS public.scraper_credit_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT NOT NULL,
  credits_used INTEGER NOT NULL DEFAULT 0,
  sitemap_requests INTEGER DEFAULT 0,
  detail_requests INTEGER DEFAULT 0,
  jobs_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(date, source)
);

-- Enable RLS on credit usage table
ALTER TABLE public.scraper_credit_usage ENABLE ROW LEVEL SECURITY;

-- Create policies for credit usage table
CREATE POLICY "Anyone can view scraper_credit_usage" 
ON public.scraper_credit_usage 
FOR SELECT 
USING (true);

CREATE POLICY "Service role can manage scraper_credit_usage" 
ON public.scraper_credit_usage 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Add index for efficient date+source lookups
CREATE INDEX IF NOT EXISTS idx_scraper_credit_usage_date_source 
ON public.scraper_credit_usage(date, source);

-- Add index for license plate lookups (duplicate detection)
CREATE INDEX IF NOT EXISTS idx_listings_license_plate 
ON public.listings(license_plate) WHERE license_plate IS NOT NULL;