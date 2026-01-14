import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CourantheidBadge } from '@/components/shared/CourantheidBadge';
import { useCourantheid, useRecalculateCourantheid } from '@/hooks/useCourantheid';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  RefreshCw, 
  Car, 
  Clock, 
  DollarSign,
  BarChart3,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

export default function Bestsellers() {
  const { data, isLoading, error } = useCourantheid();
  const recalculate = useRecalculateCourantheid();

  const handleRecalculate = async () => {
    try {
      await recalculate.mutateAsync(undefined);
      toast.success('Courantheid scores herberekend');
    } catch (err) {
      toast.error('Fout bij herberekenen');
    }
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

  const segments = data?.segments || [];

  return (
    <MainLayout
      title="Bestsellers"
      subtitle="Top segmenten gerangschikt op courantheid en verkoopsnelheid"
    >
      <div className="space-y-6">
        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-sm">
              {segments.length} segmenten
            </Badge>
            {data && (
              <span className="text-sm text-muted-foreground">
                Laatste update: {new Date().toLocaleTimeString('nl-NL')}
              </span>
            )}
          </div>
          <Button 
            onClick={handleRecalculate}
            disabled={recalculate.isPending}
            variant="outline"
          >
            {recalculate.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Herbereken
          </Button>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Segmenten laden...</span>
          </div>
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

        {/* Empty state */}
        {!isLoading && !error && segments.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Geen segmenten gevonden</h3>
              <p className="text-muted-foreground mb-4">
                Start een herberekening om automatisch segmenten te genereren op basis van je listings data.
              </p>
              <Button onClick={handleRecalculate} disabled={recalculate.isPending}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Genereer segmenten
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Segments grid */}
        {segments.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {segments.map((segment, index) => (
              <Card 
                key={segment.id} 
                className={cn(
                  "hover:border-primary/50 transition-colors",
                  index < 3 && "border-primary/30 bg-primary/5"
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-muted-foreground">
                        #{index + 1}
                      </span>
                      <div>
                        <CardTitle className="text-base">{segment.name}</CardTitle>
                        <div className="flex items-center gap-1 mt-1">
                          {getTrendIcon(segment.trend)}
                          <span className="text-xs text-muted-foreground capitalize">
                            {segment.trend === 'up' ? 'Stijgend' : 
                             segment.trend === 'down' ? 'Dalend' : 'Stabiel'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <CourantheidBadge score={segment.score} trend={segment.trend} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Score bar */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Courantheid</span>
                        <span className="font-medium">{segment.score}/100</span>
                      </div>
                      <Progress value={segment.score} className="h-2" />
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{segment.windowSize}</p>
                          <p className="text-xs text-muted-foreground">Actief</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-success" />
                        <div>
                          <p className="text-sm font-medium">{segment.salesLast30Days}</p>
                          <p className="text-xs text-muted-foreground">Verkocht/30d</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{Math.round(segment.avgDaysOnMarket)}d</p>
                          <p className="text-xs text-muted-foreground">Gem. DOM</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">
                            €{segment.medianPrice?.toLocaleString() || 0}
                          </p>
                          <p className="text-xs text-muted-foreground">Mediaan</p>
                        </div>
                      </div>
                    </div>

                    {/* Action */}
                    <Button variant="outline" size="sm" className="w-full mt-2" asChild>
                      <Link to={`/listings?segment=${segment.id}`}>
                        Bekijk listings
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
