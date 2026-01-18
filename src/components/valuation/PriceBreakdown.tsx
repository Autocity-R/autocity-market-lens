import { PriceBreakdown as PriceBreakdownType } from '@/hooks/useValuation';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { Calculator, TrendingUp, TrendingDown, Info, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Props {
  breakdown: PriceBreakdownType;
}

export function PriceBreakdown({ breakdown }: Props) {
  const formatCurrency = (value: number) => {
    const absValue = Math.abs(value);
    const formatted = `€${absValue.toLocaleString()}`;
    if (value > 0) return `+${formatted}`;
    if (value < 0) return `-${formatted}`;
    return formatted;
  };

  const getCohortLabel = (level: 1 | 2 | 3) => {
    switch (level) {
      case 1:
        return 'Exact match';
      case 2:
        return 'Verbreed';
      case 3:
        return 'Generiek';
    }
  };

  const getCohortVariant = (level: 1 | 2 | 3): 'default' | 'secondary' | 'outline' => {
    switch (level) {
      case 1:
        return 'default';
      case 2:
        return 'secondary';
      case 3:
        return 'outline';
    }
  };

  const getMileageSourceLabel = (source: string) => {
    switch (source) {
      case 'sold':
        return 'Verkochte voertuigen';
      case 'combined':
        return 'Gecombineerd (verkocht + actief)';
      case 'fallback':
        return 'Fallback model';
      case 'none':
        return 'Geen correctie';
      default:
        return source;
    }
  };

  const rows = [
    {
      label: 'Live Markt Mediaan (LMV)',
      value: breakdown.LMV,
      rawValue: breakdown.LMV_raw,
      description: 'Mediaan van huidige vraagprijzen',
      isBase: true,
    },
    {
      label: 'Onderhandelingsruimte-effect (OEV)',
      value: breakdown.OEV,
      description: 'Gewogen gemiddelde van recente verkopen',
      isBase: true,
    },
    {
      label: 'Laagste realistisch',
      value: breakdown.lowestRealisticPrice,
      description: 'P10 van prijscluster',
      isBase: true,
    },
    {
      label: 'Gewogen basis',
      value: breakdown.weightedBase,
      description: 'Blend van LMV, OEV en laagste prijs',
      isSubtotal: true,
    },
    {
      label: 'Kilometerstand correctie',
      value: breakdown.mileageAdjustment.value,
      description: `Bron: ${getMileageSourceLabel(breakdown.mileageAdjustment.source)}`,
      extra: breakdown.mileageAdjustment.source !== 'none' 
        ? `€${Math.abs(breakdown.mileageAdjustment.b_used).toFixed(2)}/km vs ${breakdown.mileageAdjustment.km_ref.toLocaleString()} km ref`
        : undefined,
      warning: breakdown.mileageAdjustment.warning,
      isAdjustment: true,
    },
    {
      label: 'Opties correctie',
      value: breakdown.optionsAdjustment,
      description: 'Meerwaarde geselecteerde opties',
      isAdjustment: true,
    },
    {
      label: 'Courantheid correctie',
      value: Math.round(breakdown.weightedBase * breakdown.courantheidPriceImpact),
      description: `Impact marktliquiditeit (${breakdown.courantheidPriceImpact > 0 ? '+' : ''}${Math.round(breakdown.courantheidPriceImpact * 100)}%)`,
      isAdjustment: true,
    },
  ];

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="breakdown" className="border-border">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            <span className="font-medium">Prijs Breakdown</span>
            <Badge variant={getCohortVariant(breakdown.cohortLevel)} className="ml-2">
              Cohort L{breakdown.cohortLevel}: {getCohortLabel(breakdown.cohortLevel)}
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2 pt-2">
            {/* Cohort info */}
            <div className="flex items-center gap-4 p-2 rounded-md bg-muted/50 text-xs text-muted-foreground mb-3">
              <span>Live: {breakdown.cohortSizeLive} voertuigen</span>
              <span>Verkocht: {breakdown.cohortSizeSold} voertuigen</span>
            </div>

            {rows.map((row, index) => (
              <div
                key={index}
                className={cn(
                  'flex items-center justify-between py-2 px-3 rounded-md text-sm',
                  row.isSubtotal && 'bg-muted font-medium border-t border-border mt-2',
                  row.isAdjustment && row.value !== 0 && 'bg-muted/50'
                )}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn(row.isSubtotal && 'font-semibold')}>
                      {row.label}
                    </span>
                    {row.warning && (
                      <Tooltip>
                        <TooltipTrigger>
                          <AlertTriangle className="h-3 w-3 text-warning" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs max-w-[200px]">{row.warning}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{row.description}</p>
                  {row.extra && (
                    <p className="text-xs text-muted-foreground/70">{row.extra}</p>
                  )}
                </div>
                <span
                  className={cn(
                    'font-mono',
                    row.isSubtotal && 'font-semibold',
                    row.isAdjustment && row.value > 0 && 'text-success',
                    row.isAdjustment && row.value < 0 && 'text-destructive'
                  )}
                >
                  {row.isAdjustment ? formatCurrency(row.value) : `€${row.value.toLocaleString()}`}
                </span>
              </div>
            ))}

            {/* Final Value */}
            <div className="flex items-center justify-between py-3 px-3 rounded-md bg-primary/10 border border-primary/20 mt-4">
              <div className="flex items-center gap-2">
                <span className="font-bold text-primary">Fair Market Value</span>
              </div>
              <span className="text-xl font-bold text-primary">
                €{breakdown.finalValue.toLocaleString()}
              </span>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
