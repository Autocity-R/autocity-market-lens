import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { BestsellersFilters, BestsellersFiltersState } from '@/components/bestsellers/BestsellersFilters';
import { BestsellersTable } from '@/components/bestsellers/BestsellersTable';
import { useCourantheid, useRecalculateCourantheid } from '@/hooks/useCourantheid';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function Bestsellers() {
  const [filters, setFilters] = useState<BestsellersFiltersState>({});
  
  const { data, isLoading, error } = useCourantheid(filters);
  const recalculate = useRecalculateCourantheid();

  const handleRecalculate = async () => {
    try {
      await recalculate.mutateAsync({ filters });
      toast.success('Segmenten herberekend');
    } catch (err) {
      toast.error('Fout bij herberekenen');
    }
  };

  const segments = data?.segments || [];

  return (
    <MainLayout
      title="Bestsellers"
      subtitle="Ontdek welke voertuigsegmenten het beste verkopen op de Nederlandse markt"
    >
      <div className="space-y-6">
        {/* Filters */}
        <BestsellersFilters
          filters={filters}
          onFiltersChange={setFilters}
          onRecalculate={handleRecalculate}
          isRecalculating={recalculate.isPending}
          segmentCount={segments.length}
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
          <BestsellersTable 
            segments={segments} 
            isLoading={isLoading} 
          />
        )}
      </div>
    </MainLayout>
  );
}
