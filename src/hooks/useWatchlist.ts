import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface WatchlistAlert {
  id: string;
  alert_type: 'price_drop' | 'courantheid_change' | 'new_listing' | 'segment_change';
  segment_id: string | null;
  dealer_id: string | null;
  listing_id: string | null;
  threshold: Record<string, any>;
  is_active: boolean;
  triggered_at: string | null;
  trigger_data: Record<string, any>;
  created_at: string;
  // Joined data
  segment_name?: string;
  dealer_name?: string;
}

export function useWatchlistAlerts() {
  return useQuery({
    queryKey: ['watchlist-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('watchlist_alerts')
        .select(`
          *,
          market_segments(name),
          dealers(name_raw, name_normalized)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return data.map((alert: any) => ({
        ...alert,
        segment_name: alert.market_segments?.name,
        dealer_name: alert.dealers?.name_raw || alert.dealers?.name_normalized,
      }));
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useTriggeredAlerts() {
  return useQuery({
    queryKey: ['triggered-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('watchlist_alerts')
        .select(`
          *,
          market_segments(name),
          dealers(name_raw, name_normalized)
        `)
        .not('triggered_at', 'is', null)
        .order('triggered_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      return data.map((alert: any) => ({
        ...alert,
        segment_name: alert.market_segments?.name,
        dealer_name: alert.dealers?.name_raw || alert.dealers?.name_normalized,
      }));
    },
    staleTime: 1000 * 60 * 2,
  });
}

interface CreateAlertParams {
  alert_type: WatchlistAlert['alert_type'];
  segment_id?: string;
  dealer_id?: string;
  threshold?: Record<string, any>;
}

export function useCreateAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateAlertParams) => {
      const { data, error } = await supabase
        .from('watchlist_alerts')
        .insert({
          alert_type: params.alert_type,
          segment_id: params.segment_id || null,
          dealer_id: params.dealer_id || null,
          threshold: params.threshold || {},
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist-alerts'] });
      toast.success('Alert toegevoegd');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Fout bij toevoegen alert');
    },
  });
}

export function useDeleteAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from('watchlist_alerts')
        .delete()
        .eq('id', alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['triggered-alerts'] });
      toast.success('Alert verwijderd');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Fout bij verwijderen alert');
    },
  });
}

export function useToggleAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ alertId, isActive }: { alertId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('watchlist_alerts')
        .update({ is_active: isActive })
        .eq('id', alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist-alerts'] });
    },
  });
}

export function useDismissAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from('watchlist_alerts')
        .update({ 
          triggered_at: null, 
          trigger_data: {} 
        })
        .eq('id', alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['triggered-alerts'] });
    },
  });
}
