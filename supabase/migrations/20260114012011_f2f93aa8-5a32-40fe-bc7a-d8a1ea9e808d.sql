-- =============================================
-- Autocity MVP: Listings Extensions & Vehicle Events
-- =============================================

-- 1. Add new columns to listings table
ALTER TABLE listings ADD COLUMN IF NOT EXISTS license_plate_hash TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS gone_detected_at TIMESTAMPTZ;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS sold_confirmed_at TIMESTAMPTZ;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS price_bucket INTEGER;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS mileage_bucket INTEGER;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS outbound_sources TEXT[];

-- 2. Update status constraint to support 4-state lifecycle
-- First drop existing constraint if it exists
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_status_check;

-- Add new constraint with all 4 states
ALTER TABLE listings ADD CONSTRAINT listings_status_check 
  CHECK (status IN ('active', 'gone_suspected', 'sold_confirmed', 'returned'));

-- 3. Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_listings_license_plate_hash ON listings(license_plate_hash) WHERE license_plate_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listings_status_last_seen ON listings(status, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_listings_fingerprint ON listings(vehicle_fingerprint) WHERE vehicle_fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listings_gone_detected ON listings(gone_detected_at) WHERE gone_detected_at IS NOT NULL;

-- 4. Create vehicle_events table for lifecycle tracking
CREATE TABLE IF NOT EXISTS vehicle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  
  -- Event type: all lifecycle events
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created',
    'price_changed', 
    'gone_detected', 
    'returned', 
    'sold_confirmed'
  )),
  event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Snapshot at moment of event
  price_at_event INTEGER,
  days_on_market INTEGER,
  
  -- For sale events
  is_real_sale BOOLEAN,
  
  -- Vehicle data snapshot (for historical queries)
  vehicle_fingerprint TEXT,
  license_plate_hash TEXT,
  make TEXT,
  model TEXT,
  year INTEGER,
  mileage INTEGER,
  fuel_type TEXT,
  
  -- Reason/details
  reason JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Enable RLS on vehicle_events
ALTER TABLE vehicle_events ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies for vehicle_events
CREATE POLICY "Anyone can view vehicle_events" 
  ON vehicle_events FOR SELECT USING (true);

CREATE POLICY "Service role can manage vehicle_events" 
  ON vehicle_events FOR ALL USING (true) WITH CHECK (true);

-- 7. Create indexes for vehicle_events
CREATE INDEX idx_vehicle_events_listing ON vehicle_events(listing_id);
CREATE INDEX idx_vehicle_events_type_date ON vehicle_events(event_type, event_at);
CREATE INDEX idx_vehicle_events_sale ON vehicle_events(is_real_sale) WHERE is_real_sale IS NOT NULL;