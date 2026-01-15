import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useRdwLookup, RdwVehicle, RdwVehicleExtended } from '@/hooks/useRdwLookup';
import { RdwVehicleEditor } from './RdwVehicleEditor';
import { Search, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface LicensePlateInputProps {
  onVehicleFound: (vehicle: RdwVehicle) => void;
}

export function LicensePlateInput({ onVehicleFound }: LicensePlateInputProps) {
  const [plate, setPlate] = useState('');
  const [foundVehicle, setFoundVehicle] = useState<RdwVehicleExtended | null>(null);
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

  const handleConfirmVehicle = (vehicle: RdwVehicle) => {
    onVehicleFound(vehicle);
    setFoundVehicle(null);
    setPlate('');
    toast.success('Voertuiggegevens overgenomen');
  };

  const handleCancel = () => {
    setFoundVehicle(null);
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
            disabled={!!foundVehicle}
          />
        </div>
        <Button 
          onClick={handleLookup}
          disabled={rdwLookup.isPending || plate.replace(/-/g, '').length < 6 || !!foundVehicle}
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
        <RdwVehicleEditor
          vehicle={foundVehicle}
          onConfirm={handleConfirmVehicle}
          onCancel={handleCancel}
        />
      )}

      {rdwLookup.isError && !foundVehicle && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          {rdwLookup.error instanceof Error ? rdwLookup.error.message : 'Kenteken niet gevonden'}
        </div>
      )}
    </div>
  );
}
