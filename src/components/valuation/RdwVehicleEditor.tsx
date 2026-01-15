import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { 
  RdwVehicleExtended, 
  DataSource, 
  VehicleField,
  RdwVehicle,
  toSimpleVehicle 
} from '@/hooks/useRdwLookup';
import { 
  useVehicleFuels, 
  useVehicleTransmissions, 
  useVehicleBodyTypes 
} from '@/hooks/useVehicleValues';
import { 
  CheckCircle, 
  AlertTriangle, 
  AlertCircle, 
  Car,
  Zap,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RdwVehicleEditorProps {
  vehicle: RdwVehicleExtended;
  onConfirm: (vehicle: RdwVehicle) => void;
  onCancel: () => void;
}

function SourceBadge({ source, note }: { source: DataSource; note?: string }) {
  const config = {
    rdw: { 
      label: 'RDW', 
      variant: 'default' as const, 
      icon: CheckCircle,
      className: 'bg-success/10 text-success border-success/30 hover:bg-success/20',
    },
    inferred: { 
      label: 'Afgeleid', 
      variant: 'secondary' as const, 
      icon: Zap,
      className: 'bg-warning/10 text-warning border-warning/30 hover:bg-warning/20',
    },
    missing: { 
      label: 'Ontbreekt', 
      variant: 'destructive' as const, 
      icon: AlertCircle,
      className: 'bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20',
    },
  };

  const { label, icon: Icon, className } = config[source];

  return (
    <Badge 
      variant="outline" 
      className={cn('text-xs gap-1 font-normal', className)}
      title={note}
    >
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

export function RdwVehicleEditor({ vehicle, onConfirm, onCancel }: RdwVehicleEditorProps) {
  const { data: fuels } = useVehicleFuels();
  const { data: transmissions } = useVehicleTransmissions();
  const { data: bodyTypes } = useVehicleBodyTypes();

  const [powerUnit, setPowerUnit] = useState<'hp' | 'kw'>('hp');
  
  // Editable state
  const [editedVehicle, setEditedVehicle] = useState<RdwVehicleExtended>(vehicle);

  useEffect(() => {
    setEditedVehicle(vehicle);
  }, [vehicle]);

  const updateField = <T,>(
    field: keyof RdwVehicleExtended,
    value: T,
    markAsEdited = true
  ) => {
    setEditedVehicle(prev => ({
      ...prev,
      [field]: {
        ...(prev[field] as VehicleField<T>),
        value,
        source: markAsEdited ? 'inferred' : (prev[field] as VehicleField<T>).source,
        note: markAsEdited ? 'Handmatig aangepast' : (prev[field] as VehicleField<T>).note,
      },
    }));
  };

  const updatePower = (value: number, unit: 'hp' | 'kw') => {
    const hp = unit === 'hp' ? value : Math.round(value / 0.7355);
    const kw = unit === 'kw' ? value : Math.round(value * 0.7355);
    
    setEditedVehicle(prev => ({
      ...prev,
      power: {
        value: { hp, kw },
        source: 'inferred',
        note: 'Handmatig aangepast',
      },
    }));
  };

  const handleConfirm = () => {
    onConfirm(toSimpleVehicle(editedVehicle));
  };

  // Check if all required fields have values
  const hasRequiredFields = 
    editedVehicle.make.value && 
    editedVehicle.model.value && 
    editedVehicle.fuelType.value &&
    editedVehicle.transmission.value &&
    editedVehicle.bodyType.value;

  // Count issues
  const issues = [
    !editedVehicle.transmission.value && 'Transmissie',
    !editedVehicle.bodyType.value && 'Carrosserie',
    !editedVehicle.power.value && 'Vermogen',
  ].filter(Boolean);

  const warnings = [
    editedVehicle.transmission.source === 'inferred' && editedVehicle.transmission.note,
    editedVehicle.bodyType.source === 'inferred' && editedVehicle.bodyType.note,
  ].filter(Boolean);

  return (
    <Card className="bg-muted/50 border-primary/30">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Car className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-foreground">
              Voertuig gevonden: {vehicle.licensePlate}
            </h4>
            <p className="text-sm text-muted-foreground">
              Controleer en corrigeer de gegevens hieronder
            </p>
          </div>
        </div>

        {/* Fields Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Make */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Merk</Label>
              <SourceBadge source={editedVehicle.make.source} />
            </div>
            <Input
              value={editedVehicle.make.value}
              onChange={(e) => updateField('make', e.target.value)}
              className="bg-background border-border h-9"
            />
          </div>

          {/* Model */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Model</Label>
              <SourceBadge source={editedVehicle.model.source} />
            </div>
            <Input
              value={editedVehicle.model.value}
              onChange={(e) => updateField('model', e.target.value)}
              className="bg-background border-border h-9"
            />
          </div>

          {/* Year */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Bouwjaar</Label>
              <SourceBadge source={editedVehicle.year.source} />
            </div>
            <Input
              type="number"
              value={editedVehicle.year.value}
              onChange={(e) => updateField('year', parseInt(e.target.value) || 0)}
              className="bg-background border-border h-9"
            />
          </div>

          {/* Fuel Type */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Brandstof</Label>
              <SourceBadge source={editedVehicle.fuelType.source} />
            </div>
            <Select
              value={editedVehicle.fuelType.value}
              onValueChange={(v) => updateField('fuelType', v)}
            >
              <SelectTrigger className="bg-background border-border h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fuels?.map((fuel) => (
                  <SelectItem key={fuel} value={fuel}>
                    {fuel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Transmission */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Transmissie</Label>
              <SourceBadge 
                source={editedVehicle.transmission.source} 
                note={editedVehicle.transmission.note}
              />
            </div>
            <Select
              value={editedVehicle.transmission.value || undefined}
              onValueChange={(v) => updateField('transmission', v)}
            >
              <SelectTrigger className={cn(
                "bg-background border-border h-9",
                !editedVehicle.transmission.value && "border-destructive/50"
              )}>
                <SelectValue placeholder="Selecteer..." />
              </SelectTrigger>
              <SelectContent>
                {transmissions?.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Body Type */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Carrosserie</Label>
              <SourceBadge 
                source={editedVehicle.bodyType.source}
                note={editedVehicle.bodyType.note}
              />
            </div>
            <Select
              value={editedVehicle.bodyType.value || undefined}
              onValueChange={(v) => updateField('bodyType', v)}
            >
              <SelectTrigger className={cn(
                "bg-background border-border h-9",
                !editedVehicle.bodyType.value && "border-destructive/50"
              )}>
                <SelectValue placeholder="Selecteer..." />
              </SelectTrigger>
              <SelectContent>
                {bodyTypes?.map((bt) => (
                  <SelectItem key={bt} value={bt}>
                    {bt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Color */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Kleur</Label>
              <SourceBadge source={editedVehicle.color.source} />
            </div>
            <Input
              value={editedVehicle.color.value || ''}
              onChange={(e) => updateField('color', e.target.value || null)}
              className="bg-background border-border h-9"
              placeholder="Onbekend"
            />
          </div>

          {/* Power */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Vermogen</Label>
              <SourceBadge 
                source={editedVehicle.power.source}
                note={editedVehicle.power.note}
              />
            </div>
            <div className="flex gap-1">
              <Input
                type="number"
                value={powerUnit === 'hp' 
                  ? (editedVehicle.power.value?.hp || '') 
                  : (editedVehicle.power.value?.kw || '')
                }
                onChange={(e) => updatePower(parseInt(e.target.value) || 0, powerUnit)}
                className={cn(
                  "bg-background border-border h-9 flex-1",
                  !editedVehicle.power.value && "border-warning/50"
                )}
                placeholder="Optioneel"
              />
              <div className="flex rounded-md border border-border overflow-hidden">
                <Toggle
                  pressed={powerUnit === 'hp'}
                  onPressedChange={() => setPowerUnit('hp')}
                  className="rounded-none border-0 px-2 h-9 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  size="sm"
                >
                  PK
                </Toggle>
                <Toggle
                  pressed={powerUnit === 'kw'}
                  onPressedChange={() => setPowerUnit('kw')}
                  className="rounded-none border-0 px-2 h-9 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  size="sm"
                >
                  kW
                </Toggle>
              </div>
            </div>
          </div>
        </div>

        {/* Warnings and Issues */}
        {(warnings.length > 0 || issues.length > 0) && (
          <div className="space-y-2 pt-2 border-t border-border">
            {warnings.map((warning, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-warning">
                <Zap className="h-3.5 w-3.5" />
                <span>{warning}</span>
              </div>
            ))}
            {issues.map((issue, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>{issue} ontbreekt - vul in voor nauwkeurige taxatie</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onCancel}
          >
            Annuleren
          </Button>
          <Button
            className="flex-1"
            onClick={handleConfirm}
            disabled={!hasRequiredFields}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Bevestig en ga verder
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}