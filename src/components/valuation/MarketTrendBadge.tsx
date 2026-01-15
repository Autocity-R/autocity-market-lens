import { MarketTrend } from '@/hooks/useValuation';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  trend: MarketTrend;
  className?: string;
}

export function MarketTrendBadge({ trend, className }: Props) {
  const getIcon = () => {
    switch (trend.direction) {
      case 'rising':
        return <TrendingUp className="h-3 w-3" />;
      case 'falling':
        return <TrendingDown className="h-3 w-3" />;
      default:
        return <Minus className="h-3 w-3" />;
    }
  };

  const getVariant = (): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (trend.direction) {
      case 'rising':
        return 'default';
      case 'falling':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getText = () => {
    if (trend.direction === 'stable') {
      return 'Stabiel';
    }
    const prefix = trend.percentage > 0 ? '+' : '';
    return `${prefix}${trend.percentage}%`;
  };

  return (
    <Badge variant={getVariant()} className={cn('gap-1', className)}>
      {getIcon()}
      <span>{getText()}</span>
      <span className="text-xs opacity-70">({trend.period})</span>
    </Badge>
  );
}
