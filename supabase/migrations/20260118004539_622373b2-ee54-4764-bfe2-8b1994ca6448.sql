-- Create mileage_coefficients table for data-driven km adjustments
CREATE TABLE IF NOT EXISTS mileage_coefficients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_key text NOT NULL,
  year_band text NOT NULL,
  b_eur_per_km numeric NOT NULL,  -- Negatief opgeslagen (prijs daalt per km)
  n_samples integer NOT NULL,
  r_squared numeric,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(model_key, year_band)
);

-- Create index for efficient lookups
CREATE INDEX idx_mileage_coefficients_lookup 
ON mileage_coefficients(model_key, year_band);

-- Enable RLS
ALTER TABLE mileage_coefficients ENABLE ROW LEVEL SECURITY;

-- Create read policy (publicly readable for valuation)
CREATE POLICY "Mileage coefficients are publicly readable" 
ON mileage_coefficients FOR SELECT USING (true);