import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useVehicleOptions, OptionsDatabase } from '@/hooks/useVehicleValues';
import { ChevronDown, X, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OptionsSelectorProps {
  make: string;
  fuelType?: string;
  selectedOptions: string[];
  onOptionsChange: (options: string[]) => void;
}

export function OptionsSelector({ make, fuelType, selectedOptions, onOptionsChange }: OptionsSelectorProps) {
  const { data: optionsData, isLoading } = useVehicleOptions(make, fuelType);
  const [openCategories, setOpenCategories] = useState<string[]>(['performance']);

  const toggleCategory = (category: string) => {
    setOpenCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const toggleOption = (optionValue: string) => {
    onOptionsChange(
      selectedOptions.includes(optionValue)
        ? selectedOptions.filter(o => o !== optionValue)
        : [...selectedOptions, optionValue]
    );
  };

  const removeOption = (optionValue: string) => {
    onOptionsChange(selectedOptions.filter(o => o !== optionValue));
  };

  const getOptionLabel = (value: string): string => {
    if (!optionsData) return value;
    
    for (const category of Object.values(optionsData)) {
      const option = category.options.find(o => o.value === value);
      if (option) return option.label;
    }
    return value;
  };

  if (!make) {
    return (
      <div className="text-center text-sm text-muted-foreground py-4">
        Selecteer eerst een merk om opties te zien
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Opties laden...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Selected options */}
      {selectedOptions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Geselecteerde opties:</p>
          <div className="flex flex-wrap gap-2">
            {selectedOptions.map(option => (
              <Badge 
                key={option} 
                variant="secondary" 
                className="pl-2 pr-1 py-1 gap-1 cursor-pointer hover:bg-destructive/20"
                onClick={() => removeOption(option)}
              >
                {getOptionLabel(option)}
                <X className="h-3 w-3" />
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Option categories */}
      <ScrollArea className="h-[280px] pr-4">
        <div className="space-y-2">
          {optionsData && Object.entries(optionsData).map(([categoryKey, category]) => (
            <Collapsible
              key={categoryKey}
              open={openCategories.includes(categoryKey)}
              onOpenChange={() => toggleCategory(categoryKey)}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{category.label}</span>
                  {category.options.filter(o => selectedOptions.includes(o.value)).length > 0 && (
                    <Badge variant="default" className="text-xs h-5">
                      {category.options.filter(o => selectedOptions.includes(o.value)).length}
                    </Badge>
                  )}
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 transition-transform",
                  openCategories.includes(categoryKey) && "rotate-180"
                )} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="grid grid-cols-2 gap-2 pl-2">
                  {category.options.map(option => (
                    <label
                      key={option.value}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors text-sm",
                        selectedOptions.includes(option.value) 
                          ? "bg-primary/10 text-primary" 
                          : "hover:bg-muted"
                      )}
                    >
                      <Checkbox
                        checked={selectedOptions.includes(option.value)}
                        onCheckedChange={() => toggleOption(option.value)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
