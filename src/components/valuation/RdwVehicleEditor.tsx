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
      icon: CheckCircle,
      className: 'bg-success/10 text-success border-success/30',
    },
    inferred: { 
      label: 'Auto', 
      icon: Zap,
      className: 'bg-warning/10 text-warning border-warning/30',
    },
    missing: { 
      label: 'Leeg', 
      icon: AlertCircle,
      className: 'bg-destructive/10 text-destructive border-destructive/30',
    },
  };

  const { label, icon: Icon, className } = config[source];

  return (
    <Badge 
      variant="outline" 
      className={cn('text-[10px] gap-0.5 px-1.5 py-0 h-5 font-normal shrink-0', className)}
      title={note}
    >
      <Icon className="h-2.5 w-2.5" />
      {label}
    </Badge>
  );
}

// Helper to safely get field value
function getFieldValue<T>(field: VehicleField<T> | undefined, fallback: T): T {
  return field?.value ?? fallback;
}

function getFieldSource(field: VehicleField<unknown> | undefined): DataSource {
  return field?.source ?? 'missing';
}

export function RdwVehicleEditor({ vehicle, onConfirm, onCancel }: RdwVehicleEditorProps) {
  const { data: fuels } = useVehicleFuels();
  const { data: transmissions } = useVehicleTransmissions();
  const { data: bodyTypes } = useVehicleBodyTypes();

  const [powerUnit, setPowerUnit] = useState<'hp' | 'kw'>('hp');
  
  // Ensure vehicle has proper structure with safe defaults
  const createSafeVehicle = (v: RdwVehicleExtended): RdwVehicleExtended => ({
    licensePlate: v.licensePlate || '',
    make: v.make ?? { value: '', source: 'missing' },
    model: v.model ?? { value: '', source: 'missing' },
    year: v.year ?? { value: new Date().getFullYear(), source: 'missing' },
    fuelType: v.fuelType ?? { value: '', source: 'missing' },
    transmission: v.transmission ?? { value: '', source: 'missing' },
    bodyType: v.bodyType ?? { value: '', source: 'missing' },
    power: v.power ?? { value: null, source: 'missing' },
    color: v.color ?? { value: null, source: 'missing' },
    doors: v.doors ?? { value: 4, source: 'missing' },
  });

  // Editable state
  const [editedVehicle, setEditedVehicle] = useState<RdwVehicleExtended>(() => createSafeVehicle(vehicle));

  useEffect(() => {
    setEditedVehicle(createSafeVehicle(vehicle));
  }, [vehicle]);

  const updateField = <T,>(
    field: keyof RdwVehicleExtended,
    value: T,
    markAsEdited = true
  ) => {
    setEditedVehicle(prev => {
      const currentField = prev[field] as VehicleField<T> | undefined;
      return {
        ...prev,
        [field]: {
          value,
          source: markAsEdited ? 'inferred' : (currentField?.source ?? 'missing'),
          note: markAsEdited ? 'Handmatig aangepast' : currentField?.note,
        },
      };
    });
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
    getFieldValue(editedVehicle.make, '') && 
    getFieldValue(editedVehicle.model, '') && 
    getFieldValue(editedVehicle.fuelType, '') &&
    getFieldValue(editedVehicle.transmission, '') &&
    getFieldValue(editedVehicle.bodyType, '');

  // Count issues
  const issues = [
    !getFieldValue(editedVehicle.transmission, '') && 'Transmissie',
    !getFieldValue(editedVehicle.bodyType, '') && 'Carrosserie',
    !getFieldValue(editedVehicle.power, null) && 'Vermogen',
  ].filter(Boolean);

  const warnings = [
    getFieldSource(editedVehicle.transmission) === 'inferred' && editedVehicle.transmission?.note,
    getFieldSource(editedVehicle.bodyType) === 'inferred' && editedVehicle.bodyType?.note,
  ].filter(Boolean);

  return (
    <Card className="bg-muted/50 border-primary/30">
      <CardContent className="p-3 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Car className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm text-foreground truncate">
              Voertuig: {vehicle.licensePlate}
            </h4>
            <p className="text-xs text-muted-foreground">
              Controleer de gegevens
            </p>
          </div>
        </div>

        {/* Fields - Single Column Layout */}
        <div className="space-y-2.5">
          {/* Merk - full width */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-medium text-muted-foreground">Merk</Label>
              <SourceBadge source={getFieldSource(editedVehicle.make)} />
            </div>
            <Input
              value={getFieldValue(editedVehicle.make, '')}
              onChange={(e) => updateField('make', e.target.value)}
              className="bg-background border-border h-8 text-sm"
            />
          </div>

          {/* Model - full width */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-medium text-muted-foreground">Model</Label>
              <SourceBadge source={getFieldSource(editedVehicle.model)} />
            </div>
            <Input
              value={getFieldValue(editedVehicle.model, '')}
              onChange={(e) => updateField('model', e.target.value)}
              className="bg-background border-border h-8 text-sm"
            />
          </div>

          {/* Bouwjaar + Brandstof */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-medium text-muted-foreground">Bouwjaar</Label>
                <SourceBadge source={getFieldSource(editedVehicle.year)} />
              </div>
              <Input
                type="number"
                value={getFieldValue(editedVehicle.year, new Date().getFullYear())}
                onChange={(e) => updateField('year', parseInt(e.target.value) || 0)}
                className="bg-background border-border h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-medium text-muted-foreground">Brandstof</Label>
                <SourceBadge source={getFieldSource(editedVehicle.fuelType)} />
              </div>
              <Select
                value={getFieldValue(editedVehicle.fuelType, '')}
                onValueChange={(v) => updateField('fuelType', v)}
              >
                <SelectTrigger className="bg-background border-border h-8 text-sm">
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
          </div>

          {/* Transmissie + Carrosserie */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-medium text-muted-foreground">Transmissie</Label>
                <SourceBadge 
                  source={getFieldSource(editedVehicle.transmission)} 
                  note={editedVehicle.transmission?.note}
                />
              </div>
              <Select
                value={getFieldValue(editedVehicle.transmission, '') || undefined}
                onValueChange={(v) => updateField('transmission', v)}
              >
                <SelectTrigger className={cn(
                  "bg-background border-border h-8 text-sm",
                  !getFieldValue(editedVehicle.transmission, '') && "border-destructive/50"
                )}>
                  <SelectValue placeholder="Kies..." />
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
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-medium text-muted-foreground">Carrosserie</Label>
                <SourceBadge 
                  source={getFieldSource(editedVehicle.bodyType)}
                  note={editedVehicle.bodyType?.note}
                />
              </div>
              <Select
                value={getFieldValue(editedVehicle.bodyType, '') || undefined}
                onValueChange={(v) => updateField('bodyType', v)}
              >
                <SelectTrigger className={cn(
                  "bg-background border-border h-8 text-sm",
                  !getFieldValue(editedVehicle.bodyType, '') && "border-destructive/50"
                )}>
                  <SelectValue placeholder="Kies..." />
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
          </div>

          {/* Kleur - full width */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-medium text-muted-foreground">Kleur</Label>
              <SourceBadge source={getFieldSource(editedVehicle.color)} />
            </div>
            <Input
              value={getFieldValue(editedVehicle.color, null) || ''}
              onChange={(e) => updateField('color', e.target.value || null)}
              className="bg-background border-border h-8 text-sm"
              placeholder="Onbekend"
            />
          </div>

          {/* Vermogen - full width with proper toggle */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-medium text-muted-foreground">Vermogen</Label>
              <SourceBadge 
                source={getFieldSource(editedVehicle.power)}
                note={editedVehicle.power?.note}
              />
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                value={powerUnit === 'hp' 
                  ? (getFieldValue(editedVehicle.power, null)?.hp || '') 
                  : (getFieldValue(editedVehicle.power, null)?.kw || '')
                }
                onChange={(e) => updatePower(parseInt(e.target.value) || 0, powerUnit)}
                className={cn(
                  "bg-background border-border h-8 text-sm flex-1",
                  !getFieldValue(editedVehicle.power, null) && "border-warning/50"
                )}
                placeholder="bijv. 150"
              />
              <div className="flex shrink-0 rounded-md border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setPowerUnit('hp')}
                  className={cn(
                    "px-3 h-8 text-xs font-medium transition-colors",
                    powerUnit === 'hp' 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  PK
                </button>
                <button
                  type="button"
                  onClick={() => setPowerUnit('kw')}
                  className={cn(
                    "px-3 h-8 text-xs font-medium transition-colors border-l border-border",
                    powerUnit === 'kw' 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  kW
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Warnings and Issues */}
        {(warnings.length > 0 || issues.length > 0) && (
          <div className="space-y-1.5 pt-2 border-t border-border">
            {warnings.map((warning, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px] text-warning">
                <Zap className="h-3 w-3 shrink-0" />
                <span className="truncate">{warning}</span>
              </div>
            ))}
            {issues.map((issue, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px] text-destructive">
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span className="truncate">{issue} ontbreekt</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8"
            onClick={onCancel}
          >
            Annuleren
          </Button>
          <Button
            size="sm"
            className="flex-1 h-8"
            onClick={handleConfirm}
            disabled={!hasRequiredFields}
          >
            <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
            Bevestigen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}