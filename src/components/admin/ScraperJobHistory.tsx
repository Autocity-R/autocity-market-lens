import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useScraperStatus } from '@/hooks/useScraperStatus';
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ScraperJob } from '@/types/scraper';

interface ScraperJobHistoryProps {
  source: string;
}

export function ScraperJobHistory({ source }: ScraperJobHistoryProps) {
  const { data: status, isLoading } = useScraperStatus(source);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  if (isLoading || !status) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const { recentJobs } = status;

  const getStatusIcon = (job: ScraperJob) => {
    switch (job.status) {
      case 'running':
        return <RefreshCw className="h-4 w-4 text-primary animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-warning" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getJobTypeBadge = (jobType: string) => {
    switch (jobType) {
      case 'discovery':
        return <Badge variant="outline" className="text-xs">Discovery</Badge>;
      case 'deep_sync':
        return <Badge variant="outline" className="text-xs bg-primary/10">Deep Sync</Badge>;
      case 'lifecycle_check':
        return <Badge variant="outline" className="text-xs bg-muted">Lifecycle</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{jobType}</Badge>;
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5 text-primary" />
          Job History - {source.charAt(0).toUpperCase() + source.slice(1)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="pb-3 text-left text-xs font-medium text-muted-foreground">Type</th>
                <th className="pb-3 text-left text-xs font-medium text-muted-foreground">Gestart</th>
                <th className="pb-3 text-right text-xs font-medium text-muted-foreground">Duur</th>
                <th className="pb-3 text-right text-xs font-medium text-muted-foreground">Gevonden</th>
                <th className="pb-3 text-right text-xs font-medium text-muted-foreground">Nieuw</th>
                <th className="pb-3 text-right text-xs font-medium text-muted-foreground">Updated</th>
                <th className="pb-3 text-right text-xs font-medium text-muted-foreground">Gone</th>
                <th className="pb-3 text-right text-xs font-medium text-muted-foreground">Errors</th>
                <th className="pb-3 text-left text-xs font-medium text-muted-foreground">Trigger</th>
                <th className="pb-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {recentJobs.map((job) => (
                <>
                  <tr
                    key={job.id}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/30 cursor-pointer"
                    onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                  >
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(job)}
                        <span className="text-sm capitalize text-foreground">{job.status}</span>
                      </div>
                    </td>
                    <td className="py-3">{getJobTypeBadge(job.jobType)}</td>
                    <td className="py-3 text-sm text-muted-foreground">
                      {formatDateTime(job.startedAt)}
                    </td>
                    <td className="py-3 text-right text-sm text-foreground">
                      {formatDuration(job.durationSeconds)}
                    </td>
                    <td className="py-3 text-right text-sm text-foreground">
                      {job.stats.listingsFound.toLocaleString()}
                    </td>
                    <td className="py-3 text-right text-sm text-success">
                      +{job.stats.listingsNew}
                    </td>
                    <td className="py-3 text-right text-sm text-primary">
                      {job.stats.listingsUpdated}
                    </td>
                    <td className="py-3 text-right text-sm text-muted-foreground">
                      -{job.stats.listingsGone}
                    </td>
                    <td className="py-3 text-right">
                      <span className={cn(
                        'text-sm font-medium',
                        job.stats.errorsCount > 0 ? 'text-destructive' : 'text-muted-foreground'
                      )}>
                        {job.stats.errorsCount}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-muted-foreground capitalize">
                      {job.triggeredBy}
                    </td>
                    <td className="py-3">
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        {expandedJob === job.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </td>
                  </tr>
                  {expandedJob === job.id && job.errorLog.length > 0 && (
                    <tr key={`${job.id}-errors`} className="bg-muted/20">
                      <td colSpan={11} className="py-3 px-4">
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Error Log
                          </p>
                          {job.errorLog.map((error, idx) => (
                            <div key={idx} className="text-xs p-2 rounded bg-destructive/10 border border-destructive/20">
                              <div className="flex items-center justify-between">
                                <span className="text-destructive font-medium">{error.message}</span>
                                <span className="text-muted-foreground">{formatDateTime(error.timestamp)}</span>
                              </div>
                              {error.url && (
                                <p className="text-muted-foreground mt-1 truncate">{error.url}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                  {expandedJob === job.id && job.errorLog.length === 0 && (
                    <tr key={`${job.id}-no-errors`} className="bg-muted/20">
                      <td colSpan={11} className="py-3 px-4">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-success" />
                          Geen errors tijdens deze job
                        </p>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {recentJobs.length === 0 && (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <p className="text-sm">Nog geen jobs uitgevoerd</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
