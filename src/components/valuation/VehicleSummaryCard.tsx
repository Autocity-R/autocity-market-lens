import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, X, Zap } from 'lucide-react';
import { RdwVehicle } from '@/hooks/useRdwLookup';

interface VehicleSummaryCardProps {
  vehicle: RdwVehicle;
  onReset: () => void;
}

export function VehicleSummaryCard({ vehicle, onReset }: VehicleSummaryCardProps) {
  const specs = [
    vehicle.year,
    vehicle.fuelType,
    vehicle.transmission,
    vehicle.bodyType,
  ].filter(Boolean);

  const additionalSpecs = [
    vehicle.color,
    vehicle.power?.kw ? `${vehicle.power.kw} kW` : vehicle.power?.hp ? `${vehicle.power.hp} PK` : null,
  ].filter(Boolean);

  return (
    <Card className="bg-primary/5 border-primary/20">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* License plate badge */}
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="default" className="bg-primary text-primary-foreground font-mono text-sm px-2 py-0.5">
                <CheckCircle className="h-3 w-3 mr-1.5" />
                {vehicle.licensePlate}
              </Badge>
            </div>

            {/* Make + Model */}
            <h3 className="font-semibold text-lg leading-tight mb-1">
              {vehicle.make} {vehicle.model}
            </h3>

            {/* Primary specs */}
            {specs.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {specs.join(' • ')}
              </p>
            )}

            {/* Additional specs */}
            {additionalSpecs.length > 0 && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {additionalSpecs.join(' • ')}
              </p>
            )}

            {/* EV indicator */}
            {vehicle.fuelType?.toLowerCase().includes('elektr') && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-primary">
                <Zap className="h-3.5 w-3.5" />
                <span>Elektrisch voertuig</span>
              </div>
            )}
          </div>

          {/* Reset button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={onReset}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
