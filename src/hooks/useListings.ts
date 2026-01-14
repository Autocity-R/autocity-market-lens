import { useQuery } from '@tanstack/react-query';
import { useDataSource } from '@/providers/DataSourceProvider';
import { supabase } from '@/integrations/supabase/client';
import { mockListings } from '@/lib/mockData';
import type { ScraperListing, ListingsFilters, ListingsResponse } from '@/types/scraper';

// Transform mock listing to ScraperListing format
function transformMockListing(listing: typeof mockListings[0]): ScraperListing {
  return {
    id: listing.id,
    url: `https://example.com/listing/${listing.id}`,
    source: listing.portal.toLowerCase(),
    title: listing.title,
    make: listing.make,
    model: listing.model,
    year: listing.year,
    mileage: listing.mileage,
    price: listing.price,
    previousPrice: listing.previousPrice || null,
    fuelType: listing.fuelType,
    transmission: listing.transmission,
    powerPk: null,
    bodyType: null,
    color: null,
    doors: null,
    registrationDate: null,
    licensePlate: null,
    optionsRaw: null,
    dealerId: listing.dealerId,
    dealerName: listing.dealer,
    dealerCity: null,
    status: listing.status === 'active' ? 'active' : 'gone',
    firstSeenAt: listing.firstSeen,
    lastSeenAt: listing.lastUpdated,
    daysOnMarket: listing.daysOnMarket,
    isNormalized: listing.isNormalized,
    normalizationConfidence: listing.confidenceScore,
    courantheidScore: listing.courantheid,
    courantheidTrend: listing.courantheidTrend,
    vehicleFingerprint: null,
    sitemapLastmod: null,
  };
}

// Transform DB row to ScraperListing format
function transformDBListing(row: {
  id: string;
  url: string;
  source: string;
  title: string;
  make: string | null;
  model: string | null;
  year: number | null;
  mileage: number | null;
  price: number | null;
  previous_price: number | null;
  fuel_type: string | null;
  transmission: string | null;
  power_pk: number | null;
  body_type: string | null;
  color: string | null;
  doors: number | null;
  registration_date: string | null;
  license_plate: string | null;
  options_raw: string | null;
  dealer_id: string | null;
  dealer_name: string | null;
  dealer_city: string | null;
  status: string;
  first_seen_at: string;
  last_seen_at: string;
  is_normalized: boolean | null;
  normalization_confidence: number | null;
  courantheid_score: number | null;
  courantheid_trend: string | null;
  vehicle_fingerprint: string | null;
  sitemap_lastmod: string | null;
}): ScraperListing {
  const firstSeenDate = new Date(row.first_seen_at);
  const daysOnMarket = Math.floor((Date.now() - firstSeenDate.getTime()) / (1000 * 60 * 60 * 24));
  
  return {
    id: row.id,
    url: row.url,
    source: row.source,
    title: row.title,
    make: row.make,
    model: row.model,
    year: row.year,
    mileage: row.mileage,
    price: row.price,
    previousPrice: row.previous_price,
    fuelType: row.fuel_type,
    transmission: row.transmission,
    powerPk: row.power_pk,
    bodyType: row.body_type,
    color: row.color,
    doors: row.doors,
    registrationDate: row.registration_date,
    licensePlate: row.license_plate,
    optionsRaw: row.options_raw,
    dealerId: row.dealer_id,
    dealerName: row.dealer_name,
    dealerCity: row.dealer_city,
    status: row.status as 'active' | 'gone',
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    daysOnMarket,
    isNormalized: row.is_normalized || false,
    normalizationConfidence: row.normalization_confidence,
    courantheidScore: row.courantheid_score,
    courantheidTrend: row.courantheid_trend as 'up' | 'down' | 'stable' | null,
    vehicleFingerprint: row.vehicle_fingerprint,
    sitemapLastmod: row.sitemap_lastmod,
  };
}

// Mock data fetcher
async function fetchMock(filters: ListingsFilters): Promise<ListingsResponse> {
  await new Promise(r => setTimeout(r, 200));
  
  let data = mockListings.map(transformMockListing);
  
  // Apply filters
  if (filters.status && filters.status !== 'all') {
    data = data.filter(l => l.status === filters.status);
  }
  if (filters.source) {
    data = data.filter(l => l.source === filters.source?.toLowerCase());
  }
  if (filters.make) {
    data = data.filter(l => l.make === filters.make);
  }
  if (filters.model) {
    data = data.filter(l => l.model === filters.model);
  }
  if (filters.yearFrom) {
    data = data.filter(l => l.year && l.year >= filters.yearFrom!);
  }
  if (filters.yearTo) {
    data = data.filter(l => l.year && l.year <= filters.yearTo!);
  }
  
  return {
    data,
    total: data.length,
    hasMore: false,
  };
}

// Database fetcher - real Supabase queries
async function fetchDB(filters: ListingsFilters): Promise<ListingsResponse> {
  let query = supabase
    .from('listings')
    .select('*', { count: 'exact' });
  
  // Apply filters
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  if (filters.source) {
    query = query.eq('source', filters.source);
  }
  if (filters.make) {
    query = query.ilike('make', `%${filters.make}%`);
  }
  if (filters.model) {
    query = query.ilike('model', `%${filters.model}%`);
  }
  if (filters.yearFrom) {
    query = query.gte('year', filters.yearFrom);
  }
  if (filters.yearTo) {
    query = query.lte('year', filters.yearTo);
  }
  if (filters.mileageFrom) {
    query = query.gte('mileage', filters.mileageFrom);
  }
  if (filters.mileageTo) {
    query = query.lte('mileage', filters.mileageTo);
  }
  if (filters.fuelType && filters.fuelType.length > 0) {
    query = query.in('fuel_type', filters.fuelType);
  }
  if (filters.transmission) {
    query = query.eq('transmission', filters.transmission);
  }
  
  const { data, error, count } = await query
    .order('last_seen_at', { ascending: false })
    .limit(100);
  
  if (error) {
    console.error('Error fetching listings from DB:', error);
    throw error;
  }
  
  return {
    data: (data || []).map(transformDBListing),
    total: count || 0,
    hasMore: (count || 0) > 100,
  };
}

// API fetcher - placeholder for future
async function fetchAPI(filters: ListingsFilters): Promise<ListingsResponse> {
  // TODO: Implement API fetcher when needed
  return fetchMock(filters);
}

// Main hook
export function useListings(filters: ListingsFilters = {}) {
  const { dataSource } = useDataSource();
  
  const fetcher = dataSource === 'db' ? fetchDB :
                  dataSource === 'api' ? fetchAPI :
                  fetchMock;
  
  return useQuery({
    queryKey: ['listings', filters, dataSource],
    queryFn: () => fetcher(filters),
    staleTime: 30000,
  });
}
