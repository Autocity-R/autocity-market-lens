import { useQuery } from '@tanstack/react-query';
import { useDataSource } from '@/providers/DataSourceProvider';
import { mockListings } from '@/lib/mockData';
import type { ListingsFilters, ListingsResponse, ScraperListing } from '@/types/scraper';

// Transform mock data to ScraperListing format
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
  };
}

// Mock fetcher
async function fetchMock(filters: ListingsFilters): Promise<ListingsResponse> {
  await new Promise(r => setTimeout(r, 200));
  
  let data = mockListings.map(transformMockListing);
  
  // Apply filters
  if (filters.status && filters.status !== 'all') {
    data = data.filter(l => l.status === filters.status);
  }
  if (filters.source) {
    data = data.filter(l => l.source === filters.source.toLowerCase());
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

// DB fetcher (Supabase - later implementation)
async function fetchDB(filters: ListingsFilters): Promise<ListingsResponse> {
  // TODO: Implement Supabase query
  console.log('DB fetch not implemented yet, falling back to mock');
  return fetchMock(filters);
}

// API fetcher (later implementation)
async function fetchAPI(filters: ListingsFilters): Promise<ListingsResponse> {
  // TODO: Implement API call
  console.log('API fetch not implemented yet, falling back to mock');
  return fetchMock(filters);
}

export function useListings(filters: ListingsFilters = {}) {
  const { dataSource } = useDataSource();
  
  return useQuery({
    queryKey: ['listings', dataSource, filters],
    queryFn: () => {
      switch (dataSource) {
        case 'mock': return fetchMock(filters);
        case 'db': return fetchDB(filters);
        case 'api': return fetchAPI(filters);
      }
    },
  });
}
