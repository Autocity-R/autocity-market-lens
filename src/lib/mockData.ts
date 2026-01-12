// Mock data for Autocity Market Intelligence Platform

export interface SegmentFilters {
  make: string;
  model?: string;
  yearFrom: number;
  yearTo: number;
  mileageFrom?: number;
  mileageTo?: number;
  fuelType?: string[];
  transmission?: string;
  powerFrom?: number;
  powerTo?: number;
  batteryFrom?: number;
  batteryTo?: number;
  options?: string[];
}

export interface Listing {
  id: string;
  title: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
  price: number;
  previousPrice?: number;
  fuelType: string;
  transmission: string;
  dealer: string;
  dealerId: string;
  portal: string;
  daysOnMarket: number;
  isNormalized: boolean;
  isEnriched: boolean;
  confidenceScore: number;
  firstSeen: string;
  lastUpdated: string;
  status: 'active' | 'sold' | 'removed';
  courantheid: number;
  courantheidTrend: 'up' | 'down' | 'stable';
}

export interface Dealer {
  id: string;
  name: string;
  location: string;
  activeListings: number;
  avgDaysOnMarket: number;
  avgPriceVsMarket: number;
  soldLastMonth: number;
  pricingStrategy: 'aggressive' | 'market' | 'premium';
  responseTime: string;
  avgCourantheid: number;
}

export interface MarketSegment {
  id: string;
  name: string;
  make: string;
  model?: string;
  yearFrom: number;
  yearTo: number;
  count: number;
  avgPrice: number;
  priceChange7d: number;
  courantheid: number;
  courantheidTrend: 'up' | 'down' | 'stable';
  filters: SegmentFilters;
  avgConfidence: number;
  createdAt: string;
  isWatched: boolean;
  linkedAlerts: number;
  linkedToInventory: boolean;
}

export interface Alert {
  id: string;
  type: 'price_drop' | 'new_listing' | 'segment_change' | 'competitor' | 'inventory' | 'segment' | 'listing' | 'dealer';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
  isRead: boolean;
  segmentId?: string;
  segmentName?: string;
  dealerId?: string;
  dealerName?: string;
}

export interface CrawlerJob {
  id: string;
  portal: string;
  status: 'running' | 'completed' | 'failed' | 'scheduled';
  lastRun: string;
  nextRun: string;
  listingsFound: number;
  errors: number;
}

