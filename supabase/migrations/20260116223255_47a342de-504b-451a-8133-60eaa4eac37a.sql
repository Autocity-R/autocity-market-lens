-- Create portal_configs table for portal-specific settings
CREATE TABLE public.portal_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  portal_id text NOT NULL UNIQUE,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  frequency_minutes integer NOT NULL DEFAULT 240,
  priority integer NOT NULL DEFAULT 1,
  last_success_at timestamp with time zone,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create system_settings table for global settings
CREATE TABLE public.system_settings (
  key text NOT NULL PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.portal_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for portal_configs
CREATE POLICY "Anyone can view portal_configs" 
ON public.portal_configs 
FOR SELECT 
USING (true);

CREATE POLICY "Service role can manage portal_configs" 
ON public.portal_configs 
FOR ALL 
USING (true)
WITH CHECK (true);

-- RLS policies for system_settings
CREATE POLICY "Anyone can view system_settings" 
ON public.system_settings 
FOR SELECT 
USING (true);

CREATE POLICY "Service role can manage system_settings" 
ON public.system_settings 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Trigger for updated_at on portal_configs
CREATE TRIGGER update_portal_configs_updated_at
BEFORE UPDATE ON public.portal_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on system_settings
CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default portal configurations
INSERT INTO public.portal_configs (portal_id, name, enabled, frequency_minutes, priority, settings) VALUES
('autotrack', 'AutoTrack', true, 240, 1, '{"max_pages": 10, "max_listings": 500, "delay_ms": 1500}'::jsonb),
('autoscout24', 'AutoScout24', true, 240, 2, '{"max_pages": 10, "max_listings": 500, "delay_ms": 1500}'::jsonb),
('autoweek', 'AutoWeek', false, 360, 3, '{"max_pages": 5, "max_listings": 200, "delay_ms": 2000}'::jsonb),
('gaspedaal', 'Gaspedaal', true, 240, 1, '{"max_pages": 10, "max_listings": 500, "delay_ms": 1500}'::jsonb),
('marktplaats', 'Marktplaats', true, 180, 1, '{"max_pages": 15, "max_listings": 750, "delay_ms": 1000}'::jsonb);

-- Insert default system settings
INSERT INTO public.system_settings (key, value) VALUES
('api_rate_limit', '{"value": 100}'::jsonb),
('api_timeout', '{"value": 30}'::jsonb),
('debug_mode', '{"value": false}'::jsonb);