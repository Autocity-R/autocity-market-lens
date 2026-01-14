import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ValuationRequest {
  make: string;
  model: string;
  year: number;
  mileage: number;
  fuelType: string;
  transmission?: string;
  bodyType?: string;
  options?: string[];
  condition?: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface Comparable {
  title: string;
  price: number;
  mileage: number;
  daysOnMarket: number;
  soldAt?: string;
  isSold: boolean;
}

export interface ValuationResult {
  estimatedValue: number;
  confidence: number;
  priceRange: {
    low: number;
    mid: number;
    high: number;
  };
  comparables: Comparable[];
  marketInsight: string;
  optionsAdjustment: number;
  windowSize: number;
  avgDaysOnMarket: number;
}

export function useValuation() {
  return useMutation({
    mutationFn: async (request: ValuationRequest): Promise<ValuationResult> => {
      const { data, error } = await supabase.functions.invoke('valuate-vehicle', {
        body: request,
      });

      if (error) throw error;
      
      // Handle error response from edge function
      if (data.error) {
        throw new Error(data.error);
      }

      return data as ValuationResult;
    },
  });
}
