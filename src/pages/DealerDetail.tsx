import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useDealerAnalysis, useDealersList } from '@/hooks/useDealerIntelligence';
import { 
  Building2, 
  MapPin, 
  Car, 
  TrendingUp, 
  Clock, 
  DollarSign,
  BarChart3,
  Loader2,
  ArrowLeft,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function DealerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selectedDealerId, setSelectedDealerId] = useState<string | undefined>(id);
  
  const { data: dealers, isLoading: dealersLoading } = useDealersList();
  const { data: analysis, isLoading, error } = useDealerAnalysis(
    selectedDealerId ? { dealerId: selectedDealerId } : undefined
  );

  const handleDealerChange = (dealerId: string) => {
    setSelectedDealerId(dealerId);
    navigate(`/dealers/${dealerId}`, { replace: true });
  };

  const getPriceStrategyColor = (strategy: string) => {
    switch (strategy) {
      case 'aggressive': return 'text-success bg-success/10';
      case 'premium': return 'text-warning bg-warning/10';
      default: return 'text-primary bg-primary/10';
    }
  };

  const getPriceStrategyLabel = (strategy: string) => {
    switch (strategy) {
      case 'aggressive': return 'Agressief geprijsd';
      case 'premium': return 'Premium geprijsd';
      default: return 'Marktconform';
    }
  };

  return (
    <MainLayout
      title="Dealer Intelligence"
      subtitle="Gedetailleerde analyse van dealer performance en voorraad"
    >
      <div className="space-y-6">
        {/* Header with dealer selector */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dealers">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Select value={selectedDealerId} onValueChange={handleDealerChange}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Selecteer een dealer" />
            </SelectTrigger>
            <SelectContent>
              {dealersLoading && (
                <div className="p-2 text-center text-muted-foreground">Laden...</div>
              )}
              {dealers?.map((dealer) => (
                <SelectItem key={dealer.id} value={dealer.id}>
                  {dealer.name_raw || dealer.name_normalized || 'Unknown'} 
                  {dealer.city && ` - ${dealer.city}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Loading state */}
        {isLoading && selectedDealerId && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Dealer analyseren...</span>
          </div>
        )}

        {/* No dealer selected */}
        {!selectedDealerId && (
          <Card>
            <CardContent className="p-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Selecteer een dealer</h3>
              <p className="text-muted-foreground">
                Kies een dealer uit de lijst om de volledige analyse te bekijken.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Error state */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="p-6">
              <p className="text-destructive">
                Fout bij laden: {error instanceof Error ? error.message : 'Onbekende fout'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Analysis results */}
        {analysis && (
          <>
            {/* Dealer header */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">{analysis.dealer.name}</h2>
                      <div className="flex items-center gap-2 text-muted-foreground mt-1">
                        <MapPin className="h-4 w-4" />
                        <span>{analysis.dealer.city}</span>
                      </div>
                    </div>
                  </div>
                  <Badge className={getPriceStrategyColor(analysis.performance.priceStrategy)}>
                    {getPriceStrategyLabel(analysis.performance.priceStrategy)}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Car className="h-8 w-8 text-primary/50" />
                    <div>
                      <p className="text-2xl font-bold">{analysis.dealer.activeListings}</p>
                      <p className="text-sm text-muted-foreground">Actieve listings</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-8 w-8 text-success/50" />
                    <div>
                      <p className="text-2xl font-bold">{analysis.dealer.totalSold}</p>
                      <p className="text-sm text-muted-foreground">Verkocht (90d)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Clock className="h-8 w-8 text-warning/50" />
                    <div>
                      <p className="text-2xl font-bold">{analysis.performance.avgDaysOnMarket}d</p>
                      <p className="text-sm text-muted-foreground">Gem. doorlooptijd</p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className={cn(
                      "text-xs",
                      analysis.performance.avgDaysOnMarket < analysis.performance.marketAvgDaysOnMarket
                        ? "text-success"
                        : "text-destructive"
                    )}>
                      {analysis.performance.avgDaysOnMarket < analysis.performance.marketAvgDaysOnMarket ? '↓' : '↑'} 
                      vs markt ({analysis.performance.marketAvgDaysOnMarket}d)
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-8 w-8 text-primary/50" />
                    <div>
                      <p className="text-2xl font-bold">{analysis.performance.sellThroughRate}%</p>
                      <p className="text-sm text-muted-foreground">Sell-through rate</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Price comparison */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Prijsvergelijking met Markt</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Dealer gemiddelde</p>
                    <p className="text-3xl font-bold">€{analysis.performance.avgPrice.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Markt gemiddelde</p>
                    <p className="text-3xl font-bold text-muted-foreground">
                      €{analysis.performance.marketAvgPrice.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Prijspositie</span>
                    <span className={cn(
                      analysis.performance.avgPrice < analysis.performance.marketAvgPrice * 0.95
                        ? "text-success"
                        : analysis.performance.avgPrice > analysis.performance.marketAvgPrice * 1.05
                          ? "text-warning"
                          : "text-primary"
                    )}>
                      {Math.round((analysis.performance.avgPrice / analysis.performance.marketAvgPrice - 1) * 100)}% vs markt
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(100, (analysis.performance.avgPrice / analysis.performance.marketAvgPrice) * 50)} 
                    className="h-2" 
                  />
                </div>
              </CardContent>
            </Card>

            {/* Top makes & models */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Top Merken</CardTitle>
                </CardHeader>
                <CardContent>
                  {analysis.topMakes.length === 0 ? (
                    <p className="text-muted-foreground">Geen data beschikbaar</p>
                  ) : (
                    <div className="space-y-3">
                      {analysis.topMakes.map((make, index) => (
                        <div key={make.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>
                            <span className="font-medium">{make.name}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{make.count} stuks</p>
                            <p className="text-xs text-muted-foreground">
                              Gem. €{make.avgPrice.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Top Modellen</CardTitle>
                </CardHeader>
                <CardContent>
                  {analysis.topModels.length === 0 ? (
                    <p className="text-muted-foreground">Geen data beschikbaar</p>
                  ) : (
                    <div className="space-y-3">
                      {analysis.topModels.map((model, index) => (
                        <div key={model.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>
                            <span className="font-medium">{model.name}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{model.count} stuks</p>
                            <p className="text-xs text-muted-foreground">
                              Gem. €{model.avgPrice.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Recent sales */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recente Verkopen</CardTitle>
              </CardHeader>
              <CardContent>
                {analysis.recentSales.length === 0 ? (
                  <p className="text-muted-foreground">Geen recente verkopen gevonden</p>
                ) : (
                  <div className="space-y-3">
                    {analysis.recentSales.map((sale, index) => (
                      <div 
                        key={index} 
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div>
                          <p className="font-medium">{sale.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(sale.soldAt).toLocaleDateString('nl-NL')} • {sale.daysOnMarket} dagen online
                          </p>
                        </div>
                        <p className="font-semibold">€{sale.price.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Inventory breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Voorraad per Prijsklasse</CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(analysis.inventory.byPriceBucket).length === 0 ? (
                    <p className="text-muted-foreground">Geen data beschikbaar</p>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(analysis.inventory.byPriceBucket)
                        .sort((a, b) => b[1] - a[1])
                        .map(([bucket, count]) => (
                          <div key={bucket} className="flex items-center justify-between">
                            <span>{bucket}</span>
                            <div className="flex items-center gap-2">
                              <Progress 
                                value={(count / analysis.inventory.total) * 100} 
                                className="w-20 h-2" 
                              />
                              <span className="text-sm font-medium w-8">{count}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Voorraad per Brandstof</CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(analysis.inventory.byFuelType).length === 0 ? (
                    <p className="text-muted-foreground">Geen data beschikbaar</p>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(analysis.inventory.byFuelType)
                        .sort((a, b) => b[1] - a[1])
                        .map(([fuel, count]) => (
                          <div key={fuel} className="flex items-center justify-between">
                            <span className="capitalize">{fuel}</span>
                            <div className="flex items-center gap-2">
                              <Progress 
                                value={(count / analysis.inventory.total) * 100} 
                                className="w-20 h-2" 
                              />
                              <span className="text-sm font-medium w-8">{count}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
