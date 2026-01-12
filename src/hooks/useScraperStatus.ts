import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from '@/providers/DataSourceProvider';
import type { ScraperStatusResponse, ScraperJob } from '@/types/scraper';

// Mock data for Gaspedaal scraper status
const mockGaspedaalJobs: ScraperJob[] = [
  {
    id: 'gj-001',
    source: 'gaspedaal',
    jobType: 'discovery',
    status: 'completed',
    startedAt: '2025-01-12T08:00:00Z',
    completedAt: '2025-01-12T08:12:34Z',
    durationSeconds: 754,
    stats: {
      pagesProcessed: 127,
      listingsFound: 5670,
      listingsNew: 89,
      listingsUpdated: 234,
      listingsGone: 12,
      errorsCount: 1,
    },
    errorLog: [
      { timestamp: '2025-01-12T08:05:23Z', message: 'Timeout on page 45', url: 'https://gaspedaal.nl/page/45' }
    ],
    triggeredBy: 'scheduler',
  },
  {
    id: 'gj-002',
    source: 'gaspedaal',
    jobType: 'deep_sync',
    status: 'completed',
    startedAt: '2025-01-11T20:00:00Z',
    completedAt: '2025-01-11T21:45:12Z',
    durationSeconds: 6312,
    stats: {
      pagesProcessed: 5670,
      listingsFound: 5670,
      listingsNew: 0,
      listingsUpdated: 456,
      listingsGone: 34,
      errorsCount: 3,
    },
    errorLog: [],
    triggeredBy: 'scheduler',
  },
  {
    id: 'gj-003',
    source: 'gaspedaal',
    jobType: 'discovery',
    status: 'completed',
    startedAt: '2025-01-11T12:00:00Z',
    completedAt: '2025-01-11T12:11:45Z',
    durationSeconds: 705,
    stats: {
      pagesProcessed: 125,
      listingsFound: 5615,
      listingsNew: 67,
      listingsUpdated: 189,
      listingsGone: 8,
      errorsCount: 0,
    },
    errorLog: [],
    triggeredBy: 'scheduler',
  },
];

// Mock fetcher for scraper status
async function fetchMockStatus(source: string): Promise<ScraperStatusResponse> {
  await new Promise(r => setTimeout(r, 200));
  
  const jobs = mockGaspedaalJobs.filter(j => j.source === source);
  const lastDiscoveryJob = jobs.find(j => j.jobType === 'discovery');
  const lastDeepSyncJob = jobs.find(j => j.jobType === 'deep_sync');
  
  return {
    config: {
      source,
      enabled: true,
      paused: false,
      discoveryFrequencyMinutes: 240,
      deepSyncFrequencyMinutes: 1440,
      requestsPerMinute: 30,
      delayBetweenRequestsMs: 2000,
      goneAfterConsecutiveMisses: 3,
    },
    recentJobs: jobs,
    stats: {
      totalListings: 5670,
      activeListings: 5420,
      goneListings: 250,
      lastDiscovery: lastDiscoveryJob?.completedAt || null,
      lastDeepSync: lastDeepSyncJob?.completedAt || null,
    },
  };
}

export function useScraperStatus(source: string) {
  const { dataSource } = useDataSource();
  
  return useQuery({
    queryKey: ['scraper-status', source, dataSource],
    queryFn: () => fetchMockStatus(source),
    refetchInterval: 30000,  // Refresh every 30 seconds
  });
}

// Job triggers / actions
export function useScraperActions(source: string) {
  const queryClient = useQueryClient();
  
  const runDiscovery = useMutation({
    mutationFn: async () => {
      // TODO: Call scraper job runner endpoint
      console.log('Triggering discovery for', source);
      await new Promise(r => setTimeout(r, 500));
      return { jobId: `job-${Date.now()}` };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scraper-status', source] });
    },
  });
  
  const runDeepSync = useMutation({
    mutationFn: async () => {
      // TODO: Call deep sync endpoint
      console.log('Triggering deep sync for', source);
      await new Promise(r => setTimeout(r, 500));
      return { jobId: `job-${Date.now()}` };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scraper-status', source] });
    },
  });
  
  const togglePause = useMutation({
    mutationFn: async (paused: boolean) => {
      // TODO: Call pause/resume endpoint
      console.log('Setting pause to', paused, 'for', source);
      await new Promise(r => setTimeout(r, 300));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scraper-status', source] });
    },
  });
  
  return { runDiscovery, runDeepSync, togglePause };
}
