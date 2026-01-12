import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Layers, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface SegmentConfidence {
  id: string;
  name: string;
  avgConfidence: number;
  count: number;
  lowConfidenceCount: number;
  trend: 'up' | 'down' | 'stable';
}

interface SegmentConfidenceCardProps {
  segments: SegmentConfidence[];
}

export function SegmentConfidenceCard({ segments }: SegmentConfidenceCardProps) {
  const lowConfidenceSegments = segments.filter((s) => s.avgConfidence < 85);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Layers className="h-5 w-5 text-primary" />
          Confidence per Marktsegment
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {segments.map((segment) => (
            <div
              key={segment.id}
              className={cn(
                'p-3 rounded-lg border',
                segment.avgConfidence < 80
                  ? 'border-warning/50 bg-warning/5'
                  : 'border-border bg-muted/30'
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {segment.name}
                  </span>
                  {segment.avgConfidence < 80 && (
                    <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs',
                    segment.avgConfidence >= 90
                      ? 'text-success border-success/30'
                      : segment.avgConfidence >= 80
                      ? 'text-foreground border-border'
                      : 'text-warning border-warning/30'
                  )}
                >
                  {segment.avgConfidence}% confidence
                </Badge>
              </div>

              <Progress
                value={segment.avgConfidence}
                className={cn(
                  'h-1.5',
                  segment.avgConfidence >= 90
                    ? '[&>div]:bg-success'
                    : segment.avgConfidence >= 80
                    ? '[&>div]:bg-primary'
                    : '[&>div]:bg-warning'
                )}
              />

              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground">
                  {segment.count.toLocaleString()} listings
                </span>
                {segment.lowConfidenceCount > 0 && (
                  <span className="text-xs text-warning">
                    {segment.lowConfidenceCount} met lage confidence
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {lowConfidenceSegments.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-warning/10 border border-warning/30">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
              <div>
                <p className="text-sm font-medium text-warning">
                  {lowConfidenceSegments.length} segment(en) met lagere betrouwbaarheid
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Deze segmenten bevatten meer lage-confidence listings, wat impact kan hebben op
                  taxatie-nauwkeurigheid.
                </p>
              </div>
            </div>
          </div>
        )}

        <Button variant="outline" className="w-full mt-4" asChild>
          <Link to="/segments">
            <Layers className="h-4 w-4 mr-2" />
            Bekijk Segment Library
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
