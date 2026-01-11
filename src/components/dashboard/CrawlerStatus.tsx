import { mockCrawlerJobs } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react';

export function CrawlerStatus() {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <RefreshCw className="h-4 w-4 text-primary animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'scheduled':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      running: 'bg-primary/20 text-primary',
      completed: 'bg-success/20 text-success',
      failed: 'bg-destructive/20 text-destructive',
      scheduled: 'bg-muted text-muted-foreground',
    };
    return styles[status as keyof typeof styles] || styles.scheduled;
  };

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-foreground">Scraper Status</h3>
        <span className="text-xs text-muted-foreground">Live monitoring</span>
      </div>
      <div className="space-y-3">
        {mockCrawlerJobs.map((job) => (
          <div
            key={job.id}
            className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
          >
            <div className="flex items-center gap-3">
              {getStatusIcon(job.status)}
              <div>
                <p className="text-sm font-medium text-foreground">{job.portal}</p>
                <p className="text-xs text-muted-foreground">
                  {job.listingsFound.toLocaleString()} listings
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                getStatusBadge(job.status)
              )}>
                {job.status}
              </span>
              {job.errors > 0 && (
                <p className="text-xs text-destructive mt-1">{job.errors} errors</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
