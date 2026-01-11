import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock inventory data
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
  {
    id: 4,
    type: 'segment_down',
    vehicle: 'Audi A4 35 TFSI 2022',
    message: 'Segment daalt: -3.2% afgelopen week',
    severity: 'info',
    suggestion: 'Monitor prijsontwikkeling, overweeg tijdige verkoop',
  },
];

const inventoryStats = {
  totalVehicles: 47,
  avgDaysOnMarket: 28,
  avgPriceVsMarket: 1.8,
  alertsCount: 4,
  atRisk: 6,
  performing: 28,
  underperforming: 13,
};

const ownInventory = [
  { id: 1, title: 'VW Golf 1.4 TSI Highline', year: 2021, km: 45000, price: 24950, days: 23, status: 'good', vsMarket: -2.3 },
  { id: 2, title: 'BMW 320i M Sport', year: 2020, km: 62000, price: 32500, days: 45, status: 'warning', vsMarket: 4.5 },
  { id: 3, title: 'Mercedes C 180', year: 2019, km: 78000, price: 28750, days: 67, status: 'critical', vsMarket: 3.2 },
  { id: 4, title: 'Audi A4 35 TFSI', year: 2022, km: 28000, price: 38900, days: 12, status: 'good', vsMarket: -1.1 },
  { id: 5, title: 'Toyota RAV4 Hybrid', year: 2021, km: 52000, price: 36250, days: 8, status: 'good', vsMarket: -0.5 },
];

export default function Inventory() {
  return (
    <MainLayout
      title="Inventory Monitor"
      subtitle="Monitor en optimaliseer uw voorraad"
    >
      {/* Dealer Selector */}
      <div className="stat-card mb-6">
        <div className="flex items-center justify-between">
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
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Dealer toevoegen
            </Button>
          </div>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-1" />
            Alert instellingen
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">{inventoryStats.totalVehicles}</p>
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
                <p className="text-2xl font-bold text-foreground">{inventoryStats.avgDaysOnMarket}d</p>
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
                <p className="text-2xl font-bold text-warning">+{inventoryStats.avgPriceVsMarket}%</p>
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
                <p className="text-2xl font-bold text-success">{inventoryStats.performing}</p>
                <p className="text-sm text-muted-foreground">Goed presterend</p>
              </div>
              <TrendingUp className="h-6 w-6 text-success/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-destructive">{inventoryStats.atRisk}</p>
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
              <CardTitle className="text-lg">Uw Voorraad</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ownInventory.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        'h-2 w-2 rounded-full',
                        vehicle.status === 'good' ? 'bg-success' :
                        vehicle.status === 'warning' ? 'bg-warning' : 'bg-destructive'
                      )} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{vehicle.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {vehicle.year} • {vehicle.km.toLocaleString()} km
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">€{vehicle.price.toLocaleString()}</p>
                        <p className={cn(
                          'text-xs',
                          vehicle.vsMarket < 0 ? 'trend-positive' : 'trend-negative'
                        )}>
                          {vehicle.vsMarket > 0 ? '+' : ''}{vehicle.vsMarket}% vs markt
                        </p>
                      </div>
                      <div className="text-right min-w-[60px]">
                        <p className={cn(
                          'text-sm font-medium',
                          vehicle.days > 60 ? 'text-destructive' :
                          vehicle.days > 30 ? 'text-warning' : 'text-foreground'
                        )}>
                          {vehicle.days}d
                        </p>
                        <p className="text-xs text-muted-foreground">online</p>
                      </div>
                      <Button variant="ghost" size="sm">Details</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