// Generate mock listings
export const mockListings: Listing[] = [
  {
    id: 'L001',
    title: 'Volkswagen Golf 1.4 TSI Highline',
    make: 'Volkswagen',
    model: 'Golf',
    year: 2021,
    mileage: 45000,
    price: 24950,
    previousPrice: 26450,
    fuelType: 'Benzine',
    transmission: 'Automaat',
    dealer: 'AutoVandaag Amsterdam',
    dealerId: 'D001',
    portal: 'AutoTrack',
    daysOnMarket: 23,
    isNormalized: true,
    isEnriched: true,
    confidenceScore: 94,
    firstSeen: '2024-12-19',
    lastUpdated: '2025-01-10',
    status: 'active',
    courantheid: 87,
    courantheidTrend: 'stable'
  },
  {
    id: 'L002',
    title: 'BMW 320i M Sport',
    make: 'BMW',
    model: '3 Serie',
    year: 2020,
    mileage: 62000,
    price: 32500,
    fuelType: 'Benzine',
    transmission: 'Automaat',
    dealer: 'Premium Cars Utrecht',
    dealerId: 'D002',
    portal: 'AutoScout24',
    daysOnMarket: 45,
    isNormalized: true,
    isEnriched: true,
    confidenceScore: 91,
    firstSeen: '2024-11-27',
    lastUpdated: '2025-01-11',
    status: 'active',
    courantheid: 72,
    courantheidTrend: 'down'
  },
  {
    id: 'L003',
    title: 'Mercedes-Benz C 180 Business Solution',
    make: 'Mercedes-Benz',
    model: 'C-Klasse',
    year: 2019,
    mileage: 78000,
    price: 28750,
    previousPrice: 29500,
    fuelType: 'Benzine',
    transmission: 'Automaat',
    dealer: 'Star Motors Rotterdam',
    dealerId: 'D003',
    portal: 'Marktplaats',
    daysOnMarket: 67,
    isNormalized: true,
    isEnriched: false,
    confidenceScore: 87,
    firstSeen: '2024-11-05',
    lastUpdated: '2025-01-09',
    status: 'active',
    courantheid: 58,
    courantheidTrend: 'down'
  },
  {
    id: 'L004',
    title: 'Audi A4 35 TFSI S-Line',
    make: 'Audi',
    model: 'A4',
    year: 2022,
    mileage: 28000,
    price: 38900,
    fuelType: 'Benzine',
    transmission: 'Automaat',
    dealer: 'Audi Centrum Den Haag',
    dealerId: 'D004',
    portal: 'AutoTrack',
    daysOnMarket: 12,
    isNormalized: true,
    isEnriched: true,
    confidenceScore: 96,
    firstSeen: '2024-12-30',
    lastUpdated: '2025-01-11',
    status: 'active',
    courantheid: 91,
    courantheidTrend: 'up'
  },
  {
    id: 'L005',
    title: 'Toyota RAV4 2.5 Hybrid AWD',
    make: 'Toyota',
    model: 'RAV4',
    year: 2021,
    mileage: 52000,
    price: 36250,
    fuelType: 'Hybride',
    transmission: 'CVT',
    dealer: 'Toyota De Lier',
    dealerId: 'D005',
    portal: 'Gaspedaal',
    daysOnMarket: 8,
    isNormalized: true,
    isEnriched: true,
    confidenceScore: 98,
    firstSeen: '2025-01-03',
    lastUpdated: '2025-01-11',
    status: 'active',
    courantheid: 94,
    courantheidTrend: 'up'
  },
  {
    id: 'L006',
    title: 'Tesla Model 3 Long Range',
    make: 'Tesla',
    model: 'Model 3',
    year: 2022,
    mileage: 35000,
    price: 42500,
    previousPrice: 44900,
    fuelType: 'Elektrisch',
    transmission: 'Automaat',
    dealer: 'EV Specialists Eindhoven',
    dealerId: 'D006',
    portal: 'AutoScout24',
    daysOnMarket: 34,
    isNormalized: true,
    isEnriched: true,
    confidenceScore: 92,
    firstSeen: '2024-12-08',
    lastUpdated: '2025-01-10',
    status: 'active',
    courantheid: 89,
    courantheidTrend: 'stable'
  },
  {
    id: 'L007',
    title: 'Volvo XC60 B5 Momentum',
    make: 'Volvo',
    model: 'XC60',
    year: 2020,
    mileage: 68000,
    price: 34950,
    fuelType: 'Mild-Hybride',
    transmission: 'Automaat',
    dealer: 'Volvo Dealer Groningen',
    dealerId: 'D007',
    portal: 'Marktplaats',
    daysOnMarket: 56,
    isNormalized: false,
    isEnriched: false,
    confidenceScore: 72,
    firstSeen: '2024-11-16',
    lastUpdated: '2025-01-08',
    status: 'active',
    courantheid: 65,
    courantheidTrend: 'down'
  },
  {
    id: 'L008',
    title: 'Peugeot 3008 GT Hybrid',
    make: 'Peugeot',
    model: '3008',
    year: 2023,
    mileage: 15000,
    price: 41500,
    fuelType: 'Plug-in Hybride',
    transmission: 'Automaat',
    dealer: 'Peugeot Partner Arnhem',
    dealerId: 'D008',
    portal: 'AutoTrack',
    daysOnMarket: 5,
    isNormalized: true,
    isEnriched: true,
    confidenceScore: 99,
    firstSeen: '2025-01-06',
    lastUpdated: '2025-01-11',
    status: 'active',
    courantheid: 96,
    courantheidTrend: 'up'
  }
];

