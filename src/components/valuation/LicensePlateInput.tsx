import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRdwLookup, RdwVehicle } from '@/hooks/useRdwLookup';
import { Search, Loader2, Car, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface LicensePlateInputProps {
  onVehicleFound: (vehicle: RdwVehicle) => void;
}

export function LicensePlateInput({ onVehicleFound }: LicensePlateInputProps) {
  const [plate, setPlate] = useState('');
  const [foundVehicle, setFoundVehicle] = useState<RdwVehicle | null>(null);
  const rdwLookup = useRdwLookup();

  const formatPlate = (value: string): string => {
    // Remove all non-alphanumeric characters
    const clean = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    
    // Format as XX-999-X pattern (Dutch license plate)
    if (clean.length <= 2) return clean;
    if (clean.length <= 5) return `${clean.slice(0, 2)}-${clean.slice(2)}`;
    return `${clean.slice(0, 2)}-${clean.slice(2, 5)}-${clean.slice(5, 7)}`;
  };

  const handlePlateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPlate(e.target.value);
    setPlate(formatted);
    setFoundVehicle(null);
  };

  const handleLookup = async () => {
    if (!plate || plate.replace(/-/g, '').length < 6) {
      toast.error('Voer een geldig kenteken in');
      return;
    }

    try {
      const result = await rdwLookup.mutateAsync(plate);
      if (result.success && result.vehicle) {
        setFoundVehicle(result.vehicle);
        toast.success('Voertuig gevonden');
      } else {
        toast.error(result.error || 'Kenteken niet gevonden');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fout bij ophalen');
    }
  };

  const handleUseVehicle = () => {
    if (foundVehicle) {
      onVehicleFound(foundVehicle);
      toast.success('Voertuiggegevens overgenomen');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            value={plate}
            onChange={handlePlateChange}
            placeholder="XX-999-X"
            className="bg-muted border-border text-lg font-mono tracking-wider uppercase"
            maxLength={9}
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
          />
        </div>
        <Button 
          onClick={handleLookup}
          disabled={rdwLookup.isPending || plate.replace(/-/g, '').length < 6}
        >
          {rdwLookup.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </div>

      {rdwLookup.isPending && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          RDW database raadplegen...
        </div>
      )}

      {foundVehicle && (
        <Card className="bg-muted/50 border-success/30">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-success" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">
                    {foundVehicle.make} {foundVehicle.model}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {foundVehicle.year} • {foundVehicle.fuelType} • {foundVehicle.transmission}
                  </p>
                  {foundVehicle.power && (
                    <p className="text-sm text-muted-foreground">
                      {foundVehicle.power.hp} PK ({foundVehicle.power.kw} kW)
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      {foundVehicle.bodyType}
                    </Badge>
                    {foundVehicle.color && (
                      <Badge variant="outline" className="text-xs">
                        {foundVehicle.color}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {foundVehicle.doors} deuren
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
            <Button 
              className="w-full mt-4" 
              onClick={handleUseVehicle}
            >
              <Car className="h-4 w-4 mr-2" />
              Voertuig overnemen
            </Button>
          </CardContent>
        </Card>
      )}

      {rdwLookup.isError && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          {rdwLookup.error instanceof Error ? rdwLookup.error.message : 'Kenteken niet gevonden'}
        </div>
      )}
    </div>
  );
}
