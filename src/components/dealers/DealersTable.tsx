import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  MapPin, 
  TrendingUp, 
  Clock, 
  Car,
  ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { DealerListItem } from '@/hooks/useDealerIntelligence';

interface DealersTableProps {
  dealers: DealerListItem[];
  isLoading?: boolean;
}

function getPriceStrategyBadge(strategy: string | null) {
  switch (strategy) {
    case 'aggressive':
      return { label: 'Agressief', className: 'bg-success/20 text-success border-success/30' };
    case 'premium':
      return { label: 'Premium', className: 'bg-warning/20 text-warning border-warning/30' };
    case 'market':
      return { label: 'Markt', className: 'bg-primary/20 text-primary border-primary/30' };
    default:
      return null;
  }
}

export function DealersTable({ dealers, isLoading }: DealersTableProps) {
  if (isLoading) {
    return (
      <div className="border rounded-lg">
        <div className="p-8 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3 mx-auto"></div>
            <div className="h-4 bg-muted rounded w-1/2 mx-auto"></div>
            <div className="h-4 bg-muted rounded w-2/5 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  if (dealers.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center">
        <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Geen dealers gevonden</h3>
        <p className="text-muted-foreground">
          Pas de filters aan om dealers te vinden.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-12 text-center">#</TableHead>
            <TableHead>Dealer</TableHead>
            <TableHead className="text-center w-28">
              <div className="flex items-center justify-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Verkocht</span>
              </div>
            </TableHead>
            <TableHead className="text-center w-28">
              <div className="flex items-center justify-center gap-1">
                <Car className="h-3.5 w-3.5" />
                <span>Listings</span>
              </div>
            </TableHead>
            <TableHead className="text-center w-24">
              <div className="flex items-center justify-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span>DOM</span>
              </div>
            </TableHead>
            <TableHead className="text-center w-28">Gem. Prijs</TableHead>
            <TableHead className="w-24">Strategie</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dealers.map((dealer, index) => {
            const rank = index + 1;
            const isTopTen = rank <= 10;
            const strategyBadge = getPriceStrategyBadge(dealer.priceStrategy);

            return (
              <TableRow 
                key={dealer.id}
                className="group hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => window.location.href = `/dealers/${dealer.id}`}
              >
                  <TableCell className="text-center">
                    <span className={cn(
                      "text-lg font-bold",
                      isTopTen ? "text-primary" : "text-muted-foreground"
                    )}>
                      {rank}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{dealer.name}</p>
                        {dealer.city && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {dealer.city}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={cn(
                      "font-semibold",
                      dealer.soldCount > 10 ? "text-success" : 
                      dealer.soldCount > 0 ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {dealer.soldCount}
                    </span>
                    <span className="text-xs text-muted-foreground"> /30d</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="font-mono">
                      {dealer.activeListings}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {dealer.avgDaysOnMarket !== null ? (
                      <span className={cn(
                        "font-medium",
                        dealer.avgDaysOnMarket <= 25 ? "text-success" :
                        dealer.avgDaysOnMarket <= 45 ? "text-warning" : "text-destructive"
                      )}>
                        {Math.round(dealer.avgDaysOnMarket)}d
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {dealer.avgPrice ? (
                      <span className="font-medium">
                        €{dealer.avgPrice.toLocaleString('nl-NL')}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {strategyBadge ? (
                      <Badge className={cn('text-xs border', strategyBadge.className)}>
                        {strategyBadge.label}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
