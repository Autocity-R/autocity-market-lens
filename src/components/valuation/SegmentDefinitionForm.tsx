import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Layers, Search, Save, ChevronDown, ChevronUp } from 'lucide-react';

interface SegmentDefinitionFormProps {
  onAnalyze: () => void;
  onSaveSegment: () => void;
}

const brandOptions = [
  { value: 'alle', label: 'Alle merken' },
  { value: 'volkswagen', label: 'Volkswagen' },
  { value: 'bmw', label: 'BMW' },
  { value: 'mercedes', label: 'Mercedes-Benz' },
  { value: 'audi', label: 'Audi' },
  { value: 'toyota', label: 'Toyota' },
  { value: 'tesla', label: 'Tesla' },
  { value: 'volvo', label: 'Volvo' },
  { value: 'peugeot', label: 'Peugeot' },
];

const modelOptions: Record<string, { value: string; label: string }[]> = {
  volkswagen: [
    { value: 'golf', label: 'Golf' },
    { value: 'polo', label: 'Polo' },
    { value: 'passat', label: 'Passat' },
    { value: 'tiguan', label: 'Tiguan' },
    { value: 'id3', label: 'ID.3' },
    { value: 'id4', label: 'ID.4' },
  ],
  bmw: [
    { value: '3serie', label: '3 Serie' },
    { value: '5serie', label: '5 Serie' },
    { value: 'x1', label: 'X1' },
    { value: 'x3', label: 'X3' },
    { value: 'i4', label: 'i4' },
  ],
  mercedes: [
    { value: 'a-klasse', label: 'A-Klasse' },
    { value: 'c-klasse', label: 'C-Klasse' },
    { value: 'e-klasse', label: 'E-Klasse' },
    { value: 'glc', label: 'GLC' },
    { value: 'eqc', label: 'EQC' },
  ],
  audi: [
    { value: 'a3', label: 'A3' },
    { value: 'a4', label: 'A4' },
    { value: 'a6', label: 'A6' },
    { value: 'q3', label: 'Q3' },
    { value: 'q5', label: 'Q5' },
    { value: 'e-tron', label: 'e-tron' },
  ],
  toyota: [
    { value: 'corolla', label: 'Corolla' },
    { value: 'rav4', label: 'RAV4' },
    { value: 'yaris', label: 'Yaris' },
    { value: 'chr', label: 'C-HR' },
  ],
  tesla: [
    { value: 'model3', label: 'Model 3' },
    { value: 'modely', label: 'Model Y' },
    { value: 'models', label: 'Model S' },
    { value: 'modelx', label: 'Model X' },
  ],
  volvo: [
    { value: 'xc40', label: 'XC40' },
    { value: 'xc60', label: 'XC60' },
    { value: 'xc90', label: 'XC90' },
    { value: 'v60', label: 'V60' },
  ],
  peugeot: [
    { value: '208', label: '208' },
    { value: '308', label: '308' },
    { value: '3008', label: '3008' },
    { value: '5008', label: '5008' },
  ],
};

const fuelOptions = [
  { value: 'benzine', label: 'Benzine' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'elektrisch', label: 'Elektrisch' },
  { value: 'hybride', label: 'Hybride' },
  { value: 'plugin-hybride', label: 'Plug-in Hybride' },
];

const optionsList = [
  { id: 'airco', label: 'Airconditioning' },
  { id: 'navigatie', label: 'Navigatie' },
  { id: 'leder', label: 'Lederen interieur' },
  { id: 'trekhaak', label: 'Trekhaak' },
  { id: 'panoramadak', label: 'Panoramadak' },
  { id: 'led', label: 'LED verlichting' },
];

