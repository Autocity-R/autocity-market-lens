// ===== DATA SOURCE SWITCH =====
export type DataSource = 'mock' | 'db' | 'api';

// ===== RAW SCRAPER OUTPUT =====
export interface RawScrapedListing {
  source: 'gaspedaal' | 'autoscout24' | 'marktplaats' | 'autotrack';
  url: string;
  portal_listing_id: string | null;
  scraped_at: string;

  raw_title: string;
  raw_price: string;
  raw_mileage: string;
  raw_year: string;
  raw_specs: {
    brandstof: string | null;
    transmissie: string | null;
    vermogen: string | null;
    carrosserie: string | null;
    kleur: string | null;
    deuren: string | null;
    kenteken: string | null;
    opties: string | null;
  };

  dealer: {
    name: string | null;
    city: string | null;
    dealer_page_url: string | null;
  };

  content_hash: string;
}

// ===== LISTING (Current State - UI Model) =====
export interface ScraperListing {
  id: string;
  url: string;
  source: string;
  
  // Display
  title: string;
  make: string | null;
  model: string | null;
  year: number | null;
  mileage: number | null;
  price: number | null;
  previousPrice: number | null;
  
  fuelType: string | null;
  transmission: string | null;
  powerPk: number | null;
  
  // Enhanced vehicle data
  bodyType: string | null;
  color: string | null;
  doors: number | null;
  registrationDate: string | null;
  licensePlate: string | null;
  optionsRaw: string | null;
  
  // Dealer
  dealerId: string | null;
  dealerName: string | null;
  dealerCity: string | null;
  
  // Lifecycle - only 'active' | 'gone' as per requirements
  status: 'active' | 'gone';
  firstSeenAt: string;
  lastSeenAt: string;
  daysOnMarket: number;
  
  // Normalization
  isNormalized: boolean;
  normalizationConfidence: number | null;
  
  // Courantheid
  courantheidScore: number | null;
  courantheidTrend: 'up' | 'down' | 'stable' | null;

  // Sitemap/Discovery tracking
  vehicleFingerprint: string | null;
  sitemapLastmod: string | null;
}

// ===== LISTING SNAPSHOT =====
export interface ListingSnapshot {
  id: string;
  listingId: string;
  capturedAt: string;
  
  price: number | null;
  mileage: number | null;
  status: 'active' | 'gone';
  
  priceChanged: boolean;
  mileageChanged: boolean;
  statusChanged: boolean;
  priceDelta: number | null;
}

// ===== DEALER (with hard keys for matching) =====
export interface ScraperDealer {
  id: string;
  
  // Hard keys (priority for matching)
  dealerPageUrl: string | null;
  dealerWebsiteUrl: string | null;
  
  // Soft keys (fallback)
  nameRaw: string;
  nameNormalized: string | null;
  city: string | null;
  
  // Computed stats
  activeListingsCount: number;
  avgDaysOnMarket: number | null;
  avgPriceVsMarket: number | null;
  avgCourantheid: number | null;
  pricingStrategy: 'aggressive' | 'market' | 'premium' | null;
}

// ===== SCRAPER JOB =====
export interface ScraperJob {
  id: string;
  source: string;
  jobType: 'discovery' | 'deep_sync' | 'lifecycle_check';
  
  // Fixed status set: pending | running | completed | failed
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string | null;
  completedAt: string | null;
  durationSeconds: number | null;
  
  stats: {
    pagesProcessed: number;
    listingsFound: number;
    listingsNew: number;
    listingsUpdated: number;
    listingsGone: number;
    errorsCount: number;
  };
  
  // Safety/Quality metrics
  creditsUsed: number | null;
  sitemapRequests: number | null;
  detailRequests: number | null;
  parseSuccessRate: number | null;
  errorRate: number | null;
  stopReason: string | null;
  
  errorLog: Array<{
    timestamp: string;
    message: string;
    url?: string;
  }>;
  
  triggeredBy: 'scheduler' | 'manual' | 'api';
  createdAt: string;
}

// ===== SCRAPER CONFIG =====
export interface ScraperConfig {
  source: string;
  enabled: boolean;
  paused: boolean;
  
  discoveryFrequencyMinutes: number;
  maxPagesPerRun: number;
  maxListingsPerRun: number;
  delayBetweenRequestsMs: number;
  goneAfterConsecutiveMisses: number;
  
  // Safety limits
  maxCreditsPerDay: number;
  errorRateThreshold: number;
  parseQualityThreshold: number;
}

// ===== SCRAPER STATUS RESPONSE =====
export interface ScraperStatusResponse {
  config: ScraperConfig;
  recentJobs: ScraperJob[];
  stats: {
    totalListings: number;
    activeListings: number;
    goneListings: number;
    lastDiscovery: string | null;
    lastDeepSync: string | null;
  };
  creditUsage: {
    today: number;
    limit: number;
    percentage: number;
  };
}

// ===== CREDIT USAGE =====
export interface ScraperCreditUsage {
  id: string;
  date: string;
  source: string;
  creditsUsed: number;
  sitemapRequests: number;
  detailRequests: number;
  jobsCount: number;
}

// ===== LISTINGS RESPONSE =====
export interface ListingsResponse {
  data: ScraperListing[];
  total: number;
  hasMore: boolean;
}

// ===== LISTINGS FILTERS =====
export interface ListingsFilters {
  status?: 'active' | 'gone' | 'all';
  source?: string;
  make?: string;
  model?: string;
  yearFrom?: number;
  yearTo?: number;
  mileageFrom?: number;
  mileageTo?: number;
  fuelType?: string[];
  transmission?: string;
  bodyType?: string;
  color?: string;
}
