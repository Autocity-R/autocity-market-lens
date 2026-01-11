import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({ title, value, change, changeLabel, icon, className }: StatCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;
  const isNeutral = !change || change === 0;

  return (
    <div className={cn('stat-card', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
        </div>
        {icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
        )}
      </div>
      {change !== undefined && (
        <div className="mt-3 flex items-center gap-1 text-sm">
          {isPositive && <TrendingUp className="h-4 w-4 trend-positive" />}
          {isNegative && <TrendingDown className="h-4 w-4 trend-negative" />}
          {isNeutral && <Minus className="h-4 w-4 trend-neutral" />}
          <span className={cn(
            isPositive && 'trend-positive',
            isNegative && 'trend-negative',
            isNeutral && 'trend-neutral'
          )}>
            {isPositive && '+'}{change}%
          </span>
          {changeLabel && (
            <span className="text-muted-foreground">{changeLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
