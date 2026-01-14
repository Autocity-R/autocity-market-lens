import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CourantheidBadge } from '@/components/shared/CourantheidBadge';
import { useValuation, ValuationRequest, ValuationResult } from '@/hooks/useValuation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TrendingDown,
  TrendingUp,
  BarChart3,
  Download,
  Car,
  Clock,
  Users,
  Layers,
  Loader2,
  CheckCircle,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const brandOptions = [
  { value: 'Volkswagen', label: 'Volkswagen' },
  { value: 'BMW', label: 'BMW' },
  { value: 'Mercedes-Benz', label: 'Mercedes-Benz' },
  { value: 'Audi', label: 'Audi' },
  { value: 'Toyota', label: 'Toyota' },
  { value: 'Tesla', label: 'Tesla' },
  { value: 'Volvo', label: 'Volvo' },
  { value: 'Peugeot', label: 'Peugeot' },
  { value: 'Renault', label: 'Renault' },
  { value: 'Ford', label: 'Ford' },
  { value: 'Opel', label: 'Opel' },
  { value: 'Kia', label: 'Kia' },
  { value: 'Hyundai', label: 'Hyundai' },
];

const fuelOptions = [
  { value: 'benzine', label: 'Benzine' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'elektrisch', label: 'Elektrisch' },
  { value: 'hybride', label: 'Hybride' },
  { value: 'plug-in hybride', label: 'Plug-in Hybride' },
];

const transmissionOptions = [
  { value: 'automaat', label: 'Automaat' },
  { value: 'handgeschakeld', label: 'Handgeschakeld' },
];

const conditionOptions = [
  { value: 'excellent', label: 'Uitstekend' },
  { value: 'good', label: 'Goed' },
  { value: 'fair', label: 'Redelijk' },
  { value: 'poor', label: 'Matig' },
];

