import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { RefreshCw, X, Loader2 } from 'lucide-react';
import { useVehicleMakes, useVehicleModels, useVehicleFuels, useVehicleTransmissions } from '@/hooks/useVehicleValues';

export interface BestsellersFiltersState {
  make?: string;
  model?: string;
  fuelType?: string;
  transmission?: string;
  yearFrom?: number;
  yearTo?: number;
  mileageMin?: number;
  mileageMax?: number;
}

interface BestsellersFiltersProps {
  filters: BestsellersFiltersState;
  onFiltersChange: (filters: BestsellersFiltersState) => void;
  onRecalculate: () => void;
  isRecalculating: boolean;
  segmentCount: number;
}

const YEAR_OPTIONS = Array.from({ length: 12 }, (_, i) => 2025 - i);
const MILEAGE_OPTIONS = [
  { value: 0, label: '0 km' },
  { value: 30000, label: '30.000 km' },
  { value: 60000, label: '60.000 km' },
  { value: 100000, label: '100.000 km' },
  { value: 150000, label: '150.000 km' },
  { value: 200000, label: '200.000 km' },
];

export function BestsellersFilters({
  filters,
  onFiltersChange,
  onRecalculate,
  isRecalculating,
  segmentCount,
}: BestsellersFiltersProps) {
  const { data: makes = [], isLoading: makesLoading } = useVehicleMakes();
  const { data: models = [], isLoading: modelsLoading } = useVehicleModels(filters.make);
  const { data: fuels = [], isLoading: fuelsLoading } = useVehicleFuels();
  const { data: transmissions = [], isLoading: transmissionsLoading } = useVehicleTransmissions();

  const handleFilterChange = (key: keyof BestsellersFiltersState, value: string | number | undefined) => {
    const newFilters = { ...filters };
    
    if (value === 'all' || value === undefined || value === '') {
      delete newFilters[key];
    } else {
      (newFilters as any)[key] = value;
    }

    // Reset model when make changes
    if (key === 'make') {
      delete newFilters.model;
    }

    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const hasFilters = Object.keys(filters).length > 0;

  return (
    <div className="bg-card border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Filters</h3>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
            <X className="h-3 w-3 mr-1" />
            Wis filters
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {/* Make */}
        <div className="space-y-1.5">
          <Label className="text-xs">Merk</Label>
          <Select
            value={filters.make || 'all'}
            onValueChange={(value) => handleFilterChange('make', value)}
            disabled={makesLoading}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Alle merken" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle merken</SelectItem>
              {makes.map((make) => (
                <SelectItem key={make} value={make}>
                  {make}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Model */}
        <div className="space-y-1.5">
          <Label className="text-xs">Model</Label>
          <Select
            value={filters.model || 'all'}
            onValueChange={(value) => handleFilterChange('model', value)}
            disabled={!filters.make || modelsLoading}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Alle modellen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle modellen</SelectItem>
              {models.map((model) => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Fuel Type */}
        <div className="space-y-1.5">
          <Label className="text-xs">Brandstof</Label>
          <Select
            value={filters.fuelType || 'all'}
            onValueChange={(value) => handleFilterChange('fuelType', value)}
            disabled={fuelsLoading}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Alle brandstoffen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle brandstoffen</SelectItem>
              {fuels.map((fuel) => (
                <SelectItem key={fuel} value={fuel}>
                  {fuel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Transmission */}
        <div className="space-y-1.5">
          <Label className="text-xs">Transmissie</Label>
          <Select
            value={filters.transmission || 'all'}
            onValueChange={(value) => handleFilterChange('transmission', value)}
            disabled={transmissionsLoading}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Alle transmissies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle transmissies</SelectItem>
              {transmissions.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Year From */}
        <div className="space-y-1.5">
          <Label className="text-xs">Bouwjaar vanaf</Label>
          <Select
            value={filters.yearFrom?.toString() || 'all'}
            onValueChange={(value) => handleFilterChange('yearFrom', value === 'all' ? undefined : parseInt(value))}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Geen min" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Geen min</SelectItem>
              {YEAR_OPTIONS.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Year To */}
        <div className="space-y-1.5">
          <Label className="text-xs">Bouwjaar t/m</Label>
          <Select
            value={filters.yearTo?.toString() || 'all'}
            onValueChange={(value) => handleFilterChange('yearTo', value === 'all' ? undefined : parseInt(value))}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Geen max" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Geen max</SelectItem>
              {YEAR_OPTIONS.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Mileage Min */}
        <div className="space-y-1.5">
          <Label className="text-xs">Km-stand vanaf</Label>
          <Select
            value={filters.mileageMin?.toString() || 'all'}
            onValueChange={(value) => handleFilterChange('mileageMin', value === 'all' ? undefined : parseInt(value))}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Geen min" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Geen min</SelectItem>
              {MILEAGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value.toString()}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Mileage Max */}
        <div className="space-y-1.5">
          <Label className="text-xs">Km-stand t/m</Label>
          <Select
            value={filters.mileageMax?.toString() || 'all'}
            onValueChange={(value) => handleFilterChange('mileageMax', value === 'all' ? undefined : parseInt(value))}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Geen max" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Geen max</SelectItem>
              {MILEAGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value.toString()}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t">
        <span className="text-sm text-muted-foreground">
          {segmentCount} segment{segmentCount !== 1 ? 'en' : ''} gevonden
        </span>
        <Button onClick={onRecalculate} disabled={isRecalculating} size="sm">
          {isRecalculating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Herbereken
        </Button>
      </div>
    </div>
  );
}
