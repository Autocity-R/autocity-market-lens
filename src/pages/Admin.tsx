import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { mockCrawlerJobs } from '@/lib/mockData';
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Settings,
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const portals = [
  { id: 'autotrack', name: 'AutoTrack', enabled: true, frequency: '4 uur', lastSuccess: '2025-01-11 08:00' },
  { id: 'autoscout24', name: 'AutoScout24', enabled: true, frequency: '4 uur', lastSuccess: '2025-01-11 09:30' },
  { id: 'marktplaats', name: 'Marktplaats', enabled: true, frequency: '4 uur', lastSuccess: '2025-01-11 06:00' },
  { id: 'gaspedaal', name: 'Gaspedaal', enabled: true, frequency: '4 uur', lastSuccess: '2025-01-11 07:30' },
  { id: 'autoweek', name: 'AutoWeek', enabled: false, frequency: '6 uur', lastSuccess: 'N/A' },
];

export default function Admin() {
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

  return (
    <MainLayout
      title="Admin & System"
      subtitle="Beheer scrapers, configuraties en systeeminstellingen"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Portal Configuration */}
        <div className="lg:col-span-2">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings className="h-5 w-5 text-primary" />
                Portal Configuratie
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {portals.map((portal) => (
                  <div
                    key={portal.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border"
                  >
                    <div className="flex items-center gap-4">
                      <Switch checked={portal.enabled} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{portal.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Laatste sync: {portal.lastSuccess}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Select defaultValue={portal.frequency}>
                        <SelectTrigger className="w-24 h-8 bg-background border-border text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1 uur">1 uur</SelectItem>
                          <SelectItem value="2 uur">2 uur</SelectItem>
                          <SelectItem value="4 uur">4 uur</SelectItem>
                          <SelectItem value="6 uur">6 uur</SelectItem>
                          <SelectItem value="12 uur">12 uur</SelectItem>
                          <SelectItem value="24 uur">24 uur</SelectItem>
                        </SelectContent>
                      </Select>
                      <Badge variant={portal.enabled ? 'default' : 'secondary'}>
                        {portal.enabled ? 'Actief' : 'Inactief'}
                      </Badge>
                      <Button variant="ghost" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border">
                <Button variant="outline">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset naar defaults
                </Button>
                <Button>
                  Wijzigingen opslaan
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Crawler Jobs */}
          <Card className="bg-card border-border mt-6">
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
                    {mockCrawlerJobs.map((job) => (
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
                          {new Date(job.lastRun).toLocaleString('nl-NL', {
                            hour: '2-digit',
                            minute: '2-digit',
                            day: 'numeric',
                            month: 'short'
                          })}
                        </td>
                        <td className="py-3 text-sm text-muted-foreground">
                          {new Date(job.nextRun).toLocaleString('nl-NL', {
                            hour: '2-digit',
                            minute: '2-digit',
                            day: 'numeric',
                            month: 'short'
                          })}
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
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* System Status */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Systeem Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">API Status</span>
                <Badge className="bg-success/20 text-success border-success/30">Online</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Database</span>
                <Badge className="bg-success/20 text-success border-success/30">Healthy</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">AI Engine</span>
                <Badge className="bg-success/20 text-success border-success/30">Active</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Queue</span>
                <span className="text-sm text-foreground">23 pending</span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Snelle Acties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <RefreshCw className="h-4 w-4 mr-2" />
                Herstart alle scrapers
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <RotateCcw className="h-4 w-4 mr-2" />
                Cache legen
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Bekijk error logs
              </Button>
            </CardContent>
          </Card>

          {/* API Settings */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">API Instellingen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Rate Limit (req/min)</Label>
                <Input type="number" defaultValue="60" className="mt-1 bg-muted border-border" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Timeout (seconds)</Label>
                <Input type="number" defaultValue="30" className="mt-1 bg-muted border-border" />
              </div>
              <div className="flex items-center justify-between pt-2">
                <Label className="text-sm text-foreground">Debug mode</Label>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
