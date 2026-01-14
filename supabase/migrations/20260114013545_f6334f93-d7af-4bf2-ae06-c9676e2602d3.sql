-- First create the update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create market_segments table for segment analysis
CREATE TABLE public.market_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',
  avg_price INTEGER,
  median_price INTEGER,
  window_size INTEGER,
  avg_days_on_market NUMERIC,
  courantheid_score INTEGER,
  trend TEXT DEFAULT 'stable' CHECK (trend IN ('up', 'down', 'stable')),
  sales_last_30_days INTEGER DEFAULT 0,
  last_calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create dealer_stats table for dealer performance tracking
CREATE TABLE public.dealer_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID REFERENCES public.dealers(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  listings_count INTEGER DEFAULT 0,
  sold_count INTEGER DEFAULT 0,
  avg_days_on_market NUMERIC,
  avg_price INTEGER,
  total_revenue BIGINT DEFAULT 0,
  top_makes JSONB DEFAULT '[]',
  top_models JSONB DEFAULT '[]',
  price_strategy TEXT CHECK (price_strategy IN ('aggressive', 'market', 'premium')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create watchlist_alerts table for alerts system
CREATE TABLE public.watchlist_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('price_drop', 'courantheid_change', 'new_listing', 'segment_change')),
  segment_id UUID REFERENCES public.market_segments(id) ON DELETE CASCADE,
  dealer_id UUID REFERENCES public.dealers(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE,
  threshold JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  triggered_at TIMESTAMPTZ,
  trigger_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.market_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist_alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies for market_segments
CREATE POLICY "Anyone can view market_segments"
  ON public.market_segments FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage market_segments"
  ON public.market_segments FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS policies for dealer_stats
CREATE POLICY "Anyone can view dealer_stats"
  ON public.dealer_stats FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage dealer_stats"
  ON public.dealer_stats FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS policies for watchlist_alerts
CREATE POLICY "Anyone can view watchlist_alerts"
  ON public.watchlist_alerts FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage watchlist_alerts"
  ON public.watchlist_alerts FOR ALL
  USING (true)
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_market_segments_courantheid ON public.market_segments(courantheid_score DESC);
CREATE INDEX idx_market_segments_filters ON public.market_segments USING GIN(filters);
CREATE INDEX idx_dealer_stats_dealer_period ON public.dealer_stats(dealer_id, period_start, period_end);
CREATE INDEX idx_watchlist_alerts_active ON public.watchlist_alerts(is_active) WHERE is_active = true;
CREATE INDEX idx_watchlist_alerts_segment ON public.watchlist_alerts(segment_id) WHERE segment_id IS NOT NULL;

-- Trigger for updated_at on market_segments
CREATE TRIGGER update_market_segments_updated_at
  BEFORE UPDATE ON public.market_segments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();