import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ValuationRequest {
  licensePlate?: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
  fuelType: string;
  transmission?: string;
  bodyType?: string;
  power?: {
    kw?: number;
    hp?: number;
  };
  options?: string[];
}

export interface Comparable {
  id: string;
  title: string;
  price: number;
  mileage: number;
  daysOnMarket: number;
  soldAt?: string;
  isSold: boolean;
  optionsMatchScore?: number;
  isOutlier?: boolean;
}

export interface Courantheid3D {
  score: number;
  label: string;
  sellThroughRate: number;
  marketDaysSupply: number;
  avgDaysOnMarket: number;
  supplyStatus: 'undersupplied' | 'balanced' | 'oversupplied';
  priceImpact: number;
}

export interface MarketTrend {
  percentage: number;
  direction: 'rising' | 'falling' | 'stable';
  period: string;
}

export interface OptionsAnalysis {
  matchScore: number;
  adjustments: { option: string; label: string; value: number }[];
  totalAdjustment: number;
}

export interface MileageAdjustment {
  value: number;
  b_used: number;
  km_ref: number;
  n_used: number;
  source: 'sold' | 'combined' | 'fallback' | 'none';
  warning?: string;
}

export interface ValueRange {
  low: number;
  mid: number;
  high: number;
}

export interface PriceBreakdown {
  cohortLevel: 1 | 2 | 3;
  cohortSizeLive: number;
  cohortSizeSold: number;
  LMV: number;
  LMV_raw: number;
  OEV: number;
  lowestRealisticPrice: number;
  weightedBase: number;
  mileageAdjustment: MileageAdjustment;
  optionsAdjustment: number;
  courantheidPriceImpact: number;
  finalValue: number;
}

export interface Confidence {
  score: number;
  reason: string;
}

export interface QualityAssessment {
  quality: 'excellent' | 'good' | 'fair' | 'limited';
  warnings: string[];
}

export interface ValuationResult {
  tradeInValue: ValueRange;
  fairMarketValue: ValueRange;
  retailValue: ValueRange;
  confidence: Confidence;
  warnings: string[];
  breakdown: PriceBreakdown;
  courantheid: Courantheid3D;
  comparables: Comparable[];
  outliers: Comparable[];
  marketTrend: MarketTrend;
  optionsAnalysis: OptionsAnalysis;
  marketInsight: string;
  risks: string[];
  
  // Legacy compatibility
  estimatedValue: number;
  priceRange: ValueRange;
  cohortSize: number;
  salesCount: number;
  dataQuality: QualityAssessment;
}

export function useValuation() {
  return useMutation({
    mutationFn: async (request: ValuationRequest): Promise<ValuationResult> => {
      const { data, error } = await supabase.functions.invoke('valuate-vehicle', {
        body: request,
      });

      if (error) throw error;
      
      if (data.error) {
        throw new Error(data.error);
      }

      return data as ValuationResult;
    },
  });
}
