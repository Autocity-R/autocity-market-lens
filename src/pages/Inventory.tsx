import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { CourantheidBadge } from '@/components/shared/CourantheidBadge';
import { useValuation, ValuationRequest } from '@/hooks/useValuation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Clock,
  Car,
  Euro,
  Bell,
  Plus,
  Settings,
  Upload,
  Loader2,
  CheckCircle,
  XCircle,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface InventoryItem {
  id: string;
  title: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
  price: number;
  fuelType: string;
  daysOnMarket: number;
  status: 'good' | 'warning' | 'critical';
  marketPosition?: number; // -5 to +5 (% vs market)
  estimatedValue?: number;
  courantheid?: number;
}

// Mock inventory data
const initialInventory: InventoryItem[] = [
  { id: '1', title: 'VW Golf 1.4 TSI Highline', make: 'Volkswagen', model: 'Golf', year: 2021, mileage: 45000, price: 24950, fuelType: 'benzine', daysOnMarket: 23, status: 'good', marketPosition: -2.3, courantheid: 85 },
  { id: '2', title: 'BMW 320i M Sport', make: 'BMW', model: '3 Serie', year: 2020, mileage: 62000, price: 32500, fuelType: 'benzine', daysOnMarket: 45, status: 'warning', marketPosition: 4.5, courantheid: 72 },
  { id: '3', title: 'Mercedes C 180', make: 'Mercedes-Benz', model: 'C-Klasse', year: 2019, mileage: 78000, price: 28750, fuelType: 'benzine', daysOnMarket: 67, status: 'critical', marketPosition: 3.2, courantheid: 58 },
  { id: '4', title: 'Audi A4 35 TFSI', make: 'Audi', model: 'A4', year: 2022, mileage: 28000, price: 38900, fuelType: 'benzine', daysOnMarket: 12, status: 'good', marketPosition: -1.1, courantheid: 91 },
  { id: '5', title: 'Toyota RAV4 Hybrid', make: 'Toyota', model: 'RAV4', year: 2021, mileage: 52000, price: 36250, fuelType: 'hybride', daysOnMarket: 8, status: 'good', marketPosition: -0.5, courantheid: 88 },
];

const inventoryAlerts = [
  {
    id: 1,
    type: 'price_high',
    vehicle: 'BMW 320i M Sport 2020',
    message: 'Prijs €2.300 hoger dan marktgemiddelde',
    severity: 'warning',
    suggestion: 'Overweeg prijsverlaging naar €30.200',
  },
  {
    id: 2,
    type: 'days_high',
    vehicle: 'Mercedes C 180 2019',
    message: 'Al 67 dagen online (gem. segment: 35 dagen)',
    severity: 'critical',
    suggestion: 'Voertuig in "lang online" categorie, actie vereist',
  },
  {
    id: 3,
    type: 'competitor',
    vehicle: 'VW Golf 1.4 TSI 2021',
    message: 'Concurrent biedt vergelijkbaar voertuig €1.200 lager aan',
    severity: 'warning',
    suggestion: 'AutoVandaag Amsterdam heeft vergelijkbaar aanbod',
  },
];

