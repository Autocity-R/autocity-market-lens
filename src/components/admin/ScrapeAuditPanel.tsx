import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDataSource } from '@/providers/DataSourceProvider';
import {
  Database,
  FileText,
  CheckCircle,
  XCircle,
  TrendingUp,
  Coins,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

interface AuditStats {
  totalRawListings: number;
  totalListings: number;
  linkedListings: number;
  unlinkedRaw: number;
  parseSuccessRate: number;
  creditsToday: number;
  avgCreditsPerListing: number;
  recentRawListings: Array<{
    id: string;
    url: string;
    raw_title: string;
    scraped_at: string;
    content_hash: string;
    source: string;
  }>;
}

async function fetchAuditStats(): Promise<AuditStats> {
  // Get total raw listings
  const { count: rawCount } = await supabase
    .from('raw_listings')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'gaspedaal');

  // Get total listings
  const { count: listingsCount } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'gaspedaal');

  // Get listings with raw_listing_id (linked)
  const { count: linkedCount } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'gaspedaal')
    .not('raw_listing_id', 'is', null);

  // Get today's credit usage
  const today = new Date().toISOString().split('T')[0];
  const { data: creditData } = await supabase
    .from('scraper_credit_usage')
    .select('credits_used')
    .eq('source', 'gaspedaal')
    .eq('date', today)
    .maybeSingle();

  // Get recent raw listings
  const { data: recentRaw } = await supabase
    .from('raw_listings')
    .select('id, url, raw_title, scraped_at, content_hash, source')
    .eq('source', 'gaspedaal')
    .order('scraped_at', { ascending: false })
    .limit(10);

  const totalRaw = rawCount || 0;
  const totalListings = listingsCount || 0;
  const linked = linkedCount || 0;
  const creditsToday = creditData?.credits_used || 0;

  return {
    totalRawListings: totalRaw,
    totalListings,
    linkedListings: linked,
    unlinkedRaw: totalRaw - linked,
    parseSuccessRate: totalRaw > 0 ? (linked / totalRaw) * 100 : 100,
    creditsToday,
    avgCreditsPerListing: totalListings > 0 ? creditsToday / totalListings : 0,
    recentRawListings: recentRaw || [],
  };
}

export function ScrapeAuditPanel() {
  const { dataSource } = useDataSource();
  
  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['scrape-audit-stats', dataSource],
    queryFn: fetchAuditStats,
    enabled: dataSource === 'db',
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (dataSource !== 'db') {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Scrape Audit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Schakel naar Database mode om de scrape audit te bekijken.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary animate-spin" />
            Scrape Audit laden...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          Scrape Audit
        </CardTitle>
        <Badge variant="outline" className="text-xs">
          Live Data
        </Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <FileText className="h-3 w-3" />
              Raw Listings
            </div>
            <div className="text-2xl font-bold">{stats?.totalRawListings || 0}</div>
          </div>

          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <CheckCircle className="h-3 w-3" />
              Geparsed
            </div>
            <div className="text-2xl font-bold">{stats?.totalListings || 0}</div>
          </div>

          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className="h-3 w-3" />
              Parse Rate
            </div>
            <div className="text-2xl font-bold">
              {stats?.parseSuccessRate.toFixed(1) || 0}%
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Coins className="h-3 w-3" />
              Credits Vandaag
            </div>
            <div className="text-2xl font-bold">{stats?.creditsToday || 0}</div>
          </div>
        </div>

        {/* Data Quality Indicators */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Data Kwaliteit</h4>
          <div className="flex flex-wrap gap-2">
            {stats?.unlinkedRaw === 0 ? (
              <Badge className="bg-success/20 text-success border-success/30">
                <CheckCircle className="h-3 w-3 mr-1" />
                Alle raw listings gelinkt
              </Badge>
            ) : (
              <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" />
                {stats?.unlinkedRaw} ongelinkte raw listings
              </Badge>
            )}

            {(stats?.parseSuccessRate || 0) >= 90 ? (
              <Badge className="bg-success/20 text-success border-success/30">
                <CheckCircle className="h-3 w-3 mr-1" />
                Parse rate boven 90%
              </Badge>
            ) : (stats?.parseSuccessRate || 0) >= 60 ? (
              <Badge className="bg-warning/20 text-warning border-warning/30">
                Parse rate {stats?.parseSuccessRate.toFixed(1)}%
              </Badge>
            ) : (
              <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" />
                Lage parse rate: {stats?.parseSuccessRate.toFixed(1)}%
              </Badge>
            )}

            {stats?.creditsToday === 0 && (
              <Badge variant="secondary">
                Geen credits gebruikt vandaag
              </Badge>
            )}
          </div>
        </div>

        {/* Recent Raw Listings */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            Recente Raw Listings
          </h4>
          
          {(stats?.recentRawListings?.length || 0) === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Nog geen raw listings opgeslagen. Start een scrape om data te verzamelen.
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {stats?.recentRawListings.map((raw) => (
                <div
                  key={raw.id}
                  className="flex items-center justify-between p-2 bg-muted/30 rounded-md text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{raw.raw_title}</div>
                    <div className="text-muted-foreground truncate">{raw.url}</div>
                  </div>
                  <div className="text-muted-foreground ml-2 shrink-0">
                    {format(new Date(raw.scraped_at), 'HH:mm', { locale: nl })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Stats Footer */}
        <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Gemiddeld {stats?.avgCreditsPerListing.toFixed(2) || 0} credits per listing
          </span>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Vernieuwen
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
