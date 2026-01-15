import { OptionsAnalysis } from '@/hooks/useValuation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Zap, Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  analysis: OptionsAnalysis;
}

export function OptionsAnalysisCard({ analysis }: Props) {
  const getMatchLabel = (score: number) => {
    if (score >= 80) return 'Uitstekende match';
    if (score >= 60) return 'Goede match';
    if (score >= 40) return 'Matige match';
    return 'Lage match';
  };

  const getMatchColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-primary';
    if (score >= 40) return 'text-warning';
    return 'text-destructive';
  };

  if (analysis.adjustments.length === 0 && analysis.matchScore === 100) {
    return null;
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span>Opties Analyse</span>
          </div>
          <Badge variant="outline" className={getMatchColor(analysis.matchScore)}>
            {analysis.matchScore}% match
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Match score bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">{getMatchLabel(analysis.matchScore)}</span>
          </div>
          <Progress value={analysis.matchScore} className="h-1.5" />
          {analysis.matchScore < 60 && (
            <div className="flex items-center gap-1 mt-1">
              <AlertTriangle className="h-3 w-3 text-warning" />
              <span className="text-xs text-warning">
                Beperkte vergelijkbaarheid met markt
              </span>
            </div>
          )}
        </div>

        {/* Option adjustments */}
        {analysis.adjustments.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Meerwaarde opties:</p>
            {analysis.adjustments.map((adj, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-success" />
                  <span className="text-sm">{adj.label}</span>
                </div>
                <span className="text-sm font-medium text-success">
                  +€{adj.value.toLocaleString()}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-sm font-medium">Totaal opties</span>
              <span className="text-sm font-bold text-success">
                +€{analysis.totalAdjustment.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
