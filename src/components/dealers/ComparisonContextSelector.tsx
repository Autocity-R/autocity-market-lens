import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BarChart3 } from 'lucide-react';

interface ComparisonContextSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function ComparisonContextSelector({
  value,
  onChange,
}: ComparisonContextSelectorProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
      <BarChart3 className="h-4 w-4 text-primary" />
      <span className="text-sm text-muted-foreground">Vergelijk met:</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-48 bg-background border-border">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="market">
            <div className="flex items-center gap-2">
              <span>Markt</span>
              <Badge variant="secondary" className="text-xs">Standaard</Badge>
            </div>
          </SelectItem>
          <SelectItem value="selected">Geselecteerde dealer</SelectItem>
          <SelectItem value="own">Eigen dealer(s)</SelectItem>
        </SelectContent>
      </Select>
      {value === 'market' && (
        <span className="text-xs text-muted-foreground ml-2">
          Vergelijking t.o.v. gehele markt
        </span>
      )}
      {value === 'selected' && (
        <span className="text-xs text-muted-foreground ml-2">
          Selecteer een dealer om te vergelijken
        </span>
      )}
      {value === 'own' && (
        <span className="text-xs text-muted-foreground ml-2">
          Vergelijking t.o.v. uw dealerbedrijf
        </span>
      )}
    </div>
  );
}
