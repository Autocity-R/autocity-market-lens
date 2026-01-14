import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface VehicleValuesFilters {
  make?: string;
  model?: string;
  year?: number;
  fuelType?: string;
}

export interface OptionItem {
  value: string;
  label: string;
  brands: string[];
}

export interface OptionsCategory {
  label: string;
  options: OptionItem[];
}

export type OptionsDatabase = Record<string, OptionsCategory>;

export function useVehicleMakes() {
  return useQuery({
    queryKey: ['vehicle-values', 'makes'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('vehicle-values', {
        body: { type: 'makes' },
      });
      if (error) throw error;
      return data.values as string[];
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

export function useVehicleModels(make: string | undefined) {
  return useQuery({
    queryKey: ['vehicle-values', 'models', make],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('vehicle-values', {
        body: { type: 'models', filters: { make } },
      });
      if (error) throw error;
      return data.values as string[];
    },
    enabled: !!make,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}

export function useVehicleFuels() {
  return useQuery({
    queryKey: ['vehicle-values', 'fuels'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('vehicle-values', {
        body: { type: 'fuels' },
      });
      if (error) throw error;
      return data.values as string[];
    },
    staleTime: 1000 * 60 * 60,
  });
}

export function useVehicleTransmissions() {
  return useQuery({
    queryKey: ['vehicle-values', 'transmissions'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('vehicle-values', {
        body: { type: 'transmissions' },
      });
      if (error) throw error;
      return data.values as string[];
    },
    staleTime: 1000 * 60 * 60,
  });
}

export function useVehicleBodyTypes() {
  return useQuery({
    queryKey: ['vehicle-values', 'bodyTypes'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('vehicle-values', {
        body: { type: 'bodyTypes' },
      });
      if (error) throw error;
      return data.values as string[];
    },
    staleTime: 1000 * 60 * 60,
  });
}

export function useVehicleYears() {
  return useQuery({
    queryKey: ['vehicle-values', 'years'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('vehicle-values', {
        body: { type: 'years' },
      });
      if (error) throw error;
      return data.values as number[];
    },
    staleTime: 1000 * 60 * 60,
  });
}

export function useVehicleOptions(make: string | undefined) {
  return useQuery({
    queryKey: ['vehicle-values', 'options', make],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('vehicle-values', {
        body: { type: 'options', filters: { make } },
      });
      if (error) throw error;
      return data.values as OptionsDatabase;
    },
    enabled: !!make,
    staleTime: 1000 * 60 * 30,
  });
}
