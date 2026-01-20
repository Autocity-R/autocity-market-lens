-- Add trim/uitvoering tracking columns to listings
ALTER TABLE listings ADD COLUMN IF NOT EXISTS trim TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS trim_confidence TEXT;

-- Add index for detail healing queue efficiency
CREATE INDEX IF NOT EXISTS idx_listings_detail_healing 
ON listings (detail_status, first_seen_at) 
WHERE detail_status = 'pending' AND outbound_sources IS NOT NULL;