export default function Valuation() {
  const valuation = useValuation();
  const [result, setResult] = useState<ValuationResult | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<ValuationRequest>({
    make: '',
    model: '',
    year: new Date().getFullYear() - 3,
    mileage: 50000,
    fuelType: '',
    transmission: '',
    condition: 'good',
    options: [],
  });

  const handleInputChange = (field: keyof ValuationRequest, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAnalyze = async () => {
    if (!formData.make || !formData.model || !formData.fuelType) {
      toast.error('Vul merk, model en brandstof in');
      return;
    }

    try {
      const data = await valuation.mutateAsync(formData);
      setResult(data);
      toast.success('Taxatie voltooid');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Taxatie mislukt');
    }
  };

  return (
    <MainLayout
      title="AI Taxatie"
      subtitle="Marktconforme waardebepaling met AI-analyse"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Form */}
        <div className="lg:col-span-1">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-primary" />
                Voertuiggegevens
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Make */}
              <div>
                <Label className="text-xs text-muted-foreground">Merk *</Label>
                <Select 
                  value={formData.make} 
                  onValueChange={(v) => handleInputChange('make', v)}
                >
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

              {/* Model */}
              <div>
                <Label className="text-xs text-muted-foreground">Model *</Label>
                <Input
                  value={formData.model}
                  onChange={(e) => handleInputChange('model', e.target.value)}
                  placeholder="bijv. Golf, 3 Serie, A4"
                  className="mt-1 bg-muted border-border"
                />
              </div>

              {/* Year */}
              <div>
                <Label className="text-xs text-muted-foreground">Bouwjaar</Label>
                <Input
                  type="number"
                  value={formData.year}
                  onChange={(e) => handleInputChange('year', parseInt(e.target.value))}
                  min={2010}
                  max={new Date().getFullYear()}
                  className="mt-1 bg-muted border-border"
                />
              </div>

              {/* Mileage */}
              <div>
                <Label className="text-xs text-muted-foreground">Kilometerstand</Label>
                <Input
                  type="number"
                  value={formData.mileage}
                  onChange={(e) => handleInputChange('mileage', parseInt(e.target.value))}
                  min={0}
                  step={1000}
                  className="mt-1 bg-muted border-border"
                />
              </div>

              {/* Fuel Type */}
              <div>
                <Label className="text-xs text-muted-foreground">Brandstof *</Label>
                <Select 
                  value={formData.fuelType} 
                  onValueChange={(v) => handleInputChange('fuelType', v)}
                >
                  <SelectTrigger className="mt-1 bg-muted border-border">
                    <SelectValue placeholder="Selecteer brandstof" />
                  </SelectTrigger>
                  <SelectContent>
                    {fuelOptions.map((fuel) => (
                      <SelectItem key={fuel.value} value={fuel.value}>
                        {fuel.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Transmission */}
              <div>
                <Label className="text-xs text-muted-foreground">Transmissie</Label>
                <Select 
                  value={formData.transmission} 
                  onValueChange={(v) => handleInputChange('transmission', v)}
                >
                  <SelectTrigger className="mt-1 bg-muted border-border">
                    <SelectValue placeholder="Selecteer transmissie" />
                  </SelectTrigger>
                  <SelectContent>
                    {transmissionOptions.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Condition */}
              <div>
                <Label className="text-xs text-muted-foreground">Conditie</Label>
                <Select 
                  value={formData.condition} 
                  onValueChange={(v) => handleInputChange('condition', v as any)}
                >
                  <SelectTrigger className="mt-1 bg-muted border-border">
                    <SelectValue placeholder="Selecteer conditie" />
                  </SelectTrigger>
                  <SelectContent>
                    {conditionOptions.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Action Button */}
              <Button 
                className="w-full mt-4" 
                onClick={handleAnalyze}
                disabled={valuation.isPending}
              >
                {valuation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyseren...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Taxeer met AI
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-6">
          {/* No result yet */}
          {!result && !valuation.isPending && (
            <Card className="bg-card border-border">
              <CardContent className="p-12 text-center">
                <Car className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium mb-2">Voer voertuiggegevens in</h3>
                <p className="text-muted-foreground">
                  Vul de gegevens in het formulier in om een AI-gedreven taxatie te ontvangen 
                  gebaseerd op actuele marktdata.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Loading state */}
          {valuation.isPending && (
            <Card className="bg-card border-border">
              <CardContent className="p-12 text-center">
                <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin mb-4" />
                <h3 className="text-lg font-medium mb-2">Markt analyseren...</h3>
                <p className="text-muted-foreground">
                  We vergelijken met {formData.make} {formData.model} listings in de database...
                </p>
              </CardContent>
            </Card>
          )}

          {/* Error state */}
          {valuation.isError && (
            <Card className="bg-card border-destructive">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                  <div>
                    <p className="font-medium">Taxatie mislukt</p>
                    <p className="text-sm text-muted-foreground">
                      {valuation.error instanceof Error ? valuation.error.message : 'Onbekende fout'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {result && (
            <>
              {/* Main Valuation Card */}
              <Card className="bg-card border-border overflow-hidden">
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 border-b border-border p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Layers className="h-5 w-5 text-primary" />
                        <h3 className="text-lg font-medium text-foreground">
                          {formData.make} {formData.model} {formData.year}
                        </h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formData.mileage.toLocaleString()} km • {formData.fuelType} • {formData.transmission || 'Onbekend'}
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-1" />
                      Rapport
                    </Button>
                  </div>
                </div>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-primary">
                        €{result.estimatedValue.toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">Geschatte waarde</p>
                      <p className="text-xs text-muted-foreground">
                        €{result.priceRange.low.toLocaleString()} - €{result.priceRange.high.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-3xl font-bold text-success">{result.confidence}%</span>
                        {result.confidence >= 70 ? (
                          <CheckCircle className="h-5 w-5 text-success" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-warning" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">Betrouwbaarheid</p>
                      <Progress value={result.confidence} className="h-1.5 mt-2" />
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-foreground">{result.windowSize}</p>
                      <p className="text-sm text-muted-foreground mt-1">Vergelijkbare</p>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <Car className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">voertuigen</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-foreground">{result.avgDaysOnMarket}d</p>
                      <p className="text-sm text-muted-foreground mt-1">Gem. doorlooptijd</p>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">in dit segment</span>
                      </div>
                    </div>
                  </div>

                  {/* Options adjustment */}
                  {result.optionsAdjustment !== 0 && (
                    <div className="mt-4 p-3 rounded-lg bg-muted/50">
                      <p className="text-sm">
                        <span className="font-medium">Opties correctie: </span>
                        <span className={result.optionsAdjustment > 0 ? 'text-success' : 'text-destructive'}>
                          {result.optionsAdjustment > 0 ? '+' : ''}€{result.optionsAdjustment.toLocaleString()}
                        </span>
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* AI Market Insight */}
              {result.marketInsight && (
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Sparkles className="h-4 w-4 text-primary" />
                      AI Marktinzicht
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{result.marketInsight}</p>
                  </CardContent>
                </Card>
              )}

              {/* Comparables */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Vergelijkbare Voertuigen</CardTitle>
                </CardHeader>
                <CardContent>
                  {result.comparables.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      Geen vergelijkbare voertuigen gevonden
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {result.comparables.map((comp, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {comp.isSold ? (
                              <Badge variant="default" className="bg-success">Verkocht</Badge>
                            ) : (
                              <Badge variant="outline">Actief</Badge>
                            )}
                            <div>
                              <p className="text-sm font-medium text-foreground">{comp.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {comp.mileage.toLocaleString()} km
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-foreground">
                              €{comp.price.toLocaleString()}
                            </p>
                            <p className={cn(
                              'text-xs',
                              comp.daysOnMarket <= 20 ? 'text-success' : 
                              comp.daysOnMarket <= 40 ? 'text-warning' : 'text-destructive'
                            )}>
                              {comp.daysOnMarket} dagen {comp.isSold ? 'tot verkoop' : 'online'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