export function SegmentDefinitionForm({ onAnalyze, onSaveSegment }: SegmentDefinitionFormProps) {
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedFuels, setSelectedFuels] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  const handleFuelToggle = (fuel: string) => {
    setSelectedFuels((prev) =>
      prev.includes(fuel) ? prev.filter((f) => f !== fuel) : [...prev, fuel]
    );
  };

  const handleOptionToggle = (option: string) => {
    setSelectedOptions((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    );
  };

  const showBattery = selectedFuels.some((f) =>
    ['elektrisch', 'plugin-hybride'].includes(f)
  );

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Layers className="h-5 w-5 text-primary" />
          Definieer Marktsegment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Brand & Model */}
        <div>
          <Label className="text-xs text-muted-foreground">Merk</Label>
          <Select value={selectedBrand} onValueChange={setSelectedBrand}>
            <SelectTrigger className="mt-1 bg-muted border-border">
              <SelectValue placeholder="Selecteer merk" />
            </SelectTrigger>
            <SelectContent>
              {brandOptions.map((brand) => (
                <SelectItem key={brand.value} value={brand.value}>
                  {brand.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedBrand && selectedBrand !== 'alle' && modelOptions[selectedBrand] && (
          <div>
            <Label className="text-xs text-muted-foreground">Model</Label>
            <Select>
              <SelectTrigger className="mt-1 bg-muted border-border">
                <SelectValue placeholder="Selecteer model (optioneel)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle modellen</SelectItem>
                {modelOptions[selectedBrand].map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Year Range */}
        <div>
          <Label className="text-xs text-muted-foreground">Bouwjaar range</Label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <Input
              type="number"
              placeholder="Van (2018)"
              min={2010}
              max={2025}
              className="bg-muted border-border"
            />
            <Input
              type="number"
              placeholder="Tot (2024)"
              min={2010}
              max={2025}
              className="bg-muted border-border"
            />
          </div>
        </div>

        {/* Mileage Range */}
        <div>
          <Label className="text-xs text-muted-foreground">Kilometerstand range</Label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <Input
              type="number"
              placeholder="Van (0)"
              min={0}
              className="bg-muted border-border"
            />
            <Input
              type="number"
              placeholder="Tot (150.000)"
              min={0}
              className="bg-muted border-border"
            />
          </div>
        </div>

        {/* Fuel Type Multi-Select */}
        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">Brandstof</Label>
          <div className="flex flex-wrap gap-2">
            {fuelOptions.map((fuel) => (
              <button
                key={fuel.value}
                onClick={() => handleFuelToggle(fuel.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  selectedFuels.includes(fuel.value)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted text-muted-foreground border-border hover:border-primary/50'
                }`}
              >
                {fuel.label}
              </button>
            ))}
          </div>
        </div>

        {/* Transmission */}
        <div>
          <Label className="text-xs text-muted-foreground">Transmissie</Label>
          <Select>
            <SelectTrigger className="mt-1 bg-muted border-border">
              <SelectValue placeholder="Alle transmissies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle transmissies</SelectItem>
              <SelectItem value="automaat">Automaat</SelectItem>
              <SelectItem value="handgeschakeld">Handgeschakeld</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Advanced Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
        >
          {showAdvanced ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          {showAdvanced ? 'Minder opties' : 'Meer opties'}
        </button>

        {showAdvanced && (
          <div className="space-y-4 pt-2 border-t border-border">
            {/* Power Range */}
            <div>
              <Label className="text-xs text-muted-foreground">Vermogen (PK)</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Input
                  type="number"
                  placeholder="Van (100)"
                  min={0}
                  className="bg-muted border-border"
                />
                <Input
                  type="number"
                  placeholder="Tot (500)"
                  min={0}
                  className="bg-muted border-border"
                />
              </div>
            </div>

            {/* Battery Range (conditional) */}
            {showBattery && (
              <div>
                <Label className="text-xs text-muted-foreground">Batterijcapaciteit (kWh)</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <Input
                    type="number"
                    placeholder="Van (30)"
                    min={0}
                    className="bg-muted border-border"
                  />
                  <Input
                    type="number"
                    placeholder="Tot (100)"
                    min={0}
                    className="bg-muted border-border"
                  />
                </div>
              </div>
            )}

            {/* Options Checkboxes */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Opties (optioneel)</Label>
              <div className="grid grid-cols-2 gap-2">
                {optionsList.map((option) => (
                  <div key={option.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={option.id}
                      checked={selectedOptions.includes(option.id)}
                      onCheckedChange={() => handleOptionToggle(option.id)}
                    />
                    <label
                      htmlFor={option.id}
                      className="text-sm text-muted-foreground cursor-pointer"
                    >
                      {option.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 pt-4">
          <Button className="w-full" onClick={onAnalyze}>
            <Search className="h-4 w-4 mr-2" />
            Analyseer Marktsegment
          </Button>
          <Button variant="outline" className="w-full" onClick={onSaveSegment}>
            <Save className="h-4 w-4 mr-2" />
            Opslaan in Segment Library
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
