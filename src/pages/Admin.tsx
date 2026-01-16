import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GaspedaalControlPanel } from '@/components/admin/GaspedaalControlPanel';
import { ScraperJobHistory } from '@/components/admin/ScraperJobHistory';
import { ScrapeAuditPanel } from '@/components/admin/ScrapeAuditPanel';
import { PortalConfigPanel } from '@/components/admin/PortalConfigPanel';
import { CrawlerJobsTable } from '@/components/admin/CrawlerJobsTable';
import { SystemSettingsCard } from '@/components/admin/SystemSettingsCard';
import { useDataSource } from '@/providers/DataSourceProvider';
import {
  RefreshCw,
  RotateCcw,
  AlertTriangle,
  Database,
  Sparkles,
} from 'lucide-react';

export default function Admin() {
  const { dataSource, setDataSource } = useDataSource();

  return (
    <MainLayout
      title="Admin & System"
      subtitle="Beheer scrapers, configuraties en systeeminstellingen"
    >
      <div className="space-y-6">
        {/* DataSource Toggle */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
          <Database className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground">Data Source:</span>
          <div className="flex gap-1">
            <Button 
              variant={dataSource === 'mock' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setDataSource('mock')}
            >
              <Sparkles className="h-3 w-3 mr-1" />
              Mock
            </Button>
            <Button 
              variant={dataSource === 'db' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setDataSource('db')}
            >
              <Database className="h-3 w-3 mr-1" />
              Database
            </Button>
          </div>
          {dataSource === 'db' && (
            <Badge variant="secondary" className="ml-2">Live Data</Badge>
          )}
        </div>

        {/* Gaspedaal Control Panel - Primary Focus */}
        <GaspedaalControlPanel />

        {/* Gaspedaal Job History */}
        <ScraperJobHistory source="gaspedaal" />

        {/* Scrape Audit Panel - Data Quality Monitoring */}
        <ScrapeAuditPanel />

        {/* Rest of Admin UI */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Portal Configuration & Crawler Jobs */}
          <div className="lg:col-span-2 space-y-6">
            {/* Portal Configuration - Now Functional */}
            <PortalConfigPanel />

            {/* Crawler Jobs - Now uses live data */}
            <CrawlerJobsTable />
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

            {/* API Settings - Now Functional */}
            <SystemSettingsCard />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
