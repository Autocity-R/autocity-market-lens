import { MainLayout } from '@/components/layout/MainLayout';
import { mockSegments } from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CourantheidBadge } from '@/components/shared/CourantheidBadge';
import {
  Search,
  Plus,
  Layers,
  TrendingUp,
  TrendingDown,
  Minus,
  Bell,
  Eye,
  Edit,
  Trash2,
  ExternalLink,
  BarChart3,
  Link2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

export default function SegmentLibrary() {
  const formatFilters = (segment: (typeof mockSegments)[0]) => {
    const parts = [];
    if (segment.make !== 'Alle') parts.push(segment.make);
    if (segment.model) parts.push(segment.model);
    parts.push(`${segment.yearFrom}-${segment.yearTo}`);
    if (segment.filters.mileageTo) {
      parts.push(`≤${(segment.filters.mileageTo / 1000).toFixed(0)}k km`);
    }
    if (segment.filters.fuelType && segment.filters.fuelType.length > 0) {
      parts.push(segment.filters.fuelType.join(', '));
    }
    return parts.join(' • ');
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-success" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <MainLayout
      title="Segment Library"
      subtitle="Centrale kennislaag voor marktsegmenten"
    >
      {/* Header Actions */}
      <div className="stat-card mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek in segmenten..."
                className="pl-10 bg-muted border-border"
              />
            </div>
          </div>
          <Button asChild>
            <Link to="/valuation">
              <Plus className="h-4 w-4 mr-2" />
              Nieuw Segment
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">{mockSegments.length}</p>
                <p className="text-sm text-muted-foreground">Opgeslagen segmenten</p>
              </div>
              <Layers className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {mockSegments.filter((s) => s.isWatched).length}
                </p>
                <p className="text-sm text-muted-foreground">Actief bewaakt</p>
              </div>
              <Eye className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {mockSegments.reduce((acc, s) => acc + s.linkedAlerts, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Gekoppelde alerts</p>
              </div>
              <Bell className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {mockSegments.filter((s) => s.linkedToInventory).length}
                </p>
                <p className="text-sm text-muted-foreground">In Inventory Monitor</p>
              </div>
              <Link2 className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Segments Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {mockSegments.map((segment) => (
          <Card
            key={segment.id}
            className={cn(
              'bg-card border-border hover:border-primary/30 transition-all',
              segment.isWatched && 'ring-1 ring-primary/20'
            )}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {segment.name}
                    {segment.isWatched && (
                      <Badge variant="secondary" className="text-xs">
                        <Eye className="h-3 w-3 mr-1" />
                        Bewaakt
                      </Badge>
                    )}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatFilters(segment)}
                  </p>
                </div>
                <CourantheidBadge
                  score={segment.courantheid}
                  trend={segment.courantheidTrend}
                  showLabel
                />
              </div>
            </CardHeader>
            <CardContent>
              {/* Metrics */}
              <div className="grid grid-cols-4 gap-4 mb-4 pb-4 border-b border-border">
                <div>
                  <p className="text-xl font-bold text-foreground">
                    {segment.count.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Listings</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">
                    €{segment.avgPrice.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Gem. prijs</p>
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    <p
                      className={cn(
                        'text-xl font-bold',
                        segment.priceChange7d > 0 ? 'trend-positive' : 'trend-negative'
                      )}
                    >
                      {segment.priceChange7d > 0 ? '+' : ''}
                      {segment.priceChange7d}%
                    </p>
                    {getTrendIcon(segment.priceChange7d > 0 ? 'up' : segment.priceChange7d < 0 ? 'down' : 'stable')}
                  </div>
                  <p className="text-xs text-muted-foreground">7 dagen</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{segment.avgConfidence}%</p>
                  <p className="text-xs text-muted-foreground">Confidence</p>
                </div>
              </div>

              {/* Status & Links */}
              <div className="flex items-center gap-4 mb-4 text-sm">
                {segment.linkedAlerts > 0 && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Bell className="h-3.5 w-3.5" />
                    <span>{segment.linkedAlerts} alerts</span>
                  </div>
                )}
                {segment.linkedToInventory && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Link2 className="h-3.5 w-3.5" />
                    <span>In Inventory Monitor</span>
                  </div>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  Aangemaakt: {new Date(segment.createdAt).toLocaleDateString('nl-NL')}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button variant="default" size="sm" className="flex-1" asChild>
                  <Link to="/valuation">
                    <BarChart3 className="h-4 w-4 mr-1" />
                    Open in Taxatie
                  </Link>
                </Button>
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm">
                  <Link2 className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm">
                  <Bell className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State Helper */}
      <Card className="bg-card border-border border-dashed mt-4">
        <CardContent className="p-8 text-center">
          <Layers className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            Maak een nieuw marktsegment aan
          </h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Definieer een marktsegment in de Taxatie module en sla het hier op voor hergebruik,
            alerts en inventory monitoring.
          </p>
          <Button asChild>
            <Link to="/valuation">
              <Plus className="h-4 w-4 mr-2" />
              Nieuw Segment Definiëren
            </Link>
          </Button>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