export const mockDealers: Dealer[] = [
  {
    id: 'D001',
    name: 'AutoVandaag Amsterdam',
    location: 'Amsterdam',
    activeListings: 127,
    avgDaysOnMarket: 28,
    avgPriceVsMarket: -2.3,
    soldLastMonth: 42,
    pricingStrategy: 'aggressive',
    responseTime: '< 2 uur',
    avgCourantheid: 82
  },
  {
    id: 'D002',
    name: 'Premium Cars Utrecht',
    location: 'Utrecht',
    activeListings: 89,
    avgDaysOnMarket: 45,
    avgPriceVsMarket: 4.5,
    soldLastMonth: 23,
    pricingStrategy: 'premium',
    responseTime: '< 4 uur',
    avgCourantheid: 71
  },
  {
    id: 'D003',
    name: 'Star Motors Rotterdam',
    location: 'Rotterdam',
    activeListings: 156,
    avgDaysOnMarket: 35,
    avgPriceVsMarket: 1.2,
    soldLastMonth: 38,
    pricingStrategy: 'market',
    responseTime: '< 1 dag',
    avgCourantheid: 78
  },
  {
    id: 'D004',
    name: 'Audi Centrum Den Haag',
    location: 'Den Haag',
    activeListings: 78,
    avgDaysOnMarket: 21,
    avgPriceVsMarket: 3.8,
    soldLastMonth: 31,
    pricingStrategy: 'premium',
    responseTime: '< 2 uur',
    avgCourantheid: 88
  },
  {
    id: 'D005',
    name: 'Toyota De Lier',
    location: 'De Lier',
    activeListings: 64,
    avgDaysOnMarket: 18,
    avgPriceVsMarket: -0.5,
    soldLastMonth: 29,
    pricingStrategy: 'market',
    responseTime: '< 4 uur',
    avgCourantheid: 91
  }
];

export const mockSegments: MarketSegment[] = [
  {
    id: 'S001',
    name: 'VW Golf 2020-2023',
    make: 'Volkswagen',
    model: 'Golf',
    yearFrom: 2020,
    yearTo: 2023,
    count: 1247,
    avgPrice: 26340,
    priceChange7d: -1.8,
    courantheid: 87,
    courantheidTrend: 'stable',
    filters: {
      make: 'Volkswagen',
      model: 'Golf',
      yearFrom: 2020,
      yearTo: 2023,
      mileageFrom: 0,
      mileageTo: 100000,
      fuelType: ['Benzine', 'Diesel'],
      transmission: 'Alle'
    },
    avgConfidence: 92,
    createdAt: '2024-12-01',
    isWatched: true,
    linkedAlerts: 2,
    linkedToInventory: true
  },
  {
    id: 'S002',
    name: 'BMW 3 Serie 2019-2022',
    make: 'BMW',
    model: '3 Serie',
    yearFrom: 2019,
    yearTo: 2022,
    count: 892,
    avgPrice: 34520,
    priceChange7d: 0.5,
    courantheid: 82,
    courantheidTrend: 'up',
    filters: {
      make: 'BMW',
      model: '3 Serie',
      yearFrom: 2019,
      yearTo: 2022,
      mileageFrom: 0,
      mileageTo: 120000,
      fuelType: ['Benzine'],
      transmission: 'Automaat'
    },
    avgConfidence: 89,
    createdAt: '2024-11-15',
    isWatched: true,
    linkedAlerts: 1,
    linkedToInventory: false
  },
  {
    id: 'S003',
    name: 'Tesla Model 3 2020-2023',
    make: 'Tesla',
    model: 'Model 3',
    yearFrom: 2020,
    yearTo: 2023,
    count: 634,
    avgPrice: 41890,
    priceChange7d: -3.2,
    courantheid: 91,
    courantheidTrend: 'down',
    filters: {
      make: 'Tesla',
      model: 'Model 3',
      yearFrom: 2020,
      yearTo: 2023,
      mileageFrom: 0,
      mileageTo: 80000,
      fuelType: ['Elektrisch'],
      batteryFrom: 50,
      batteryTo: 100
    },
    avgConfidence: 95,
    createdAt: '2024-10-20',
    isWatched: true,
    linkedAlerts: 3,
    linkedToInventory: true
  },
  {
    id: 'S004',
    name: 'Mercedes C-Klasse 2018-2021',
    make: 'Mercedes-Benz',
    model: 'C-Klasse',
    yearFrom: 2018,
    yearTo: 2021,
    count: 756,
    avgPrice: 29870,
    priceChange7d: -0.8,
    courantheid: 79,
    courantheidTrend: 'stable',
    filters: {
      make: 'Mercedes-Benz',
      model: 'C-Klasse',
      yearFrom: 2018,
      yearTo: 2021,
      mileageFrom: 0,
      mileageTo: 150000,
      fuelType: ['Benzine', 'Diesel'],
      transmission: 'Automaat'
    },
    avgConfidence: 86,
    createdAt: '2024-11-01',
    isWatched: false,
    linkedAlerts: 0,
    linkedToInventory: false
  },
  {
    id: 'S005',
    name: 'SUV Premium 2021-2024',
    make: 'Alle',
    yearFrom: 2021,
    yearTo: 2024,
    count: 2340,
    avgPrice: 52400,
    priceChange7d: 1.2,
    courantheid: 85,
    courantheidTrend: 'up',
    filters: {
      make: 'Alle',
      yearFrom: 2021,
      yearTo: 2024,
      mileageFrom: 0,
      mileageTo: 60000,
      powerFrom: 200,
      powerTo: 400
    },
    avgConfidence: 88,
    createdAt: '2024-12-10',
    isWatched: true,
    linkedAlerts: 1,
    linkedToInventory: true
  }
];

