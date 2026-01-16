import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SystemSettings {
  api_rate_limit: number;
  api_timeout: number;
  debug_mode: boolean;
}

interface SystemSettingRow {
  key: string;
  value: { value: number | boolean };
  updated_at: string;
}

export function useSystemSettings() {
  return useQuery({
    queryKey: ['system-settings'],
    queryFn: async (): Promise<SystemSettings> => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*');

      if (error) throw error;

      const settings: SystemSettings = {
        api_rate_limit: 100,
        api_timeout: 30,
        debug_mode: false,
      };

      (data as SystemSettingRow[] || []).forEach(row => {
        const value = row.value?.value;
        switch (row.key) {
          case 'api_rate_limit':
            settings.api_rate_limit = typeof value === 'number' ? value : 100;
            break;
          case 'api_timeout':
            settings.api_timeout = typeof value === 'number' ? value : 30;
            break;
          case 'debug_mode':
            settings.debug_mode = typeof value === 'boolean' ? value : false;
            break;
        }
      });

      return settings;
    },
  });
}

export function useUpdateSystemSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: number | boolean }) => {
      const { error } = await supabase
        .from('system_settings')
        .update({ value: { value } })
        .eq('key', key);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
    },
    onError: (error) => {
      toast.error('Fout bij opslaan', {
        description: error.message,
      });
    },
  });
}

export function useBulkUpdateSystemSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Partial<SystemSettings>) => {
      const updates = Object.entries(settings).map(([key, value]) => ({
        key: key === 'api_rate_limit' ? 'api_rate_limit' : 
             key === 'api_timeout' ? 'api_timeout' : 
             key === 'debug_mode' ? 'debug_mode' : key,
        value,
      }));

      const promises = updates.map(({ key, value }) =>
        supabase
          .from('system_settings')
          .update({ value: { value } })
          .eq('key', key)
      );

      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      toast.success('Systeem instellingen opgeslagen');
    },
    onError: (error) => {
      toast.error('Fout bij opslaan', {
        description: error.message,
      });
    },
  });
}
