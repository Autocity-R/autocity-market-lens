import { mockListings, type Listing } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CourantheidBadge } from '@/components/shared/CourantheidBadge';
import {
  TrendingDown,
  ExternalLink,
  MoreHorizontal,
  Eye,
  Bookmark,
  BarChart3,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ListingTable() {
  const getConfidenceBadge = (score: number) => {
    if (score >= 90) return 'badge-confidence-high';
    if (score >= 75) return 'badge-confidence-medium';
    return 'badge-confidence-low';
  };

  const formatPrice = (price: number) => `€${price.toLocaleString()}`;

  const getPriceChange = (listing: Listing) => {
    if (!listing.previousPrice) return null;
    const change = listing.price - listing.previousPrice;
    const percentage = ((change / listing.previousPrice) * 100).toFixed(1);
    return { change, percentage };
  };

  return (
    <div className="stat-card overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-foreground">Markt Listings</h3>
          <p className="text-xs text-muted-foreground">52.340 resultaten gevonden</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            Exporteer
          </Button>
          <Button size="sm">
            Opslaan als Segment
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-border">
              <th className="pb-3 pr-3 w-10">
                <Checkbox />
              </th>
              <th className="pb-3 text-left text-xs font-medium text-muted-foreground">Voertuig</th>
              <th className="pb-3 text-right text-xs font-medium text-muted-foreground">Prijs</th>
              <th className="pb-3 text-right text-xs font-medium text-muted-foreground">KM Stand</th>
              <th className="pb-3 text-left text-xs font-medium text-muted-foreground">Dealer</th>
              <th className="pb-3 text-center text-xs font-medium text-muted-foreground">Portal</th>
              <th className="pb-3 text-center text-xs font-medium text-muted-foreground">Dagen</th>
              <th className="pb-3 text-center text-xs font-medium text-muted-foreground">Courant</th>
              <th className="pb-3 text-center text-xs font-medium text-muted-foreground">AI</th>
              <th className="pb-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {mockListings.map((listing) => {
              const priceChange = getPriceChange(listing);
              return (
                <tr
                  key={listing.id}
                  className="data-table-row border-b border-border/50 last:border-0"
                >
                  <td className="py-3 pr-3">
                    <Checkbox />
                  </td>
                  <td className="py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{listing.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{listing.year}</span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">{listing.fuelType}</span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">{listing.transmission}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 text-right">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {formatPrice(listing.price)}
                      </p>
                      {priceChange && (
                        <div className="flex items-center justify-end gap-1 text-xs trend-negative">
                          <TrendingDown className="h-3 w-3" />
                          <span>{formatPrice(priceChange.change)}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-3 text-right text-sm text-muted-foreground">
                    {listing.mileage.toLocaleString()} km
                  </td>
                  <td className="py-3">
                    <p className="text-sm text-foreground">{listing.dealer}</p>
                  </td>
                  <td className="py-3 text-center">
                    <Badge variant="outline" className="text-xs">
                      {listing.portal}
                    </Badge>
                  </td>
                  <td className="py-3 text-center">
                    <span className={cn(
                      'text-sm font-medium',
                      listing.daysOnMarket > 60 ? 'text-destructive' :
                      listing.daysOnMarket > 30 ? 'text-warning' : 'text-foreground'
                    )}>
                      {listing.daysOnMarket}d
                    </span>
                  </td>
                  <td className="py-3 text-center">
                    <CourantheidBadge
                      score={listing.courantheid}
                      trend={listing.courantheidTrend}
                      compact
                    />
                  </td>
                  <td className="py-3 text-center">
                    <Badge className={cn('text-xs', getConfidenceBadge(listing.confidenceScore))}>
                      {listing.confidenceScore}%
                    </Badge>
                  </td>
                  <td className="py-3">
                      {listing.confidenceScore}%
                    </Badge>
                  </td>
                  <td className="py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="mr-2 h-4 w-4" />
                          Bekijk details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open op portal
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <BarChart3 className="mr-2 h-4 w-4" />
                          Prijshistorie
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                          <Bookmark className="mr-2 h-4 w-4" />
                          Toevoegen aan watchlist
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
        <p className="text-sm text-muted-foreground">
          1-8 van 52.340 resultaten
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled>
            Vorige
          </Button>
          <Button variant="outline" size="sm" className="bg-primary text-primary-foreground">
            1
          </Button>
          <Button variant="outline" size="sm">2</Button>
          <Button variant="outline" size="sm">3</Button>
          <span className="text-muted-foreground">...</span>
          <Button variant="outline" size="sm">6543</Button>
          <Button variant="outline" size="sm">
            Volgende
          </Button>
        </div>
      </div>
    </div>
  );
}
