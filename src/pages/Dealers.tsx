import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { mockDealers } from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ComparisonContextSelector } from '@/components/dealers/ComparisonContextSelector';
import { CourantheidBadge } from '@/components/shared/CourantheidBadge';
import {
  Search,
  Building2,
  TrendingUp,
  TrendingDown,
  Clock,
  MapPin,
  ChevronRight,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Dealers() {
  const [comparisonContext, setComparisonContext] = useState('market');

  const getPricingBadge = (strategy: string) => {
    switch (strategy) {
      case 'aggressive':
        return { label: 'Agressief', className: 'bg-success/20 text-success border-success/30' };
      case 'premium':
        return { label: 'Premium', className: 'bg-warning/20 text-warning border-warning/30' };
      default:
        return { label: 'Markt', className: 'bg-info/20 text-info border-info/30' };
    }
  };

  const marketAvgCourantheid = 84;

  return (
    <MainLayout
      title="Dealer Intelligence"
      subtitle="Analyse van dealernetwerk en voorraadstrategie"
    >
      {/* Context Selector */}
      <div className="mb-6">
        <ComparisonContextSelector value={comparisonContext} onChange={setComparisonContext} />
      </div>

      {/* Search */}
      <div className="stat-card mb-6">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Zoek op dealernaam of locatie..."
              className="pl-10 bg-muted border-border"
            />
          </div>
          <Button variant="outline">Filters</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">1.247</p>
                <p className="text-sm text-muted-foreground">Actieve dealers</p>
              </div>
              <Building2 className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">52.340</p>
                <p className="text-sm text-muted-foreground">Totale voorraad</p>
              </div>
              <div className="text-right">
                <TrendingUp className="h-5 w-5 text-success inline" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">32d</p>
                <p className="text-sm text-muted-foreground">Gem. doorlooptijd</p>
              </div>
              <Clock className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <CourantheidBadge score={marketAvgCourantheid} showLabel />
                <p className="text-sm text-muted-foreground mt-1">Markt Courantheid</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dealer List */}
      <div className="space-y-4">
        {mockDealers.map((dealer) => {
          const pricingBadge = getPricingBadge(dealer.pricingStrategy);
          const courantheidVsMarket = dealer.avgCourantheid - marketAvgCourantheid;

          return (
            <Card key={dealer.id} className="bg-card border-border hover:border-primary/30 transition-all cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-foreground">{dealer.name}</h3>
                        <Badge className={cn('text-xs border', pricingBadge.className)}>
                          {pricingBadge.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {dealer.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          Reactietijd: {dealer.responseTime}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-6 gap-6 mt-6 pt-6 border-t border-border">
                  <div>
                    <p className="text-2xl font-bold text-foreground">{dealer.activeListings}</p>
                    <p className="text-xs text-muted-foreground">Actieve listings</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{dealer.soldLastMonth}</p>
                    <p className="text-xs text-muted-foreground">Verkocht (30d)</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{dealer.avgDaysOnMarket}d</p>
                    <p className="text-xs text-muted-foreground">Gem. doorlooptijd</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <p className={cn(
                        'text-2xl font-bold',
                        dealer.avgPriceVsMarket > 0 ? 'trend-positive' : 'trend-negative'
                      )}>
                        {dealer.avgPriceVsMarket > 0 ? '+' : ''}{dealer.avgPriceVsMarket}%
                      </p>
                      {dealer.avgPriceVsMarket > 0 ? (
                        <TrendingUp className="h-4 w-4 trend-positive" />
                      ) : (
                        <TrendingDown className="h-4 w-4 trend-negative" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">vs marktprijs</p>
                  </div>
                  <div>
                    <CourantheidBadge score={dealer.avgCourantheid} compact />
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className={courantheidVsMarket >= 0 ? 'text-success' : 'text-destructive'}>
                        {courantheidVsMarket >= 0 ? '+' : ''}{courantheidVsMarket}
                      </span> vs markt
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={cn(
                            'h-4 w-4',
                            star <= 4 ? 'text-warning fill-warning' : 'text-muted'
                          )}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Data kwaliteit</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Load More */}
      <div className="flex justify-center mt-6">
        <Button variant="outline">
          Laad meer dealers
        </Button>
      </div>
    </MainLayout>
  );
}
