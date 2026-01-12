import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from '@/providers/DataSourceProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ScraperStatusResponse, ScraperJob, ScraperConfig } from '@/types/scraper';

// ===== MOCK DATA =====
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
    createdAt: '2025-01-12T08:00:00Z',
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
    createdAt: '2025-01-11T20:00:00Z',
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
    createdAt: '2025-01-11T12:00:00Z',
  },
];

// ===== MOCK FETCHER =====
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
      maxPagesPerRun: 5,
      maxListingsPerRun: 100,
      delayBetweenRequestsMs: 1500,
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

// ===== DB TRANSFORM FUNCTIONS =====
function transformDBConfig(row: {
  source: string;
  enabled: boolean | null;
  paused: boolean | null;
  discovery_frequency_minutes: number | null;
  max_pages_per_run: number | null;
  max_listings_per_run: number | null;
  delay_between_requests_ms: number | null;
  gone_after_consecutive_misses: number | null;
} | null): ScraperConfig {
  return {
    source: row?.source || 'gaspedaal',
    enabled: row?.enabled ?? true,
    paused: row?.paused ?? false,
    discoveryFrequencyMinutes: row?.discovery_frequency_minutes ?? 240,
    maxPagesPerRun: row?.max_pages_per_run ?? 5,
    maxListingsPerRun: row?.max_listings_per_run ?? 100,
    delayBetweenRequestsMs: row?.delay_between_requests_ms ?? 1500,
    goneAfterConsecutiveMisses: row?.gone_after_consecutive_misses ?? 3,
  };
}

function transformDBJob(row: {
  id: string;
  source: string;
  job_type: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  pages_processed: number | null;
  listings_found: number | null;
  listings_new: number | null;
  listings_updated: number | null;
  listings_gone: number | null;
  errors_count: number | null;
  error_log: unknown;
  triggered_by: string | null;
  created_at: string;
}): ScraperJob {
  const errorLog = Array.isArray(row.error_log) 
    ? row.error_log as Array<{ timestamp: string; message: string; url?: string }>
    : [];
  
  return {
    id: row.id,
    source: row.source,
    jobType: row.job_type as 'discovery' | 'deep_sync' | 'lifecycle_check',
    status: row.status as 'pending' | 'running' | 'completed' | 'failed',
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationSeconds: row.duration_seconds,
    stats: {
      pagesProcessed: row.pages_processed ?? 0,
      listingsFound: row.listings_found ?? 0,
      listingsNew: row.listings_new ?? 0,
      listingsUpdated: row.listings_updated ?? 0,
      listingsGone: row.listings_gone ?? 0,
      errorsCount: row.errors_count ?? 0,
    },
    errorLog,
    triggeredBy: (row.triggered_by || 'manual') as 'scheduler' | 'manual' | 'api',
    createdAt: row.created_at,
  };
}

// ===== DB FETCHER =====
async function fetchDBStatus(source: string): Promise<ScraperStatusResponse> {
  // Fetch config
  const { data: configData } = await supabase
    .from('scraper_configs')
    .select('*')
    .eq('source', source)
    .maybeSingle();
  
  // Fetch recent jobs (last 20)
  const { data: jobsData } = await supabase
    .from('scraper_jobs')
    .select('*')
    .eq('source', source)
    .order('created_at', { ascending: false })
    .limit(20);
  
  // Fetch listing stats
  const { count: totalCount } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('source', source);
  
  const { count: activeCount } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('source', source)
    .eq('status', 'active');
  
  const config = transformDBConfig(configData);
  const jobs = (jobsData || []).map(transformDBJob);
  
  const lastDiscoveryJob = jobs.find(j => j.jobType === 'discovery' && j.status === 'completed');
  const lastDeepSyncJob = jobs.find(j => j.jobType === 'deep_sync' && j.status === 'completed');
  
  return {
    config,
    recentJobs: jobs,
    stats: {
      totalListings: totalCount || 0,
      activeListings: activeCount || 0,
      goneListings: (totalCount || 0) - (activeCount || 0),
      lastDiscovery: lastDiscoveryJob?.completedAt || null,
      lastDeepSync: lastDeepSyncJob?.completedAt || null,
    },
  };
}

