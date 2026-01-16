import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { DealersFilters, DealersFiltersState } from '@/components/dealers/DealersFilters';
import { DealersTable } from '@/components/dealers/DealersTable';
import { useDealersList, useDealerStats } from '@/hooks/useDealerIntelligence';
import { Building2, Car, Clock, TrendingUp, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dealers() {
  const [filters, setFilters] = useState<DealersFiltersState>({
    sortBy: 'sales',
    sortOrder: 'desc',
  });

  const { data: dealers = [], isLoading, error } = useDealersList(filters);
  const { data: stats, isLoading: statsLoading } = useDealerStats();

  return (
    <MainLayout
      title="Dealer Intelligence"
      subtitle="Analyse van dealernetwerk - wie verkoopt het meest en wat verkopen ze"
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-2xl font-bold">{stats?.totalDealers.toLocaleString()}</p>
                  )}
                  <p className="text-sm text-muted-foreground">Actieve dealers</p>
                </div>
                <Building2 className="h-8 w-8 text-primary/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-2xl font-bold">{stats?.totalListings.toLocaleString()}</p>
                  )}
                  <p className="text-sm text-muted-foreground">Totale voorraad</p>
                </div>
                <Car className="h-8 w-8 text-primary/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-2xl font-bold">{stats?.avgDaysOnMarket}d</p>
                  )}
                  <p className="text-sm text-muted-foreground">Gem. doorlooptijd</p>
                </div>
                <Clock className="h-8 w-8 text-primary/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-2xl font-bold">{stats?.totalSales.toLocaleString()}</p>
                  )}
                  <p className="text-sm text-muted-foreground">Verkopen (30d)</p>
                </div>
                <TrendingUp className="h-8 w-8 text-success/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <DealersFilters
          filters={filters}
          onFiltersChange={setFilters}
          dealerCount={dealers.length}
        />

        {/* Error state */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="p-6 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-destructive">
                Fout bij laden: {error instanceof Error ? error.message : 'Onbekende fout'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Table */}
        {!error && (
          <DealersTable 
            dealers={dealers} 
            isLoading={isLoading} 
          />
        )}
      </div>
    </MainLayout>
  );
}
