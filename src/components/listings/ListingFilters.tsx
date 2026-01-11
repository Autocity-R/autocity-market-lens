import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, X, SlidersHorizontal, RotateCcw } from 'lucide-react';

const makes = ['Alle merken', 'Audi', 'BMW', 'Mercedes-Benz', 'Volkswagen', 'Toyota', 'Tesla', 'Volvo', 'Peugeot'];
const fuelTypes = ['Alle brandstoffen', 'Benzine', 'Diesel', 'Elektrisch', 'Hybride', 'Plug-in Hybride'];
const transmissions = ['Alle transmissies', 'Automaat', 'Handgeschakeld'];
const portals = ['Alle portals', 'AutoTrack', 'AutoScout24', 'Marktplaats', 'Gaspedaal'];
const statuses = ['Alle statussen', 'Actief', 'Verkocht', 'Verwijderd'];

export function ListingFilters() {
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const addFilter = (filter: string) => {
    if (!activeFilters.includes(filter) && !filter.startsWith('Alle')) {
      setActiveFilters([...activeFilters, filter]);
    }
  };

  const removeFilter = (filter: string) => {
    setActiveFilters(activeFilters.filter(f => f !== filter));
  };

  const clearFilters = () => {
    setActiveFilters([]);
  };

  return (
    <div className="stat-card mb-6">
      {/* Search Bar */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoek op merk, model, kenteken of dealer..."
            className="pl-10 bg-muted border-border"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={showAdvanced ? 'border-primary text-primary' : ''}
        >
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          Filters
        </Button>
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Select onValueChange={addFilter}>
          <SelectTrigger className="w-40 bg-muted border-border">
            <SelectValue placeholder="Merk" />
          </SelectTrigger>
          <SelectContent>
            {makes.map((make) => (
              <SelectItem key={make} value={make}>{make}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select onValueChange={addFilter}>
          <SelectTrigger className="w-40 bg-muted border-border">
            <SelectValue placeholder="Brandstof" />
          </SelectTrigger>
          <SelectContent>
            {fuelTypes.map((fuel) => (
              <SelectItem key={fuel} value={fuel}>{fuel}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select onValueChange={addFilter}>
          <SelectTrigger className="w-40 bg-muted border-border">
            <SelectValue placeholder="Transmissie" />
          </SelectTrigger>
          <SelectContent>
            {transmissions.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select onValueChange={addFilter}>
          <SelectTrigger className="w-36 bg-muted border-border">
            <SelectValue placeholder="Portal" />
          </SelectTrigger>
          <SelectContent>
            {portals.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select onValueChange={addFilter}>
          <SelectTrigger className="w-36 bg-muted border-border">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-t border-border">
          <div>
            <Label className="text-xs text-muted-foreground">Bouwjaar van</Label>
            <Input type="number" placeholder="2018" className="mt-1 bg-muted border-border" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Bouwjaar tot</Label>
            <Input type="number" placeholder="2024" className="mt-1 bg-muted border-border" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Prijs van</Label>
            <Input type="number" placeholder="€10.000" className="mt-1 bg-muted border-border" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Prijs tot</Label>
            <Input type="number" placeholder="€50.000" className="mt-1 bg-muted border-border" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">KM stand max</Label>
            <Input type="number" placeholder="100.000" className="mt-1 bg-muted border-border" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Dagen online max</Label>
            <Input type="number" placeholder="90" className="mt-1 bg-muted border-border" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Min. AI Confidence</Label>
            <Input type="number" placeholder="80%" className="mt-1 bg-muted border-border" />
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" className="flex-1">
              <Badge className="mr-2 badge-normalized">AI</Badge>
              Genormaliseerd
            </Button>
          </div>
        </div>
      )}

      {/* Active Filters */}
      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2 pt-4 border-t border-border">
          <span className="text-xs text-muted-foreground">Actieve filters:</span>
          {activeFilters.map((filter) => (
            <Badge
              key={filter}
              variant="secondary"
              className="flex items-center gap-1 cursor-pointer hover:bg-destructive/20"
              onClick={() => removeFilter(filter)}
            >
              {filter}
              <X className="h-3 w-3" />
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-xs text-muted-foreground hover:text-foreground ml-auto"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Wis alles
          </Button>
        </div>
      )}
    </div>
  );
}
