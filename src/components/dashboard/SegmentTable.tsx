import { mockSegments } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export function SegmentTable() {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-foreground">Segment Performance</h3>
          <p className="text-xs text-muted-foreground">Top marktsegmenten op courantheid</p>
        </div>
        <Button variant="ghost" size="sm" className="text-xs text-primary">
          Alle segmenten <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="pb-3 text-left text-xs font-medium text-muted-foreground">Segment</th>
              <th className="pb-3 text-right text-xs font-medium text-muted-foreground">Listings</th>
              <th className="pb-3 text-right text-xs font-medium text-muted-foreground">Gem. Prijs</th>
              <th className="pb-3 text-right text-xs font-medium text-muted-foreground">7d Δ</th>
              <th className="pb-3 text-right text-xs font-medium text-muted-foreground">Courantheid</th>
            </tr>
          </thead>
          <tbody>
            {mockSegments.map((segment) => (
              <tr key={segment.id} className="data-table-row border-b border-border/50 last:border-0">
                <td className="py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{segment.name}</p>
                    <p className="text-xs text-muted-foreground">{segment.make}</p>
                  </div>
                </td>
                <td className="py-3 text-right text-sm text-foreground">
                  {segment.count.toLocaleString()}
                </td>
                <td className="py-3 text-right text-sm font-medium text-foreground">
                  €{segment.avgPrice.toLocaleString()}
                </td>
                <td className="py-3 text-right">
                  <div className={cn(
                    'inline-flex items-center gap-1 text-sm',
                    segment.priceChange7d > 0 ? 'trend-positive' : segment.priceChange7d < 0 ? 'trend-negative' : 'trend-neutral'
                  )}>
                    {segment.priceChange7d > 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : segment.priceChange7d < 0 ? (
                      <TrendingDown className="h-3 w-3" />
                    ) : (
                      <Minus className="h-3 w-3" />
                    )}
                    {segment.priceChange7d > 0 && '+'}{segment.priceChange7d}%
                  </div>
                </td>
                <td className="py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <Progress
                      value={segment.courantheid}
                      className="w-16 h-1.5"
                    />
                    <span className={cn(
                      'text-sm font-medium min-w-[2.5rem] text-right',
                      segment.courantheid >= 85 ? 'text-success' :
                      segment.courantheid >= 70 ? 'text-warning' : 'text-destructive'
                    )}>
                      {segment.courantheid}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