// ===== MAIN HOOK =====
export function useScraperStatus(source: string) {
  const { dataSource } = useDataSource();
  
  const fetcher = dataSource === 'db' ? fetchDBStatus : fetchMockStatus;
  
  return useQuery({
    queryKey: ['scraper-status', source, dataSource],
    queryFn: () => fetcher(source),
    refetchInterval: 30000,  // Refresh every 30 seconds
  });
}

// ===== ACTIONS HOOK =====
export function useScraperActions(source: string) {
  const queryClient = useQueryClient();
  const { dataSource } = useDataSource();
  
  const runDiscovery = useMutation({
    mutationFn: async () => {
      if (dataSource !== 'db') {
        // Mock mode
        console.log('Mock: Triggering discovery for', source);
        await new Promise(r => setTimeout(r, 500));
        return { jobId: `mock-job-${Date.now()}` };
      }
      
      // Real DB mode
      // 1. Create job record with status 'running' and started_at
      const { data: job, error: jobError } = await supabase
        .from('scraper_jobs')
        .insert({
          source,
          job_type: 'discovery',
          status: 'running',
          started_at: new Date().toISOString(),
          triggered_by: 'manual',
        })
        .select()
        .single();
      
      if (jobError) {
        console.error('Failed to create job:', jobError);
        throw new Error('Failed to create job record');
      }
      
      console.log('Created job:', job.id);
      
      // 2. Invoke edge function
      const { data, error } = await supabase.functions.invoke('gaspedaal-discovery', {
        body: { jobId: job.id, maxPages: 3 },
      });
      
      if (error) {
        console.error('Edge function error:', error);
        // Update job as failed
        await supabase
          .from('scraper_jobs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_log: [{ timestamp: new Date().toISOString(), message: error.message }],
          })
          .eq('id', job.id);
        
        throw error;
      }
      
      return { jobId: job.id, ...data };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['scraper-status', source] });
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      toast.success(`Discovery job gestart (${data.jobId})`);
    },
    onError: (error) => {
      console.error('Discovery failed:', error);
      toast.error(`Discovery mislukt: ${error instanceof Error ? error.message : 'Onbekende fout'}`);
    },
  });
  
  const runDeepSync = useMutation({
    mutationFn: async () => {
      // TODO: Implement deep sync edge function
      console.log('Triggering deep sync for', source);
      await new Promise(r => setTimeout(r, 500));
      return { jobId: `job-${Date.now()}` };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scraper-status', source] });
      toast.success('Deep sync job gestart');
    },
    onError: (error) => {
      toast.error(`Deep sync mislukt: ${error instanceof Error ? error.message : 'Onbekende fout'}`);
    },
  });
  
  const togglePause = useMutation({
    mutationFn: async (paused: boolean) => {
      if (dataSource !== 'db') {
        console.log('Mock: Setting pause to', paused, 'for', source);
        await new Promise(r => setTimeout(r, 300));
        return;
      }
      
      const { error } = await supabase
        .from('scraper_configs')
        .update({ paused, updated_at: new Date().toISOString() })
        .eq('source', source);
      
      if (error) throw error;
    },
    onSuccess: (_, paused) => {
      queryClient.invalidateQueries({ queryKey: ['scraper-status', source] });
      toast.success(paused ? 'Scraper gepauzeerd' : 'Scraper hervat');
    },
    onError: (error) => {
      toast.error(`Toggle pause mislukt: ${error instanceof Error ? error.message : 'Onbekende fout'}`);
    },
  });
  
  return { runDiscovery, runDeepSync, togglePause };
}
