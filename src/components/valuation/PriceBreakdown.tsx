import { PriceBreakdown as PriceBreakdownType } from '@/hooks/useValuation';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { Calculator, TrendingUp, TrendingDown, Minus } from 'lucide-react';

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

  const rows = [
    {
      label: 'Live markt mediaan',
      value: breakdown.livePriceMedian,
      description: 'Mediaan van huidige vraagprijzen',
      isBase: true,
    },
    {
      label: 'Gewogen verkoopprijs',
      value: breakdown.weightedSalesPrice,
      description: 'Recente verkopen (tijdsgewogen)',
      isBase: true,
    },
    {
      label: 'Cluster mediaan',
      value: breakdown.clusterMedian,
      description: 'Mediaan excl. uitschieters (IQR)',
      isBase: true,
    },
    {
      label: 'Laagste realistisch',
      value: breakdown.lowestRealistic,
      description: 'P10 van prijscluster',
      isBase: true,
    },
    {
      label: 'Basiswaarde',
      value: breakdown.baseValue,
      description: 'Gewogen gemiddelde',
      isSubtotal: true,
    },
    {
      label: 'Opties correctie',
      value: breakdown.optionsAdjustment,
      description: 'Meerwaarde geselecteerde opties',
      isAdjustment: true,
    },
    {
      label: 'Courantheid correctie',
      value: breakdown.courantheidAdjustment,
      description: 'Impact marktliquiditeit',
      isAdjustment: true,
    },
    {
      label: 'Trend correctie',
      value: breakdown.trendAdjustment,
      description: 'Impact markttrend',
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
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2 pt-2">
            {rows.map((row, index) => (
              <div
                key={index}
                className={cn(
                  'flex items-center justify-between py-2 px-3 rounded-md text-sm',
                  row.isSubtotal && 'bg-muted font-medium border-t border-border mt-2',
                  row.isAdjustment && row.value !== 0 && 'bg-muted/50'
                )}
              >
                <div>
                  <span className={cn(row.isSubtotal && 'font-semibold')}>
                    {row.label}
                  </span>
                  <p className="text-xs text-muted-foreground">{row.description}</p>
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
                <span className="font-bold text-primary">Finale Taxatiewaarde</span>
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
