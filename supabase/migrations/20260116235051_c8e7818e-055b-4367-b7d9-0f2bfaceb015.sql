-- Fase 1: raw_listings tabel uitbreiden voor volledige data backup

-- Detail page HTML backup (verzekering tegen parse fouten)
ALTER TABLE raw_listings ADD COLUMN IF NOT EXISTS html_detail TEXT;
ALTER TABLE raw_listings ADD COLUMN IF NOT EXISTS html_detail_size INTEGER;
ALTER TABLE raw_listings ADD COLUMN IF NOT EXISTS detail_scraped_at TIMESTAMPTZ;

-- Opties volledig opslaan (GEEN limiet)
ALTER TABLE raw_listings ADD COLUMN IF NOT EXISTS options_raw_text TEXT;
ALTER TABLE raw_listings ADD COLUMN IF NOT EXISTS options_raw_list TEXT[];
ALTER TABLE raw_listings ADD COLUMN IF NOT EXISTS options_raw_html TEXT;

-- Beschrijving en specs
ALTER TABLE raw_listings ADD COLUMN IF NOT EXISTS description_raw TEXT;

-- Afbeeldingen
ALTER TABLE raw_listings ADD COLUMN IF NOT EXISTS image_url_main TEXT;
ALTER TABLE raw_listings ADD COLUMN IF NOT EXISTS image_count INTEGER;

-- Outbound links met URLs (upgrade van string[] naar JSONB)
ALTER TABLE raw_listings ADD COLUMN IF NOT EXISTS outbound_links JSONB DEFAULT '[]'::jsonb;

-- Fase 2: listings tabel uitbreiden voor EV specs en extra data

-- Motor en EV specs
ALTER TABLE listings ADD COLUMN IF NOT EXISTS engine_cc INTEGER;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS battery_capacity_kwh DECIMAL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS electric_range_km INTEGER;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS drivetrain TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS vin TEXT;

-- Beschrijving
ALTER TABLE listings ADD COLUMN IF NOT EXISTS description_raw TEXT;

-- Afbeeldingen
ALTER TABLE listings ADD COLUMN IF NOT EXISTS image_url_main TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS image_count INTEGER;

-- Outbound links met URLs
ALTER TABLE listings ADD COLUMN IF NOT EXISTS outbound_links JSONB DEFAULT '[]'::jsonb;

-- Indexes voor nieuwe kolommen
CREATE INDEX IF NOT EXISTS idx_raw_listings_detail_scraped_at ON raw_listings(detail_scraped_at);
CREATE INDEX IF NOT EXISTS idx_listings_drivetrain ON listings(drivetrain);
CREATE INDEX IF NOT EXISTS idx_listings_engine_cc ON listings(engine_cc);
CREATE INDEX IF NOT EXISTS idx_listings_battery_capacity ON listings(battery_capacity_kwh);