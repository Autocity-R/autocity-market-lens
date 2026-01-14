import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { useScraperStatus, useScraperActions } from '@/hooks/useScraperStatus';
import {
  Play,
  Pause,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Database,
  Zap,
  Shield,
  Activity,
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

  const { config, stats, recentJobs, creditUsage } = status;
  const lastJob = recentJobs[0];
  const isRunning = lastJob?.status === 'running';
  const hasErrors = recentJobs.some(j => j.stats.errorsCount > 0);
  const hasSafetyStop = lastJob?.stopReason !== null && lastJob?.stopReason !== undefined;

  const getStatusBadge = () => {
    if (config.paused) {
      return <Badge className="bg-warning/20 text-warning border-warning/30">Gepauzeerd</Badge>;
    }
    if (isRunning) {
      return <Badge className="bg-primary/20 text-primary border-primary/30">Draait</Badge>;
    }
    if (hasSafetyStop) {
      return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Gestopt</Badge>;
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

  const getCreditColor = () => {
    if (creditUsage.percentage >= 90) return 'text-destructive';
    if (creditUsage.percentage >= 80) return 'text-warning';
    return 'text-success';
  };

  const getCreditProgressColor = () => {
    if (creditUsage.percentage >= 90) return 'bg-destructive';
    if (creditUsage.percentage >= 80) return 'bg-warning';
    return 'bg-success';
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
        {/* Credit Budget Card */}
        <div className="p-4 rounded-lg bg-muted/30 border border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Credit Budget</span>
            </div>
            <span className={cn('text-sm font-semibold', getCreditColor())}>
              {creditUsage.today.toLocaleString()} / {creditUsage.limit.toLocaleString()}
            </span>
          </div>
          <Progress 
            value={Math.min(creditUsage.percentage, 100)} 
            className={cn('h-2', getCreditProgressColor())}
          />
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>{creditUsage.percentage.toFixed(1)}% gebruikt vandaag</span>
            {creditUsage.percentage >= 80 && (
              <div className="flex items-center gap-1 text-warning">
                <AlertTriangle className="h-3 w-3" />
                <span>Bijna op budget</span>
              </div>
            )}
          </div>
        </div>

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
            <p className="text-xs text-muted-foreground">Gone/Sold</p>
            <div className="flex items-center gap-1">
              <p className="text-xl font-semibold text-muted-foreground">{(stats.goneSuspectedListings + stats.soldConfirmedListings).toLocaleString()}</p>
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
              <span className="text-muted-foreground">Laatste lifecycle check: </span>
              <span className="text-foreground font-medium">{formatTimeAgo(stats.lastLifecycleCheck)}</span>
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
            
            {/* Job Stats */}
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

            {/* Quality Metrics */}
            <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Credits:</span>
                <span className="text-foreground font-medium">{lastJob.creditsUsed ?? 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <Activity className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Parse:</span>
                <span className={cn(
                  'font-medium',
                  (lastJob.parseSuccessRate ?? 100) >= 95 ? 'text-success' : 
                  (lastJob.parseSuccessRate ?? 100) >= 80 ? 'text-warning' : 'text-destructive'
                )}>
                  {lastJob.parseSuccessRate?.toFixed(1) ?? '-'}%
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Shield className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Error:</span>
                <span className={cn(
                  'font-medium',
                  (lastJob.errorRate ?? 0) <= 1 ? 'text-success' : 
                  (lastJob.errorRate ?? 0) <= 5 ? 'text-warning' : 'text-destructive'
                )}>
                  {lastJob.errorRate?.toFixed(1) ?? '0'}%
                </span>
              </div>
            </div>

            {/* Safety Stop Warning */}
            {lastJob.stopReason && (
              <div className="mt-2 p-2 rounded bg-destructive/10 border border-destructive/20 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div className="text-xs text-destructive">
                  <span className="font-medium">Safety Stop: </span>
                  <span>{lastJob.stopReason}</span>
                </div>
              </div>
            )}

            {/* Error Warning */}
            {!lastJob.stopReason && lastJob.stats.errorsCount > 0 && (
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
            disabled={runDiscovery.isPending || isRunning || config.paused || creditUsage.percentage >= 100}
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
            disabled={runDeepSync.isPending || isRunning || config.paused || creditUsage.percentage >= 100}
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
