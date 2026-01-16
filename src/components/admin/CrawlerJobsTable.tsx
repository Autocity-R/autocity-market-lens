import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useDataSource } from '@/providers/DataSourceProvider';
import { mockCrawlerJobs } from '@/lib/mockData';
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Pause,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addMinutes } from 'date-fns';
import { nl } from 'date-fns/locale';

interface CrawlerJob {
  id: string;
  portal: string;
  status: string;
  listingsFound: number;
  errors: number;
  lastRun: string;
  nextRun: string;
}

export function CrawlerJobsTable() {
  const { dataSource } = useDataSource();

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['crawler-jobs-all', dataSource],
    queryFn: async (): Promise<CrawlerJob[]> => {
      if (dataSource === 'mock') {
        return mockCrawlerJobs;
      }

      // Fetch latest job per source
      const { data, error } = await supabase
        .from('scraper_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Group by source and take latest
      const latestBySource = new Map<string, typeof data[0]>();
      for (const job of data || []) {
        if (!latestBySource.has(job.source)) {
          latestBySource.set(job.source, job);
        }
      }

      // Also get portal configs for frequency
      const { data: configs } = await supabase
        .from('portal_configs')
        .select('portal_id, frequency_minutes, name');

      const configMap = new Map(
        (configs || []).map(c => [c.portal_id, c])
      );

      return Array.from(latestBySource.entries()).map(([source, job]) => {
        const config = configMap.get(source);
        const completedAt = job.completed_at ? new Date(job.completed_at) : new Date();
        const frequencyMins = config?.frequency_minutes || 240;

        return {
          id: job.id,
          portal: config?.name || source.charAt(0).toUpperCase() + source.slice(1),
          status: job.status,
          listingsFound: job.listings_found || 0,
          errors: job.errors_count || 0,
          lastRun: job.completed_at || job.created_at,
          nextRun: addMinutes(completedAt, frequencyMins).toISOString(),
        };
      });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <RefreshCw className="h-4 w-4 text-primary animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'pending':
      case 'scheduled':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "HH:mm d MMM", { locale: nl });
    } catch {
      return '-';
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-lg">
            <span className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Recente Crawler Jobs
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Recente Crawler Jobs
          </span>
          <Button variant="outline" size="sm">
            <Play className="h-4 w-4 mr-1" />
            Start alle
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-3 text-left text-xs font-medium text-muted-foreground">Portal</th>
                <th className="pb-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="pb-3 text-right text-xs font-medium text-muted-foreground">Listings</th>
                <th className="pb-3 text-right text-xs font-medium text-muted-foreground">Errors</th>
                <th className="pb-3 text-left text-xs font-medium text-muted-foreground">Laatste run</th>
                <th className="pb-3 text-left text-xs font-medium text-muted-foreground">Volgende run</th>
                <th className="pb-3 text-right text-xs font-medium text-muted-foreground">Acties</th>
              </tr>
            </thead>
            <tbody>
              {jobs?.map((job) => (
                <tr key={job.id} className="border-b border-border/50 last:border-0">
                  <td className="py-3">
                    <p className="text-sm font-medium text-foreground">{job.portal}</p>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(job.status)}
                      <span className="text-sm capitalize text-foreground">{job.status}</span>
                    </div>
                  </td>
                  <td className="py-3 text-right text-sm text-foreground">
                    {job.listingsFound.toLocaleString()}
                  </td>
                  <td className="py-3 text-right">
                    <span className={cn(
                      'text-sm',
                      job.errors > 0 ? 'text-destructive' : 'text-muted-foreground'
                    )}>
                      {job.errors}
                    </span>
                  </td>
                  <td className="py-3 text-sm text-muted-foreground">
                    {formatDateTime(job.lastRun)}
                  </td>
                  <td className="py-3 text-sm text-muted-foreground">
                    {formatDateTime(job.nextRun)}
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm">
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Pause className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!jobs || jobs.length === 0) && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    Geen jobs gevonden
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
