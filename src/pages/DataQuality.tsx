import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const qualityIssues = [
  {
    id: 1,
    type: 'low_confidence',
    listing: 'Volvo XC60 B5 Momentum 2020',
    issue: 'Lage AI confidence (72%)',
    details: 'Kilometerstand lijkt inconsistent met bouwjaar',
    severity: 'warning',
  },
  {
    id: 2,
    type: 'missing_data',
    listing: 'Peugeot 3008 GT 2023',
    issue: 'Ontbrekende transmissietype',
    details: 'Niet beschikbaar in brondata',
    severity: 'info',
  },
  {
    id: 3,
    type: 'anomaly',
    listing: 'BMW 530e 2021',
    issue: 'Prijsafwijking gedetecteerd',
    details: 'Prijs 45% lager dan segmentgemiddelde',
    severity: 'critical',
  },
  {
    id: 4,
    type: 'low_confidence',
    listing: 'Mercedes GLC 300 2020',
    issue: 'Lage AI confidence (68%)',
    details: 'Meerdere varianten mogelijk, onduidelijke match',
    severity: 'warning',
  },
  {
    id: 5,
    type: 'duplicate',
    listing: 'Audi Q5 45 TFSI 2022',
    issue: 'Mogelijke duplicaat',
    details: 'Vergelijkbare listing gevonden bij andere dealer',
    severity: 'info',
  },
];

const qualityStats = {
  totalProcessed: 52340,
  highConfidence: 45230,
  mediumConfidence: 5890,
  lowConfidence: 1220,
  normalized: 49380,
  enriched: 45870,
  issues: 156,
  manualReviews: 23,
};

export default function DataQuality() {
  return (
    <MainLayout
      title="Datakwaliteit"
      subtitle="Monitor en verbeter de kwaliteit van marktdata"
    >
      {/* Quality Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-success">94.2%</p>
                <p className="text-sm text-muted-foreground">AI Genormaliseerd</p>
              </div>
            </div>
            <Progress value={94.2} className="h-1.5 mt-3" />
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <RefreshCw className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">87.5%</p>
                <p className="text-sm text-muted-foreground">Verrijkt</p>
              </div>
            </div>
            <Progress value={87.5} className="h-1.5 mt-3" />
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-warning">{qualityStats.issues}</p>
                <p className="text-sm text-muted-foreground">Open issues</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center">
                <Eye className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{qualityStats.manualReviews}</p>
                <p className="text-sm text-muted-foreground">Handmatige reviews</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confidence Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="bg-card border-border lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Confidence Verdeling</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Hoog (90%+)</span>
                <span className="text-sm font-medium text-success">
                  {qualityStats.highConfidence.toLocaleString()} ({((qualityStats.highConfidence / qualityStats.totalProcessed) * 100).toFixed(1)}%)
                </span>
              </div>
              <Progress value={(qualityStats.highConfidence / qualityStats.totalProcessed) * 100} className="h-2 bg-muted [&>div]:bg-success" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Medium (75-89%)</span>
                <span className="text-sm font-medium text-warning">
                  {qualityStats.mediumConfidence.toLocaleString()} ({((qualityStats.mediumConfidence / qualityStats.totalProcessed) * 100).toFixed(1)}%)
                </span>
              </div>
              <Progress value={(qualityStats.mediumConfidence / qualityStats.totalProcessed) * 100} className="h-2 bg-muted [&>div]:bg-warning" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Laag (&lt;75%)</span>
                <span className="text-sm font-medium text-destructive">
                  {qualityStats.lowConfidence.toLocaleString()} ({((qualityStats.lowConfidence / qualityStats.totalProcessed) * 100).toFixed(1)}%)
                </span>
              </div>
              <Progress value={(qualityStats.lowConfidence / qualityStats.totalProcessed) * 100} className="h-2 bg-muted [&>div]:bg-destructive" />
            </div>
          </CardContent>
        </Card>

        {/* Issues List */}
        <Card className="bg-card border-border lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Datakwaliteit Issues</CardTitle>
            <div className="flex gap-2">
              <Badge variant="outline" className="cursor-pointer hover:bg-muted">Alle</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-muted">Laag confidence</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-muted">Anomalieën</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {qualityIssues.map((issue) => (
                <div
                  key={issue.id}
                  className={cn(
                    'flex items-center justify-between p-4 rounded-lg border-l-2',
                    issue.severity === 'critical' ? 'border-l-destructive bg-destructive/5' :
                    issue.severity === 'warning' ? 'border-l-warning bg-warning/5' :
                    'border-l-info bg-info/5'
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'h-8 w-8 rounded-full flex items-center justify-center',
                      issue.severity === 'critical' ? 'bg-destructive/20' :
                      issue.severity === 'warning' ? 'bg-warning/20' : 'bg-info/20'
                    )}>
                      {issue.severity === 'critical' ? (
                        <XCircle className="h-4 w-4 text-destructive" />
                      ) : issue.severity === 'warning' ? (
                        <AlertTriangle className="h-4 w-4 text-warning" />
                      ) : (
                        <Eye className="h-4 w-4 text-info" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{issue.listing}</p>
                      <p className="text-xs text-muted-foreground">{issue.issue}</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">{issue.details}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full mt-4">
              Bekijk alle {qualityStats.issues} issues
            </Button>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
