import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type DataSource = 'rdw' | 'inferred' | 'missing';

export interface VehicleField<T> {
  value: T;
  source: DataSource;
  confidence?: number;
  note?: string;
}

export interface RdwVehicleExtended {
  licensePlate: string;
  make: VehicleField<string>;
  model: VehicleField<string>;
  year: VehicleField<number>;
  fuelType: VehicleField<string>;
  transmission: VehicleField<string>;
  bodyType: VehicleField<string>;
  power: VehicleField<{ hp: number; kw: number } | null>;
  color: VehicleField<string | null>;
  doors: VehicleField<number>;
}

// Legacy interface for backward compatibility
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
  vehicle?: RdwVehicleExtended;
  error?: string;
}

// Helper to convert extended vehicle to simple vehicle
export function toSimpleVehicle(extended: RdwVehicleExtended): RdwVehicle {
  return {
    licensePlate: extended.licensePlate,
    make: extended.make.value,
    model: extended.model.value,
    year: extended.year.value,
    fuelType: extended.fuelType.value,
    transmission: extended.transmission.value,
    bodyType: extended.bodyType.value,
    power: extended.power.value || undefined,
    color: extended.color.value || undefined,
    doors: extended.doors.value,
  };
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
