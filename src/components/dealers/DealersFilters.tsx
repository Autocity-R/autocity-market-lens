import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X, ArrowUpDown } from 'lucide-react';
import { useDealerCities } from '@/hooks/useDealerIntelligence';

export interface DealersFiltersState {
  search?: string;
  city?: string;
  yearFrom?: number;
  yearTo?: number;
  sortBy?: 'sales' | 'listings' | 'name' | 'dom';
  sortOrder?: 'asc' | 'desc';
}

interface DealersFiltersProps {
  filters: DealersFiltersState;
  onFiltersChange: (filters: DealersFiltersState) => void;
  dealerCount: number;
}

const YEAR_OPTIONS = Array.from({ length: 15 }, (_, i) => 2025 - i);

const SORT_OPTIONS = [
  { value: 'sales', label: 'Meeste verkopen' },
  { value: 'listings', label: 'Meeste listings' },
  { value: 'dom', label: 'Snelste verkoop' },
  { value: 'name', label: 'Naam' },
];

export function DealersFilters({
  filters,
  onFiltersChange,
  dealerCount,
}: DealersFiltersProps) {
  const { data: cities = [] } = useDealerCities();

  const handleFilterChange = (key: keyof DealersFiltersState, value: string | number | undefined) => {
    const newFilters = { ...filters };
    
    if (value === 'all' || value === undefined || value === '') {
      delete newFilters[key];
    } else {
      (newFilters as any)[key] = value;
    }

    onFiltersChange(newFilters);
  };

  const handleSearchChange = (value: string) => {
    const newFilters = { ...filters };
    if (value) {
      newFilters.search = value;
    } else {
      delete newFilters.search;
    }
    onFiltersChange(newFilters);
  };

  const toggleSortOrder = () => {
    onFiltersChange({
      ...filters,
      sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc',
    });
  };

  const clearFilters = () => {
    onFiltersChange({ sortBy: 'sales', sortOrder: 'desc' });
  };

  const hasFilters = filters.search || filters.city || filters.yearFrom || filters.yearTo;

  return (
    <div className="bg-card border rounded-lg p-4 space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Zoek op dealernaam of locatie..."
          value={filters.search || ''}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* City */}
        <div className="space-y-1.5">
          <Label className="text-xs">Plaats</Label>
          <Select
            value={filters.city || 'all'}
            onValueChange={(value) => handleFilterChange('city', value)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Alle plaatsen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle plaatsen</SelectItem>
              {cities.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Year From - Filter dealers that sell cars from this year */}
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

        {/* Sort By */}
        <div className="space-y-1.5">
          <Label className="text-xs">Sorteer op</Label>
          <Select
            value={filters.sortBy || 'sales'}
            onValueChange={(value) => handleFilterChange('sortBy', value as DealersFiltersState['sortBy'])}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sort Order Toggle */}
        <div className="space-y-1.5">
          <Label className="text-xs">Volgorde</Label>
          <Button 
            variant="outline" 
            className="h-9 w-full justify-between"
            onClick={toggleSortOrder}
          >
            {filters.sortOrder === 'asc' ? 'Oplopend' : 'Aflopend'}
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t">
        <span className="text-sm text-muted-foreground">
          {dealerCount} dealer{dealerCount !== 1 ? 's' : ''} gevonden
        </span>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
            <X className="h-3 w-3 mr-1" />
            Wis filters
          </Button>
        )}
      </div>
    </div>
  );
}