export const mockAlerts: Alert[] = [
  {
    id: 'A001',
    type: 'segment',
    title: 'Grote prijsdaling Tesla Model 3',
    description: 'Segmentprijs -3.2% afgelopen 7 dagen. Markt krimpt sneller dan verwacht.',
    severity: 'warning',
    timestamp: '2025-01-11T09:23:00',
    isRead: false,
    segmentId: 'S003',
    segmentName: 'Tesla Model 3 2020-2023'
  },
  {
    id: 'A002',
    type: 'segment',
    title: 'Segment VW Golf stabiel',
    description: 'Gemiddelde prijs -1.8% afgelopen 7 dagen. Courantheid nog stabiel op 87.',
    severity: 'info',
    timestamp: '2025-01-11T08:00:00',
    isRead: false,
    segmentId: 'S001',
    segmentName: 'VW Golf 2020-2023'
  },
  {
    id: 'A003',
    type: 'dealer',
    title: 'Concurrent onderbieding',
    description: 'AutoVandaag Amsterdam biedt vergelijkbare Golf €1.200 lager aan',
    severity: 'critical',
    timestamp: '2025-01-10T16:45:00',
    isRead: true,
    dealerId: 'D001',
    dealerName: 'AutoVandaag Amsterdam'
  },
  {
    id: 'A004',
    type: 'listing',
    title: 'Voorraad te lang online',
    description: '3 voertuigen staan >60 dagen online zonder prijswijziging',
    severity: 'warning',
    timestamp: '2025-01-10T12:00:00',
    isRead: true
  },
  {
    id: 'A005',
    type: 'listing',
    title: 'Nieuwe listing in watchlist',
    description: 'Audi A4 35 TFSI 2022 toegevoegd door Audi Centrum Den Haag',
    severity: 'info',
    timestamp: '2025-01-10T10:30:00',
    isRead: true
  },
  {
    id: 'A006',
    type: 'segment',
    title: 'Marktgroei SUV Premium',
    description: 'SUV Premium segment groeit +1.2% deze week. 234 nieuwe listings.',
    severity: 'info',
    timestamp: '2025-01-09T14:00:00',
    isRead: true,
    segmentId: 'S005',
    segmentName: 'SUV Premium 2021-2024'
  },
  {
    id: 'A007',
    type: 'dealer',
    title: 'Voorraadverhoging concurrent',
    description: 'Premium Cars Utrecht heeft 12 nieuwe listings toegevoegd (BMW 3 Serie)',
    severity: 'warning',
    timestamp: '2025-01-09T11:30:00',
    isRead: true,
    dealerId: 'D002',
    dealerName: 'Premium Cars Utrecht'
  },
  {
    id: 'A008',
    type: 'listing',
    title: 'Prijsdaling gedetecteerd',
    description: 'Mercedes C 180 2019 bij Star Motors: €750 prijsverlaging',
    severity: 'info',
    timestamp: '2025-01-08T16:00:00',
    isRead: true
  }
];