export default function Inventory() {
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<InventoryItem | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  
  const valuation = useValuation();

  // New vehicle form state
  const [newVehicle, setNewVehicle] = useState({
    make: '',
    model: '',
    year: new Date().getFullYear() - 2,
    mileage: 50000,
    price: 25000,
    fuelType: 'benzine',
  });

  const stats = {
    totalVehicles: inventory.length,
    avgDaysOnMarket: Math.round(inventory.reduce((acc, v) => acc + v.daysOnMarket, 0) / inventory.length),
    avgPriceVsMarket: inventory.reduce((acc, v) => acc + (v.marketPosition || 0), 0) / inventory.length,
    performing: inventory.filter(v => v.status === 'good').length,
    atRisk: inventory.filter(v => v.status === 'critical').length,
    warning: inventory.filter(v => v.status === 'warning').length,
  };

  const handleAddVehicle = () => {
    const newItem: InventoryItem = {
      id: Date.now().toString(),
      title: `${newVehicle.make} ${newVehicle.model}`,
      make: newVehicle.make,
      model: newVehicle.model,
      year: newVehicle.year,
      mileage: newVehicle.mileage,
      price: newVehicle.price,
      fuelType: newVehicle.fuelType,
      daysOnMarket: 0,
      status: 'good',
    };
    
    setInventory([newItem, ...inventory]);
    setIsAddDialogOpen(false);
    toast.success('Voertuig toegevoegd');
    
    // Reset form
    setNewVehicle({
      make: '',
      model: '',
      year: new Date().getFullYear() - 2,
      mileage: 50000,
      price: 25000,
      fuelType: 'benzine',
    });
  };

  const handleAnalyzeVehicle = async (vehicle: InventoryItem) => {
    setAnalyzingId(vehicle.id);
    
    try {
      const result = await valuation.mutateAsync({
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        mileage: vehicle.mileage,
        fuelType: vehicle.fuelType,
      });

      // Update vehicle with market data
      setInventory(prev => prev.map(v => {
        if (v.id === vehicle.id) {
          const marketPosition = ((v.price - result.estimatedValue) / result.estimatedValue) * 100;
          return {
            ...v,
            estimatedValue: result.estimatedValue,
            marketPosition: Math.round(marketPosition * 10) / 10,
            status: marketPosition > 5 ? 'critical' : marketPosition > 2 ? 'warning' : 'good',
          };
        }
        return v;
      }));

      toast.success(`Marktanalyse voltooid voor ${vehicle.title}`);
    } catch (error) {
      toast.error('Analyse mislukt');
    } finally {
      setAnalyzingId(null);
    }
  };

  const getPriceAdvice = (marketPosition: number | undefined) => {
    if (marketPosition === undefined) return { label: 'Analyseren', color: 'text-muted-foreground' };
    if (marketPosition < -3) return { label: 'Te goedkoop', color: 'text-info' };
    if (marketPosition < 2) return { label: 'Marktconform', color: 'text-success' };
    if (marketPosition < 5) return { label: 'Iets te duur', color: 'text-warning' };
    return { label: 'Te duur', color: 'text-destructive' };
  };

  return (
    <MainLayout
      title="Inventory Monitor"
      subtitle="Monitor en optimaliseer uw voorraad met AI-gedreven marktanalyse"
    >
      {/* Actions Bar */}
      <div className="flex items-center justify-between mb-6 p-4 rounded-lg bg-card border border-border">
        <div className="flex items-center gap-4">
          <Select defaultValue="own">
            <SelectTrigger className="w-64 bg-muted border-border">
              <SelectValue placeholder="Selecteer dealer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="own">Uw dealerbedrijf</SelectItem>
              <SelectItem value="all">Alle gekoppelde dealers</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-1" />
            CSV Import
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Voertuig toevoegen
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Voertuig Toevoegen</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Merk</label>
                    <Input
                      value={newVehicle.make}
                      onChange={(e) => setNewVehicle({ ...newVehicle, make: e.target.value })}
                      placeholder="bijv. Volkswagen"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Model</label>
                    <Input
                      value={newVehicle.model}
                      onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                      placeholder="bijv. Golf"
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Bouwjaar</label>
                    <Input
                      type="number"
                      value={newVehicle.year}
                      onChange={(e) => setNewVehicle({ ...newVehicle, year: parseInt(e.target.value) })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Kilometerstand</label>
                    <Input
                      type="number"
                      value={newVehicle.mileage}
                      onChange={(e) => setNewVehicle({ ...newVehicle, mileage: parseInt(e.target.value) })}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Vraagprijs (€)</label>
                    <Input
                      type="number"
                      value={newVehicle.price}
                      onChange={(e) => setNewVehicle({ ...newVehicle, price: parseInt(e.target.value) })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Brandstof</label>
                    <Select 
                      value={newVehicle.fuelType} 
                      onValueChange={(v) => setNewVehicle({ ...newVehicle, fuelType: v })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="benzine">Benzine</SelectItem>
                        <SelectItem value="diesel">Diesel</SelectItem>
                        <SelectItem value="elektrisch">Elektrisch</SelectItem>
                        <SelectItem value="hybride">Hybride</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button className="w-full" onClick={handleAddVehicle}>
                  <Plus className="h-4 w-4 mr-1" />
                  Toevoegen
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.totalVehicles}</p>
                <p className="text-sm text-muted-foreground">Voertuigen</p>
              </div>
              <Car className="h-6 w-6 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.avgDaysOnMarket}d</p>
                <p className="text-sm text-muted-foreground">Gem. online</p>
              </div>
              <Clock className="h-6 w-6 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={cn(
                  "text-2xl font-bold",
                  stats.avgPriceVsMarket > 2 ? "text-warning" : 
                  stats.avgPriceVsMarket < -2 ? "text-info" : "text-success"
                )}>
                  {stats.avgPriceVsMarket > 0 ? '+' : ''}{stats.avgPriceVsMarket.toFixed(1)}%
                </p>
                <p className="text-sm text-muted-foreground">vs markt</p>
              </div>
              <Euro className="h-6 w-6 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-success">{stats.performing}</p>
                <p className="text-sm text-muted-foreground">Goed presterend</p>
              </div>
              <CheckCircle className="h-6 w-6 text-success/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-destructive">{stats.atRisk}</p>
                <p className="text-sm text-muted-foreground">Actie vereist</p>
              </div>
              <AlertTriangle className="h-6 w-6 text-destructive/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alerts */}
        <div className="lg:col-span-1">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="h-5 w-5 text-primary" />
                Voorraad Alerts
                <Badge variant="secondary" className="ml-auto">{inventoryAlerts.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {inventoryAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    'p-3 rounded-lg border-l-2',
                    alert.severity === 'critical' ? 'border-l-destructive bg-destructive/5' :
                    alert.severity === 'warning' ? 'border-l-warning bg-warning/5' :
                    'border-l-info bg-info/5'
                  )}
                >
                  <p className="text-sm font-medium text-foreground">{alert.vehicle}</p>
                  <p className="text-xs text-muted-foreground mt-1">{alert.message}</p>
                  <p className="text-xs text-primary mt-2">💡 {alert.suggestion}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Inventory Table */}
        <div className="lg:col-span-2">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Uw Voorraad</CardTitle>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => inventory.forEach(v => handleAnalyzeVehicle(v))}
                  disabled={analyzingId !== null}
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  Analyseer Alle
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {inventory.map((vehicle) => {
                  const advice = getPriceAdvice(vehicle.marketPosition);
                  const isAnalyzing = analyzingId === vehicle.id;
                  
                  return (
                    <div
                      key={vehicle.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          'h-3 w-3 rounded-full',
                          vehicle.status === 'good' ? 'bg-success' :
                          vehicle.status === 'warning' ? 'bg-warning' : 'bg-destructive'
                        )} />
                        <div>
                          <p className="text-sm font-medium text-foreground">{vehicle.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {vehicle.year} • {vehicle.mileage.toLocaleString()} km • {vehicle.fuelType}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {/* Courantheid */}
                        {vehicle.courantheid && (
                          <CourantheidBadge score={vehicle.courantheid} compact />
                        )}
                        
                        {/* Price & Market Position */}
                        <div className="text-right min-w-[100px]">
                          <p className="text-sm font-semibold text-foreground">
                            €{vehicle.price.toLocaleString()}
                          </p>
                          {vehicle.marketPosition !== undefined ? (
                            <p className={cn('text-xs', advice.color)}>
                              {vehicle.marketPosition > 0 ? '+' : ''}{vehicle.marketPosition}% • {advice.label}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">Niet geanalyseerd</p>
                          )}
                        </div>

                        {/* Days on market */}
                        <div className="text-right min-w-[50px]">
                          <p className={cn(
                            'text-sm font-medium',
                            vehicle.daysOnMarket > 60 ? 'text-destructive' :
                            vehicle.daysOnMarket > 30 ? 'text-warning' : 'text-foreground'
                          )}>
                            {vehicle.daysOnMarket}d
                          </p>
                          <p className="text-xs text-muted-foreground">online</p>
                        </div>

                        {/* Analyze button */}
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleAnalyzeVehicle(vehicle)}
                          disabled={isAnalyzing}
                        >
                          {isAnalyzing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
