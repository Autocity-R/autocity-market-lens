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

export interface CourantheidResult {
  score: number;
  label: string;
  sellThroughRate: number;
  avgDaysToSell: number;
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

export interface PriceBreakdown {
  livePriceMedian: number;
  soldPriceMedian: number;
  weightedSalesPrice: number;
  clusterMedian: number;
  lowestRealistic: number;
  optionsAdjustment: number;
  courantheidAdjustment: number;
  trendAdjustment: number;
  baseValue: number;
  finalValue: number;
}

export interface QualityAssessment {
  quality: 'excellent' | 'good' | 'fair' | 'limited';
  warnings: string[];
  cohortCriteria: { yearRange: number; mileageRange: number };
}

export interface ValuationResult {
  estimatedValue: number;
  confidence: number;
  priceBreakdown: PriceBreakdown;
  priceRange: {
    low: number;
    mid: number;
    high: number;
  };
  courantheid: CourantheidResult;
  marketTrend: MarketTrend;
  comparables: Comparable[];
  outliers: Comparable[];
  optionsAnalysis: OptionsAnalysis;
  marketInsight: string;
  risks: string[];
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
      
      // Handle error response from edge function
      if (data.error) {
        throw new Error(data.error);
      }

      return data as ValuationResult;
    },
  });
}
