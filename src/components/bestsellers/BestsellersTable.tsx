import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Minus, ExternalLink, Car, Clock, DollarSign, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export interface SegmentData {
  id: string;
  name: string;
  score: number;
  trend: 'up' | 'down' | 'stable';
  salesLast30Days: number;
  avgDaysOnMarket: number;
  windowSize: number;
  avgPrice: number;
  medianPrice: number;
  filters?: {
    make?: string;
    model?: string;
    yearFrom?: number;
    yearTo?: number;
    fuelTypes?: string[];
    mileageMin?: number;
    mileageMax?: number;
    transmission?: string;
  };
}

interface BestsellersTableProps {
  segments: SegmentData[];
  isLoading?: boolean;
}

function formatMileage(km?: number): string {
  if (!km) return '';
  if (km >= 1000) {
    return `${Math.round(km / 1000)}k`;
  }
  return km.toString();
}

function getSegmentSubtitle(filters?: SegmentData['filters']): string {
  if (!filters) return '';
  
  const parts: string[] = [];
  
  if (filters.yearFrom && filters.yearTo) {
    parts.push(`${filters.yearFrom}-${filters.yearTo}`);
  } else if (filters.yearFrom) {
    parts.push(`vanaf ${filters.yearFrom}`);
  } else if (filters.yearTo) {
    parts.push(`t/m ${filters.yearTo}`);
  }
  
  if (filters.fuelTypes?.length === 1) {
    parts.push(filters.fuelTypes[0]);
  } else if (filters.fuelTypes && filters.fuelTypes.length > 1) {
    parts.push(filters.fuelTypes.join('/'));
  }
  
  if (filters.transmission) {
    parts.push(filters.transmission);
  }
  
  if (filters.mileageMin !== undefined || filters.mileageMax !== undefined) {
    const min = formatMileage(filters.mileageMin) || '0';
    const max = formatMileage(filters.mileageMax);
    if (max) {
      parts.push(`${min}-${max} km`);
    } else {
      parts.push(`>${min} km`);
    }
  }
  
  return parts.join(' • ');
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  switch (trend) {
    case 'up':
      return <TrendingUp className="h-4 w-4 text-success" />;
    case 'down':
      return <TrendingDown className="h-4 w-4 text-destructive" />;
    default:
      return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
}

function getScoreColor(score: number): string {
  if (score >= 75) return 'text-success';
  if (score >= 50) return 'text-warning';
  return 'text-destructive';
}

export function BestsellersTable({ segments, isLoading }: BestsellersTableProps) {
  if (isLoading) {
    return (
      <div className="border rounded-lg">
        <div className="p-8 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3 mx-auto"></div>
            <div className="h-4 bg-muted rounded w-1/2 mx-auto"></div>
            <div className="h-4 bg-muted rounded w-2/5 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center">
        <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Geen segmenten gevonden</h3>
        <p className="text-muted-foreground mb-4">
          Pas de filters aan of klik op "Herbereken" om segmenten te genereren.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-12 text-center">#</TableHead>
            <TableHead>Segment</TableHead>
            <TableHead className="text-center w-24">
              <div className="flex items-center justify-center gap-1">
                <Car className="h-3.5 w-3.5" />
                <span>Markt</span>
              </div>
            </TableHead>
            <TableHead className="text-center w-24">
              <div className="flex items-center justify-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Verk/30d</span>
              </div>
            </TableHead>
            <TableHead className="text-center w-20">
              <div className="flex items-center justify-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span>DOM</span>
              </div>
            </TableHead>
            <TableHead className="text-center w-28">
              <div className="flex items-center justify-center gap-1">
                <DollarSign className="h-3.5 w-3.5" />
                <span>Mediaan</span>
              </div>
            </TableHead>
            <TableHead className="w-40">Score</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {segments.map((segment, index) => {
            const subtitle = getSegmentSubtitle(segment.filters);
            const rank = index + 1;
            const isTopThree = rank <= 3;

            return (
              <TableRow 
                key={segment.id}
                className={cn(
                  "group hover:bg-muted/50 transition-colors",
                  isTopThree && "bg-primary/5"
                )}
              >
                <TableCell className="text-center">
                  <span className={cn(
                    "text-lg font-bold",
                    isTopThree ? "text-primary" : "text-muted-foreground"
                  )}>
                    {rank}
                  </span>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {segment.name}
                      <TrendIcon trend={segment.trend} />
                    </div>
                    {subtitle && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {subtitle}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary" className="font-mono">
                    {segment.windowSize}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <span className="font-medium text-success">
                    {segment.salesLast30Days}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className={cn(
                    "font-medium",
                    segment.avgDaysOnMarket <= 25 ? "text-success" :
                    segment.avgDaysOnMarket <= 45 ? "text-warning" : "text-destructive"
                  )}>
                    {Math.round(segment.avgDaysOnMarket)}d
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="font-medium">
                    €{segment.medianPrice?.toLocaleString('nl-NL') || '-'}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={segment.score} className="h-2 flex-1" />
                    <span className={cn("font-bold text-sm w-8", getScoreColor(segment.score))}>
                      {segment.score}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    asChild
                  >
                    <Link to={`/listings?segment=${segment.id}`}>
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