export const mockCrawlerJobs: CrawlerJob[] = [
  {
    id: 'CJ001',
    portal: 'AutoTrack',
    status: 'completed',
    lastRun: '2025-01-11T08:00:00',
    nextRun: '2025-01-11T12:00:00',
    listingsFound: 12450,
    errors: 3
  },
  {
    id: 'CJ002',
    portal: 'AutoScout24',
    status: 'running',
    lastRun: '2025-01-11T09:30:00',
    nextRun: '2025-01-11T13:30:00',
    listingsFound: 8920,
    errors: 0
  },
  {
    id: 'CJ003',
    portal: 'Marktplaats',
    status: 'scheduled',
    lastRun: '2025-01-11T06:00:00',
    nextRun: '2025-01-11T10:00:00',
    listingsFound: 23100,
    errors: 12
  },
  {
    id: 'CJ004',
    portal: 'Gaspedaal',
    status: 'completed',
    lastRun: '2025-01-11T07:30:00',
    nextRun: '2025-01-11T11:30:00',
    listingsFound: 5670,
    errors: 1
  }
];

// KPI Data
export const kpiData = {
  totalListings: 52340,
  listingsChange: 2.4,
  activeDealers: 1247,
  dealersChange: 1.2,
  avgPrice: 28450,
  priceChange: -1.8,
  normalizedPercentage: 94.2,
  enrichedPercentage: 87.5,
  avgCourantheid: 84,
  courantheidChange: -0.5
};

// Chart data
export const priceHistoryData = [
  { date: 'Dec 1', avgPrice: 29200, volume: 4230 },
  { date: 'Dec 8', avgPrice: 29050, volume: 4450 },
  { date: 'Dec 15', avgPrice: 28900, volume: 4120 },
  { date: 'Dec 22', avgPrice: 28750, volume: 3890 },
  { date: 'Dec 29', avgPrice: 28600, volume: 3650 },
  { date: 'Jan 5', avgPrice: 28550, volume: 4780 },
  { date: 'Jan 11', avgPrice: 28450, volume: 5120 },
];

export const segmentDistributionData = [
  { name: 'Premium', value: 28, color: 'hsl(187, 85%, 43%)' },
  { name: 'Middenklasse', value: 35, color: 'hsl(199, 89%, 48%)' },
  { name: 'Compact', value: 22, color: 'hsl(142, 71%, 45%)' },
  { name: 'SUV', value: 15, color: 'hsl(38, 92%, 50%)' },
];

export const portalDistributionData = [
  { portal: 'Marktplaats', listings: 23100, percentage: 44.1 },
  { portal: 'AutoTrack', listings: 12450, percentage: 23.8 },
  { portal: 'AutoScout24', listings: 8920, percentage: 17.0 },
  { portal: 'Gaspedaal', listings: 5670, percentage: 10.8 },
  { portal: 'Overig', listings: 2200, percentage: 4.2 },
];

// Segment Confidence Data for DataQuality page
export const segmentConfidenceData = mockSegments.map(segment => ({
  id: segment.id,
  name: segment.name,
  avgConfidence: segment.avgConfidence,
  count: segment.count,
  lowConfidenceCount: Math.round(segment.count * (1 - segment.avgConfidence / 100) * 0.3),
  trend: segment.courantheidTrend
}));
