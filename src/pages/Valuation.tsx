import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Calculator,
  Search,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Bookmark,
  Download,
  Car,
  Gauge,
  Clock,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock valuation result
const mockValuation = {
  estimatedValue: 26500,
  priceRange: { min: 24800, max: 28200 },
  confidence: 92,
  courantheid: 87,
  marketSize: 1247,
  avgDaysOnMarket: 28,
  comparables: [
    { id: 1, title: 'VW Golf 1.4 TSI Highline', year: 2021, km: 42000, price: 25950, days: 18 },
    { id: 2, title: 'VW Golf 1.5 TSI Style', year: 2021, km: 48000, price: 26450, days: 23 },
    { id: 3, title: 'VW Golf 1.4 TSI Comfortline', year: 2020, km: 52000, price: 24200, days: 31 },
    { id: 4, title: 'VW Golf 2.0 TDI R-Line', year: 2021, km: 38000, price: 28900, days: 12 },
  ],
  priceHistory: [
    { month: 'Jul', price: 28500 },
    { month: 'Aug', price: 28200 },
    { month: 'Sep', price: 27800 },
    { month: 'Okt', price: 27200 },
    { month: 'Nov', price: 26800 },
    { month: 'Dec', price: 26500 },
  ],
};

export default function Valuation() {
  return (
    <MainLayout
      title="Autocity Taxatie"
      subtitle="Professionele waardebepaling op basis van marktdata"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Search Form */}
        <div className="lg:col-span-1">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calculator className="h-5 w-5 text-primary" />
                Voertuig Zoeken
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Merk</Label>
                <Select>
                  <SelectTrigger className="mt-1 bg-muted border-border">
                    <SelectValue placeholder="Selecteer merk" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vw">Volkswagen</SelectItem>
                    <SelectItem value="bmw">BMW</SelectItem>
                    <SelectItem value="mercedes">Mercedes-Benz</SelectItem>
                    <SelectItem value="audi">Audi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Model</Label>
                <Select>
                  <SelectTrigger className="mt-1 bg-muted border-border">
                    <SelectValue placeholder="Selecteer model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="golf">Golf</SelectItem>
                    <SelectItem value="polo">Polo</SelectItem>
                    <SelectItem value="passat">Passat</SelectItem>
                    <SelectItem value="tiguan">Tiguan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Bouwjaar</Label>
                  <Input type="number" placeholder="2021" className="mt-1 bg-muted border-border" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">KM stand</Label>
                  <Input type="number" placeholder="45000" className="mt-1 bg-muted border-border" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Brandstof</Label>
                <Select>
                  <SelectTrigger className="mt-1 bg-muted border-border">
                    <SelectValue placeholder="Selecteer brandstof" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="benzine">Benzine</SelectItem>
                    <SelectItem value="diesel">Diesel</SelectItem>
                    <SelectItem value="elektrisch">Elektrisch</SelectItem>
                    <SelectItem value="hybride">Hybride</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Transmissie</Label>
                <Select>
                  <SelectTrigger className="mt-1 bg-muted border-border">
                    <SelectValue placeholder="Selecteer transmissie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="automaat">Automaat</SelectItem>
                    <SelectItem value="handgeschakeld">Handgeschakeld</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full mt-4">
                <Search className="h-4 w-4 mr-2" />
                Bereken Marktwaarde
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Valuation Card */}
          <Card className="bg-card border-border overflow-hidden">
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 border-b border-border p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-medium text-foreground">Volkswagen Golf 1.4 TSI</h3>
                  <p className="text-sm text-muted-foreground mt-1">2021 • 45.000 km • Benzine • Automaat</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Bookmark className="h-4 w-4 mr-1" />
                    Opslaan
                  </Button>
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
                  <p className="text-3xl font-bold text-primary">€{mockValuation.estimatedValue.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground mt-1">Geschatte waarde</p>
                  <p className="text-xs text-muted-foreground">
                    €{mockValuation.priceRange.min.toLocaleString()} - €{mockValuation.priceRange.max.toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-3xl font-bold text-success">{mockValuation.confidence}%</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">AI Confidence</p>
                  <Progress value={mockValuation.confidence} className="h-1.5 mt-2" />
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-foreground">{mockValuation.courantheid}</p>
                  <p className="text-sm text-muted-foreground mt-1">Courantheid Score</p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Gauge className="h-3 w-3 text-success" />
                    <span className="text-xs text-success">Goed verkoopbaar</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-foreground">{mockValuation.marketSize}</p>
                  <p className="text-sm text-muted-foreground mt-1">In dit segment</p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Car className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">actieve listings</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Market Insights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-foreground">{mockValuation.avgDaysOnMarket}d</p>
                    <p className="text-sm text-muted-foreground">Gem. doorlooptijd</p>
                  </div>
                  <Clock className="h-8 w-8 text-primary/50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-bold trend-negative">-2.3%</p>
                      <TrendingDown className="h-5 w-5 trend-negative" />
                    </div>
                    <p className="text-sm text-muted-foreground">Prijstrend (6 mnd)</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-primary/50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-foreground">47</p>
                    <p className="text-sm text-muted-foreground">Dealers in segment</p>
                  </div>
                  <Users className="h-8 w-8 text-primary/50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Comparables */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Vergelijkbare Voertuigen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockValuation.comparables.map((comp) => (
                  <div
                    key={comp.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{comp.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {comp.year} • {comp.km.toLocaleString()} km
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">€{comp.price.toLocaleString()}</p>
                      <p className={cn(
                        'text-xs',
                        comp.days <= 20 ? 'text-success' : comp.days <= 40 ? 'text-warning' : 'text-destructive'
                      )}>
                        {comp.days} dagen online
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-4">
                Bekijk alle {mockValuation.marketSize} vergelijkbare voertuigen
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
