import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useScraperStatus, useScraperActions } from '@/hooks/useScraperStatus';
import {
  Play,
  Pause,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function GaspedaalControlPanel() {
  const { data: status, isLoading } = useScraperStatus('gaspedaal');
  const { runDiscovery, runDeepSync, togglePause } = useScraperActions('gaspedaal');

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

  const { config, stats, recentJobs } = status;
  const lastJob = recentJobs[0];
  const isRunning = lastJob?.status === 'running';
  const hasErrors = recentJobs.some(j => j.stats.errorsCount > 0);

  const getStatusBadge = () => {
    if (config.paused) {
      return <Badge className="bg-warning/20 text-warning border-warning/30">Gepauzeerd</Badge>;
    }
    if (isRunning) {
      return <Badge className="bg-primary/20 text-primary border-primary/30">Draait</Badge>;
    }
    if (hasErrors) {
      return <Badge className="bg-warning/20 text-warning border-warning/30">Waarschuwing</Badge>;
    }
    return <Badge className="bg-success/20 text-success border-success/30">Idle</Badge>;
  };

  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return 'Nooit';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 60) return `${diffMins} min geleden`;
    if (diffHours < 24) return `${diffHours} uur geleden`;
    return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card className="bg-card border-border border-2 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Database className="h-5 w-5 text-primary" />
            Gaspedaal Scraper
            {getStatusBadge()}
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Actief</span>
            <Switch
              checked={!config.paused}
              onCheckedChange={(checked) => togglePause.mutate(!checked)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Totaal Listings</p>
            <p className="text-xl font-semibold text-foreground">{stats.totalListings.toLocaleString()}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Actief</p>
            <div className="flex items-center gap-1">
              <p className="text-xl font-semibold text-success">{stats.activeListings.toLocaleString()}</p>
              <TrendingUp className="h-4 w-4 text-success" />
            </div>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Gone</p>
            <div className="flex items-center gap-1">
              <p className="text-xl font-semibold text-muted-foreground">{stats.goneListings.toLocaleString()}</p>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Errors (24h)</p>
            <p className={cn(
              'text-xl font-semibold',
              recentJobs.reduce((acc, j) => acc + j.stats.errorsCount, 0) > 0 ? 'text-destructive' : 'text-muted-foreground'
            )}>
              {recentJobs.reduce((acc, j) => acc + j.stats.errorsCount, 0)}
            </p>
          </div>
        </div>

        {/* Timing Info */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-muted-foreground">Laatste discovery: </span>
              <span className="text-foreground font-medium">{formatTimeAgo(stats.lastDiscovery)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Laatste deep sync: </span>
              <span className="text-foreground font-medium">{formatTimeAgo(stats.lastDeepSync)}</span>
            </div>
          </div>
        </div>

        {/* Last Job Summary */}
        {lastJob && (
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {lastJob.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-success" />}
                {lastJob.status === 'running' && <RefreshCw className="h-4 w-4 text-primary animate-spin" />}
                {lastJob.status === 'failed' && <XCircle className="h-4 w-4 text-destructive" />}
                <span className="text-sm font-medium text-foreground capitalize">
                  {lastJob.jobType.replace('_', ' ')}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {lastJob.durationSeconds ? `${Math.floor(lastJob.durationSeconds / 60)}m ${lastJob.durationSeconds % 60}s` : 'In progress...'}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Gevonden:</span>
                <span className="ml-1 text-foreground font-medium">{lastJob.stats.listingsFound}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Nieuw:</span>
                <span className="ml-1 text-success font-medium">+{lastJob.stats.listingsNew}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Updated:</span>
                <span className="ml-1 text-primary font-medium">{lastJob.stats.listingsUpdated}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Gone:</span>
                <span className="ml-1 text-muted-foreground font-medium">-{lastJob.stats.listingsGone}</span>
              </div>
            </div>
            {lastJob.stats.errorsCount > 0 && (
              <div className="mt-2 flex items-center gap-1 text-xs text-warning">
                <AlertTriangle className="h-3 w-3" />
                <span>{lastJob.stats.errorsCount} error(s) tijdens job</span>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <Button
            variant="default"
            size="sm"
            onClick={() => runDiscovery.mutate()}
            disabled={runDiscovery.isPending || isRunning || config.paused}
          >
            {runDiscovery.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Run Discovery
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => runDeepSync.mutate()}
            disabled={runDeepSync.isPending || isRunning || config.paused}
          >
            {runDeepSync.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Run Deep Sync
          </Button>
          {config.paused ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => togglePause.mutate(false)}
            >
              <Play className="h-4 w-4 mr-2" />
              Resume
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => togglePause.mutate(true)}
              disabled={isRunning}
            >
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
