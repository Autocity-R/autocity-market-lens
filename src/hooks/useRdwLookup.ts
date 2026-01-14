import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RdwVehicle {
  licensePlate: string;
  make: string;
  model: string;
  year: number;
  fuelType: string;
  transmission: string;
  bodyType: string;
  power?: {
    hp: number;
    kw: number;
  };
  color?: string;
  doors: number;
}

export interface RdwLookupResult {
  success: boolean;
  vehicle?: RdwVehicle;
  error?: string;
}

export function useRdwLookup() {
  return useMutation({
    mutationFn: async (licensePlate: string): Promise<RdwLookupResult> => {
      const { data, error } = await supabase.functions.invoke('rdw-lookup', {
        body: { licensePlate },
      });

      if (error) throw error;
      return data as RdwLookupResult;
    },
  });
}
