import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toggle } from '@/components/ui/toggle';
import { useValuation, ValuationRequest, ValuationResult } from '@/hooks/useValuation';
import { useVehicleMakes, useVehicleModels, useVehicleFuels, useVehicleTransmissions, useVehicleBodyTypes, useVehicleYears } from '@/hooks/useVehicleValues';
import { RdwVehicle } from '@/hooks/useRdwLookup';
import { LicensePlateInput } from '@/components/valuation/LicensePlateInput';
import { OptionsSelector } from '@/components/valuation/OptionsSelector';
import { PriceBreakdown } from '@/components/valuation/PriceBreakdown';
import { CourantheidMeter } from '@/components/valuation/CourantheidMeter';
import { MarketTrendBadge } from '@/components/valuation/MarketTrendBadge';
import { OptionsAnalysisCard } from '@/components/valuation/OptionsAnalysisCard';
import { DataQualityAlert } from '@/components/valuation/DataQualityAlert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Car,
  Clock,
  Loader2,
  CheckCircle,
  AlertCircle,
  Sparkles,
  CreditCard,
  Wrench,
  Download,
  Layers,
  Zap,
  ChevronDown,
  TrendingUp,
  Shield,
  Eye,
  EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function Valuation() {
  const valuation = useValuation();
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [powerUnit, setPowerUnit] = useState<'hp' | 'kw'>('hp');
  const [activeTab, setActiveTab] = useState<'kenteken' | 'handmatig'>('kenteken');
  
  // Vehicle values data
  const { data: makes, isLoading: makesLoading } = useVehicleMakes();
  const { data: fuels } = useVehicleFuels();
  const { data: transmissions } = useVehicleTransmissions();
  const { data: bodyTypes } = useVehicleBodyTypes();
  const { data: years } = useVehicleYears();
  
  // Form state
  const [formData, setFormData] = useState<ValuationRequest>({
    make: '',
    model: '',
    year: new Date().getFullYear() - 3,
    mileage: 50000,
    fuelType: '',
    transmission: '',
    bodyType: '',
    power: undefined,
    options: [],
  });

  // Fetch models based on selected make
  const { data: models, isLoading: modelsLoading } = useVehicleModels(formData.make || undefined);

  const handleInputChange = (field: keyof ValuationRequest, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Reset model when make changes
    if (field === 'make') {
      setFormData(prev => ({ ...prev, model: '', options: [] }));
    }
  };

  const handlePowerChange = (value: string) => {
    const numValue = parseInt(value) || 0;
    if (powerUnit === 'hp') {
      setFormData(prev => ({
        ...prev,
        power: { hp: numValue, kw: Math.round(numValue * 0.7355) },
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        power: { kw: numValue, hp: Math.round(numValue / 0.7355) },
      }));
    }
  };

  const handleOptionsChange = (options: string[]) => {
    setFormData(prev => ({ ...prev, options }));
  };

  const handleRdwVehicleFound = (vehicle: RdwVehicle) => {
    setFormData({
      licensePlate: vehicle.licensePlate,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      mileage: 0, // User needs to fill this in
      fuelType: vehicle.fuelType,
      transmission: vehicle.transmission,
      bodyType: vehicle.bodyType,
      power: vehicle.power,
      options: [],
    });
    setActiveTab('handmatig'); // Switch to manual tab to complete details
  };

  const handleAnalyze = async () => {
    if (!formData.make || !formData.model || !formData.fuelType) {
      toast.error('Vul merk, model en brandstof in');
      return;
    }

    if (!formData.mileage || formData.mileage === 0) {
      toast.error('Vul de kilometerstand in');
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
        <div className="lg:col-span-1 space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-primary" />
                Voertuig Invoeren
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="kenteken" className="gap-2">
                    <CreditCard className="h-4 w-4" />
                    Kenteken
                  </TabsTrigger>
                  <TabsTrigger value="handmatig" className="gap-2">
                    <Wrench className="h-4 w-4" />
                    Handmatig
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="kenteken" className="mt-0">
                  <LicensePlateInput onVehicleFound={handleRdwVehicleFound} />
                </TabsContent>

                <TabsContent value="handmatig" className="mt-0 space-y-4">
                  {/* Make */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Merk *</Label>
                    <Select 
                      value={formData.make} 
                      onValueChange={(v) => handleInputChange('make', v)}
                    >
                      <SelectTrigger className="mt-1 bg-muted border-border">
                        <SelectValue placeholder={makesLoading ? 'Laden...' : 'Selecteer merk'} />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {makes?.map((make) => (
                          <SelectItem key={make} value={make}>
                            {make}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Model */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Model *</Label>
                    <Select 
                      value={formData.model} 
                      onValueChange={(v) => handleInputChange('model', v)}
                      disabled={!formData.make}
                    >
                      <SelectTrigger className="mt-1 bg-muted border-border">
                        <SelectValue placeholder={
                          !formData.make 
                            ? 'Selecteer eerst merk' 
                            : modelsLoading 
                              ? 'Laden...' 
                              : 'Selecteer model'
                        } />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {models?.map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Year */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Bouwjaar *</Label>
                    <Select 
                      value={formData.year.toString()} 
                      onValueChange={(v) => handleInputChange('year', parseInt(v))}
                    >
                      <SelectTrigger className="mt-1 bg-muted border-border">
                        <SelectValue placeholder="Selecteer bouwjaar" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {years?.map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Mileage */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Kilometerstand *</Label>
                    <Input
                      type="number"
                      value={formData.mileage || ''}
                      onChange={(e) => handleInputChange('mileage', parseInt(e.target.value) || 0)}
                      placeholder="bijv. 75000"
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
                        {fuels?.map((fuel) => (
                          <SelectItem key={fuel} value={fuel}>
                            {fuel}
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
                        {transmissions?.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Body Type */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Carrosserie</Label>
                    <Select 
                      value={formData.bodyType} 
                      onValueChange={(v) => handleInputChange('bodyType', v)}
                    >
                      <SelectTrigger className="mt-1 bg-muted border-border">
                        <SelectValue placeholder="Selecteer carrosserie" />
                      </SelectTrigger>
                      <SelectContent>
                        {bodyTypes?.map((bt) => (
                          <SelectItem key={bt} value={bt}>
                            {bt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Power */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Vermogen</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="number"
                        value={powerUnit === 'hp' ? (formData.power?.hp || '') : (formData.power?.kw || '')}
                        onChange={(e) => handlePowerChange(e.target.value)}
                        placeholder={powerUnit === 'hp' ? 'bijv. 150' : 'bijv. 110'}
                        min={0}
                        className="bg-muted border-border flex-1"
                      />
                      <div className="flex rounded-md border border-border overflow-hidden">
                        <Toggle
                          pressed={powerUnit === 'hp'}
                          onPressedChange={() => setPowerUnit('hp')}
                          className="rounded-none border-0 px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                        >
                          PK
                        </Toggle>
                        <Toggle
                          pressed={powerUnit === 'kw'}
                          onPressedChange={() => setPowerUnit('kw')}
                          className="rounded-none border-0 px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                        >
                          kW
                        </Toggle>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Options Card */}
          {activeTab === 'handmatig' && formData.make && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="h-4 w-4 text-primary" />
                  Waardevolle Opties
                  {formData.options && formData.options.length > 0 && (
                    <Badge variant="default" className="ml-auto">
                      {formData.options.length} geselecteerd
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <OptionsSelector
                  make={formData.make}
                  fuelType={formData.fuelType}
                  selectedOptions={formData.options || []}
                  onOptionsChange={handleOptionsChange}
                />
              </CardContent>
            </Card>
          )}

          {/* Analyze Button */}
          <Button 
            className="w-full" 
            size="lg"
            onClick={handleAnalyze}
            disabled={valuation.isPending || !formData.make || !formData.model || !formData.fuelType}
          >
            {valuation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyseren...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Taxeer Voertuig
              </>
            )}
          </Button>
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
                  Gebruik een kenteken of voer handmatig de voertuiggegevens in. 
                  Selecteer waardevolle opties voor een nauwkeurigere taxatie.
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
                  We vergelijken {formData.make} {formData.model} met vergelijkbare voertuigen...
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
            <ResultsSection result={result} formData={formData} />
          )}
        </div>
      </div>
    </MainLayout>
  );
}

// Separate results component for cleaner code
function ResultsSection({ result, formData }: { result: ValuationResult; formData: ValuationRequest }) {
  const [showOutliers, setShowOutliers] = useState(false);

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'text-success';
      case 'good': return 'text-primary';
      case 'fair': return 'text-warning';
      case 'limited': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getQualityLabel = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'Uitstekend';
      case 'good': return 'Goed';
      case 'fair': return 'Redelijk';
      case 'limited': return 'Beperkt';
      default: return quality;
    }
  };

  return (
    <div className="space-y-4">
      {/* Data Quality Warnings */}
      {result.dataQuality.warnings.length > 0 && (
        <DataQualityAlert dataQuality={result.dataQuality} />
      )}

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
                <MarketTrendBadge trend={result.marketTrend} />
              </div>
              <p className="text-sm text-muted-foreground">
                {formData.mileage?.toLocaleString()} km • {formData.fuelType} • {formData.transmission || 'Onbekend'}
                {formData.power?.hp && ` • ${formData.power.hp} PK`}
              </p>
              {formData.options && formData.options.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.options.length} opties geselecteerd
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={getQualityColor(result.dataQuality.quality)}>
                <Shield className="h-3 w-3 mr-1" />
                {getQualityLabel(result.dataQuality.quality)}
              </Badge>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-1" />
                Rapport
              </Button>
            </div>
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
              <p className="text-3xl font-bold text-foreground">{result.cohortSize}</p>
              <p className="text-sm text-muted-foreground mt-1">Vergelijkbare</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <Car className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">voertuigen</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-foreground">{result.salesCount}</p>
              <p className="text-sm text-muted-foreground mt-1">Recente verkopen</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">laatste 50 dagen</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Price Breakdown */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <PriceBreakdown breakdown={result.priceBreakdown} />
        </CardContent>
      </Card>

      {/* Grid for Courantheid and Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Courantheid Meter */}
        <CourantheidMeter courantheid={result.courantheid} />

        {/* Options Analysis */}
        <OptionsAnalysisCard analysis={result.optionsAnalysis} />
      </div>

      {/* AI Market Insight */}
      {result.marketInsight && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Marktinzicht
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{result.marketInsight}</p>
            
            {/* Risks */}
            {result.risks.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Aandachtspunten:</p>
                {result.risks.map((risk, index) => (
                  <div key={index} className="flex items-start gap-2 p-2 rounded bg-warning/10 border border-warning/20">
                    <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    <span className="text-sm">{risk}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Comparables */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Vergelijkbare Voertuigen</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {result.comparables.length} stuks
              </Badge>
              {result.outliers.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowOutliers(!showOutliers)}
                  className="text-xs"
                >
                  {showOutliers ? (
                    <>
                      <EyeOff className="h-3 w-3 mr-1" />
                      Verberg uitschieters
                    </>
                  ) : (
                    <>
                      <Eye className="h-3 w-3 mr-1" />
                      Toon {result.outliers.length} uitschieters
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
          <CardDescription>
            Cohort criteria: ±{result.dataQuality.cohortCriteria.yearRange} jaar, 
            ±{Math.round(result.dataQuality.cohortCriteria.mileageRange * 100)}% km
          </CardDescription>
        </CardHeader>
        <CardContent>
          {result.comparables.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Geen vergelijkbare voertuigen gevonden
            </p>
          ) : (
            <div className="space-y-2">
              {result.comparables.slice(0, 10).map((comp, index) => (
                <ComparableRow key={comp.id || index} comp={comp} />
              ))}
              
              {result.comparables.length > 10 && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full justify-center py-2">
                    <ChevronDown className="h-4 w-4" />
                    Toon alle {result.comparables.length} voertuigen
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2">
                    {result.comparables.slice(10).map((comp, index) => (
                      <ComparableRow key={comp.id || index + 10} comp={comp} />
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Outliers */}
              {showOutliers && result.outliers.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2">
                    Uitschieters (niet meegenomen in berekening):
                  </p>
                  {result.outliers.map((comp, index) => (
                    <ComparableRow key={comp.id || `outlier-${index}`} comp={comp} isOutlier />
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Comparable row component
function ComparableRow({ comp, isOutlier = false }: { comp: ValuationResult['comparables'][0]; isOutlier?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between p-3 rounded-lg transition-colors',
        isOutlier ? 'bg-muted/30 opacity-60' : 'bg-muted/50 hover:bg-muted'
      )}
    >
      <div className="flex items-center gap-3">
        {comp.isSold ? (
          <Badge variant="default" className="bg-success text-success-foreground">Verkocht</Badge>
        ) : (
          <Badge variant="outline">Actief</Badge>
        )}
        <div>
          <p className="text-sm font-medium text-foreground">{comp.title}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{comp.mileage.toLocaleString()} km</span>
            {comp.optionsMatchScore !== undefined && (
              <>
                <span>•</span>
                <span>{comp.optionsMatchScore}% opties match</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="text-right">
        <p className={cn(
          'text-sm font-semibold',
          isOutlier ? 'text-muted-foreground line-through' : 'text-foreground'
        )}>
          €{comp.price.toLocaleString()}
        </p>
        <p className={cn(
          'text-xs',
          comp.isSold ? 'text-success' : 'text-muted-foreground'
        )}>
          {comp.isSold ? `Verkocht na ${comp.daysOnMarket}d` : `${comp.daysOnMarket}d actief`}
        </p>
      </div>
    </div>
  );
}
