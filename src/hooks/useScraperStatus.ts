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
    creditsUsed: 345,
    sitemapRequests: 5,
    detailRequests: 340,
    parseSuccessRate: 98.5,
    errorRate: 0.3,
    stopReason: null,
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
    creditsUsed: 5680,
    sitemapRequests: 10,
    detailRequests: 5670,
    parseSuccessRate: 99.2,
    errorRate: 0.05,
    stopReason: null,
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
    creditsUsed: 280,
    sitemapRequests: 5,
    detailRequests: 275,
    parseSuccessRate: 100,
    errorRate: 0,
    stopReason: null,
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
  
  const todayCredits = jobs.reduce((sum, j) => sum + (j.creditsUsed || 0), 0);
  const maxCredits = 15000;
  
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
      maxCreditsPerDay: maxCredits,
      errorRateThreshold: 0.10,
      parseQualityThreshold: 0.50,
    },
    recentJobs: jobs,
    stats: {
      totalListings: 5670,
      activeListings: 5420,
      goneListings: 250,
      lastDiscovery: lastDiscoveryJob?.completedAt || null,
      lastDeepSync: lastDeepSyncJob?.completedAt || null,
    },
    creditUsage: {
      today: todayCredits,
      limit: maxCredits,
      percentage: (todayCredits / maxCredits) * 100,
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
  max_credits_per_day: number | null;
  error_rate_threshold: number | null;
  parse_quality_threshold: number | null;
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
    maxCreditsPerDay: row?.max_credits_per_day ?? 15000,
    errorRateThreshold: parseFloat(String(row?.error_rate_threshold ?? 0.10)),
    parseQualityThreshold: parseFloat(String(row?.parse_quality_threshold ?? 0.50)),
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
  credits_used: number | null;
  sitemap_requests: number | null;
  detail_requests: number | null;
  parse_success_rate: number | null;
  error_rate: number | null;
  stop_reason: string | null;
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
    creditsUsed: row.credits_used,
    sitemapRequests: row.sitemap_requests,
    detailRequests: row.detail_requests,
    parseSuccessRate: row.parse_success_rate ? parseFloat(String(row.parse_success_rate)) : null,
    errorRate: row.error_rate ? parseFloat(String(row.error_rate)) : null,
    stopReason: row.stop_reason,
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
  
  // Fetch today's credit usage
  const today = new Date().toISOString().split('T')[0];
  const { data: creditData } = await supabase
    .from('scraper_credit_usage')
    .select('credits_used')
    .eq('date', today)
    .eq('source', source)
    .maybeSingle();
  
  const config = transformDBConfig(configData);
  const jobs = (jobsData || []).map(transformDBJob);
  
  const lastDiscoveryJob = jobs.find(j => j.jobType === 'discovery' && j.status === 'completed');
  const lastDeepSyncJob = jobs.find(j => j.jobType === 'deep_sync' && j.status === 'completed');
  
  const todayCredits = creditData?.credits_used || 0;
  
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
    creditUsage: {
      today: todayCredits,
      limit: config.maxCreditsPerDay,
      percentage: config.maxCreditsPerDay > 0 
        ? (todayCredits / config.maxCreditsPerDay) * 100 
        : 0,
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
    refetchInterval: 30000,
  });
}

// ===== ACTIONS HOOK =====
export function useScraperActions(source: string) {
  const queryClient = useQueryClient();
  const { dataSource } = useDataSource();
  
  const runDiscovery = useMutation({
    mutationFn: async () => {
      if (dataSource !== 'db') {
        console.log('Mock: Triggering discovery for', source);
        await new Promise(r => setTimeout(r, 500));
        return { jobId: `mock-job-${Date.now()}` };
      }
      
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
      
      const { data, error } = await supabase.functions.invoke('gaspedaal-discovery', {
        body: { jobId: job.id, maxPages: 3 },
      });
      
      if (error) {
        console.error('Edge function error:', error);
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
