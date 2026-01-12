import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { SegmentDefinitionForm } from '@/components/valuation/SegmentDefinitionForm';
import { CourantheidBadge } from '@/components/shared/CourantheidBadge';
import {
  TrendingDown,
  BarChart3,
  Bookmark,
  Download,
  Car,
  Clock,
  Users,
  Layers,
  Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

// Mock valuation result
const mockValuation = {
  segmentName: 'Volkswagen Golf 2020-2023',
  filters: 'Benzine/Diesel • 0-100k km • Automaat',
  estimatedValue: 26500,
  priceRange: { min: 24800, max: 28200 },
  confidence: 92,
  courantheid: 87,
  courantheidTrend: 'stable' as const,
  marketSize: 1247,
  avgDaysOnMarket: 28,
  comparables: [
    { id: 1, title: 'VW Golf 1.4 TSI Highline', year: 2021, km: 42000, price: 25950, days: 18, courantheid: 89 },
    { id: 2, title: 'VW Golf 1.5 TSI Style', year: 2021, km: 48000, price: 26450, days: 23, courantheid: 85 },
    { id: 3, title: 'VW Golf 1.4 TSI Comfortline', year: 2020, km: 52000, price: 24200, days: 31, courantheid: 78 },
    { id: 4, title: 'VW Golf 2.0 TDI R-Line', year: 2021, km: 38000, price: 28900, days: 12, courantheid: 92 },
  ],
};

export default function Valuation() {
  const handleAnalyze = () => {
    console.log('Analyzing segment...');
  };

  const handleSaveSegment = () => {
    console.log('Saving segment to library...');
  };

  return (
    <MainLayout
      title="Marktsegment Analyse"
      subtitle="Professionele waardebepaling op basis van marktsegmenten"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Segment Definition Form */}
        <div className="lg:col-span-1">
          <SegmentDefinitionForm onAnalyze={handleAnalyze} onSaveSegment={handleSaveSegment} />
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Valuation Card */}
          <Card className="bg-card border-border overflow-hidden">
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 border-b border-border p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Layers className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-medium text-foreground">{mockValuation.segmentName}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{mockValuation.filters}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/segments">
                      <Save className="h-4 w-4 mr-1" />
                      In Library
                    </Link>
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
                  <p className="text-sm text-muted-foreground mt-1">Segment gemiddelde</p>
                  <p className="text-xs text-muted-foreground">
                    €{mockValuation.priceRange.min.toLocaleString()} - €{mockValuation.priceRange.max.toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-3xl font-bold text-success">{mockValuation.confidence}%</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Data Confidence</p>
                  <Progress value={mockValuation.confidence} className="h-1.5 mt-2" />
                </div>
                <div className="text-center">
                  <div className="flex justify-center">
                    <CourantheidBadge
                      score={mockValuation.courantheid}
                      trend={mockValuation.courantheidTrend}
                      showLabel
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">Courantheid Score</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-foreground">{mockValuation.marketSize}</p>
                  <p className="text-sm text-muted-foreground mt-1">Marktgrootte</p>
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
                    <p className="text-sm text-muted-foreground">Prijstrend (7d)</p>
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
              <CardTitle className="text-lg">Vergelijkbare Listings in Segment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockValuation.comparables.map((comp) => (
                  <div
                    key={comp.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <CourantheidBadge score={comp.courantheid} compact />
                      <div>
                        <p className="text-sm font-medium text-foreground">{comp.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {comp.year} • {comp.km.toLocaleString()} km
                        </p>
                      </div>
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
                Bekijk alle {mockValuation.marketSize} listings in segment
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
