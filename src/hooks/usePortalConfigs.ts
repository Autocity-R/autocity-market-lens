import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

export interface PortalSettings {
  max_pages: number;
  max_listings: number;
  delay_ms: number;
}

export interface PortalConfig {
  id: string;
  portal_id: string;
  name: string;
  enabled: boolean;
  frequency_minutes: number;
  priority: number;
  last_success_at: string | null;
  settings: PortalSettings;
  created_at: string;
  updated_at: string;
}

function parseSettings(settings: Json): PortalSettings {
  if (typeof settings === 'object' && settings !== null && !Array.isArray(settings)) {
    const obj = settings as Record<string, unknown>;
    return {
      max_pages: typeof obj.max_pages === 'number' ? obj.max_pages : 10,
      max_listings: typeof obj.max_listings === 'number' ? obj.max_listings : 500,
      delay_ms: typeof obj.delay_ms === 'number' ? obj.delay_ms : 1500,
    };
  }
  return { max_pages: 10, max_listings: 500, delay_ms: 1500 };
}

export function usePortalConfigs() {
  return useQuery({
    queryKey: ['portal-configs'],
    queryFn: async (): Promise<PortalConfig[]> => {
      const { data, error } = await supabase
        .from('portal_configs')
        .select('*')
        .order('priority', { ascending: true });

      if (error) throw error;
      
      return (data || []).map(row => ({
        ...row,
        settings: parseSettings(row.settings)
      }));
    },
  });
}

export function useUpdatePortalConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      portalId, 
      updates 
    }: { 
      portalId: string; 
      updates: { 
        enabled?: boolean; 
        frequency_minutes?: number; 
        priority?: number; 
        settings?: PortalSettings 
      } 
    }) => {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.enabled !== undefined) dbUpdates.enabled = updates.enabled;
      if (updates.frequency_minutes !== undefined) dbUpdates.frequency_minutes = updates.frequency_minutes;
      if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
      if (updates.settings !== undefined) dbUpdates.settings = updates.settings as unknown as Json;

      const { error } = await supabase
        .from('portal_configs')
        .update(dbUpdates)
        .eq('portal_id', portalId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-configs'] });
    },
    onError: (error) => {
      toast.error('Fout bij opslaan', {
        description: error.message,
      });
    },
  });
}

export function useBulkUpdatePortalConfigs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (configs: Array<{ 
      portalId: string; 
      updates: { 
        enabled?: boolean; 
        frequency_minutes?: number; 
        priority?: number; 
        settings?: PortalSettings 
      } 
    }>) => {
      const promises = configs.map(({ portalId, updates }) => {
        const dbUpdates: Record<string, unknown> = {};
        if (updates.enabled !== undefined) dbUpdates.enabled = updates.enabled;
        if (updates.frequency_minutes !== undefined) dbUpdates.frequency_minutes = updates.frequency_minutes;
        if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
        if (updates.settings !== undefined) dbUpdates.settings = updates.settings as unknown as Json;

        return supabase
          .from('portal_configs')
          .update(dbUpdates)
          .eq('portal_id', portalId);
      });

      const results = await Promise.all(promises);
      
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw new Error(`${errors.length} updates failed`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-configs'] });
      toast.success('Portal configuraties opgeslagen');
    },
    onError: (error) => {
      toast.error('Fout bij opslaan', {
        description: error.message,
      });
    },
  });
}

export function useResetPortalConfigs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const defaults = [
        { portal_id: 'autotrack', enabled: true, frequency_minutes: 240, priority: 1, settings: { max_pages: 10, max_listings: 500, delay_ms: 1500 } },
        { portal_id: 'autoscout24', enabled: true, frequency_minutes: 240, priority: 2, settings: { max_pages: 10, max_listings: 500, delay_ms: 1500 } },
        { portal_id: 'autoweek', enabled: false, frequency_minutes: 360, priority: 3, settings: { max_pages: 5, max_listings: 200, delay_ms: 2000 } },
        { portal_id: 'gaspedaal', enabled: true, frequency_minutes: 240, priority: 1, settings: { max_pages: 10, max_listings: 500, delay_ms: 1500 } },
        { portal_id: 'marktplaats', enabled: true, frequency_minutes: 180, priority: 1, settings: { max_pages: 15, max_listings: 750, delay_ms: 1000 } },
      ];

      const promises = defaults.map(d =>
        supabase
          .from('portal_configs')
          .update({
            enabled: d.enabled,
            frequency_minutes: d.frequency_minutes,
            priority: d.priority,
            settings: d.settings,
          })
          .eq('portal_id', d.portal_id)
      );

      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-configs'] });
      toast.success('Portal configuraties gereset naar defaults');
    },
    onError: (error) => {
      toast.error('Fout bij resetten', {
        description: error.message,
      });
    },
  });
}
