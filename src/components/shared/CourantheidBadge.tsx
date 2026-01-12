import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CourantheidBadgeProps {
  score: number;
  trend?: 'up' | 'down' | 'stable';
  showLabel?: boolean;
  showTrend?: boolean;
  compact?: boolean;
  className?: string;
}

export function CourantheidBadge({
  score,
  trend = 'stable',
  showLabel = false,
  showTrend = true,
  compact = false,
  className,
}: CourantheidBadgeProps) {
  const getLabel = (score: number) => {
    if (score >= 85) return 'Zeer Courant';
    if (score >= 60) return 'Gemiddeld';
    return 'Traag';
  };

  const getColorClass = (score: number) => {
    if (score >= 85) return 'text-success bg-success/10 border-success/30';
    if (score >= 60) return 'text-warning bg-warning/10 border-warning/30';
    return 'text-destructive bg-destructive/10 border-destructive/30';
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-success" />;
      case 'down':
        return <TrendingDown className="h-3 w-3 text-destructive" />;
      default:
        return <Minus className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const label = getLabel(score);
  const colorClass = getColorClass(score);

  const tooltipContent = (
    <div className="space-y-1.5 text-xs">
      <p className="font-medium">Courantheid Score: {score}/100</p>
      <p className="text-muted-foreground">
        {score >= 85 && 'Dit marktsegment verkoopt snel. Hoge vraag, korte doorlooptijd.'}
        {score >= 60 && score < 85 && 'Gemiddelde verkoopsnelheid. Normale marktomstandigheden.'}
        {score < 60 && 'Trage verkoop. Overweeg prijsaanpassing of andere strategie.'}
      </p>
      {showTrend && (
        <p className="flex items-center gap-1">
          Trend: {trend === 'up' ? '↑ Stijgend' : trend === 'down' ? '↓ Dalend' : '→ Stabiel'}
        </p>
      )}
    </div>
  );

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium border cursor-help',
              colorClass,
              className
            )}
          >
            <span>{score}</span>
            {showTrend && getTrendIcon()}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-sm font-medium border cursor-help',
            colorClass,
            className
          )}
        >
          <span>{score}</span>
          {showLabel && <span className="text-xs opacity-80">{label}</span>}
          {showTrend && getTrendIcon()}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {tooltipContent}
      </TooltipContent>
    </Tooltip>
  );
}
