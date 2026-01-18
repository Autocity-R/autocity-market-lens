import { Courantheid3D } from '@/hooks/useValuation';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Activity, TrendingUp, TrendingDown, Clock, Package } from 'lucide-react';

interface Props {
  courantheid: Courantheid3D;
}

export function CourantheidMeter({ courantheid }: Props) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-primary';
    if (score >= 40) return 'text-warning';
    return 'text-destructive';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-success';
    if (score >= 60) return 'bg-primary';
    if (score >= 40) return 'bg-warning';
    return 'bg-destructive';
  };

  const getLabelVariant = (label: string): 'default' | 'secondary' | 'outline' | 'destructive' => {
    switch (label) {
      case 'Zeer courant':
        return 'default';
      case 'Courant':
        return 'default';
      case 'Gemiddeld':
        return 'secondary';
      case 'Incourant':
        return 'outline';
      case 'Zeer incourant':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getSupplyStatusLabel = (status: Courantheid3D['supplyStatus']) => {
    switch (status) {
      case 'undersupplied':
        return 'Onderbezet';
      case 'balanced':
        return 'Evenwichtig';
      case 'oversupplied':
        return 'Overbezet';
    }
  };

  const getSupplyStatusColor = (status: Courantheid3D['supplyStatus']) => {
    switch (status) {
      case 'undersupplied':
        return 'text-success';
      case 'balanced':
        return 'text-primary';
      case 'oversupplied':
        return 'text-destructive';
    }
  };

  const formatPercentage = (rate: number) => {
    return `${Math.round(rate * 100)}%`;
  };

  return (
    <div className="p-4 rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Courantheid 3D</span>
        </div>
        <Badge variant={getLabelVariant(courantheid.label)}>
          {courantheid.label}
        </Badge>
      </div>

      {/* Score meter */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">Score</span>
          <span className={cn('text-lg font-bold', getScoreColor(courantheid.score))}>
            {courantheid.score}/100
          </span>
        </div>
        <div className="relative h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn('absolute inset-y-0 left-0 rounded-full transition-all', getScoreBgColor(courantheid.score))}
            style={{ width: `${courantheid.score}%` }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-2 rounded-md bg-muted/50">
          <div className="flex items-center gap-1 mb-1">
            <TrendingUp className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Sell-through</span>
          </div>
          <span className="text-sm font-semibold">
            {formatPercentage(courantheid.sellThroughRate)}
          </span>
        </div>
        <div className="p-2 rounded-md bg-muted/50">
          <div className="flex items-center gap-1 mb-1">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Gem. doorloop</span>
          </div>
          <span className="text-sm font-semibold">
            {courantheid.avgDaysOnMarket} dagen
          </span>
        </div>
        <div className="p-2 rounded-md bg-muted/50">
          <div className="flex items-center gap-1 mb-1">
            <Package className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Marktaanbod</span>
          </div>
          <span className="text-sm font-semibold">
            {courantheid.marketDaysSupply}d voorraad
          </span>
        </div>
        <div className="p-2 rounded-md bg-muted/50">
          <div className="flex items-center gap-1 mb-1">
            <Activity className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Marktstatus</span>
          </div>
          <span className={cn('text-sm font-semibold', getSupplyStatusColor(courantheid.supplyStatus))}>
            {getSupplyStatusLabel(courantheid.supplyStatus)}
          </span>
        </div>
      </div>

      {/* Price impact */}
      {courantheid.priceImpact !== 0 && (
        <div className={cn(
          'mt-3 p-2 rounded-md border',
          courantheid.priceImpact > 0 
            ? 'bg-success/10 border-success/20' 
            : 'bg-warning/10 border-warning/20'
        )}>
          <div className="flex items-center gap-2">
            {courantheid.priceImpact > 0 ? (
              <TrendingUp className="h-3 w-3 text-success" />
            ) : (
              <TrendingDown className="h-3 w-3 text-warning" />
            )}
            <span className="text-xs">
              Prijsimpact: {courantheid.priceImpact > 0 ? '+' : ''}{Math.round(courantheid.priceImpact * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
