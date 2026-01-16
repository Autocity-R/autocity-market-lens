import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Settings, RotateCcw, Save } from 'lucide-react';
import { 
  usePortalConfigs, 
  useBulkUpdatePortalConfigs, 
  useResetPortalConfigs,
  PortalConfig,
  PortalSettings 
} from '@/hooks/usePortalConfigs';
import { PortalSettingsDialog } from './PortalSettingsDialog';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

interface LocalPortalState {
  enabled: boolean;
  frequency_minutes: number;
  priority: number;
  settings: PortalSettings;
}

const frequencyOptions = [
  { value: 60, label: '1 uur' },
  { value: 120, label: '2 uur' },
  { value: 180, label: '3 uur' },
  { value: 240, label: '4 uur' },
  { value: 360, label: '6 uur' },
  { value: 720, label: '12 uur' },
  { value: 1440, label: '24 uur' },
];

export function PortalConfigPanel() {
  const { data: portals, isLoading, error } = usePortalConfigs();
  const bulkUpdate = useBulkUpdatePortalConfigs();
  const resetConfigs = useResetPortalConfigs();

  const [localState, setLocalState] = useState<Record<string, LocalPortalState>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [settingsPortal, setSettingsPortal] = useState<PortalConfig | null>(null);

  // Initialize local state from fetched data
  useEffect(() => {
    if (portals) {
      const state: Record<string, LocalPortalState> = {};
      portals.forEach(p => {
        state[p.portal_id] = {
          enabled: p.enabled,
          frequency_minutes: p.frequency_minutes,
          priority: p.priority,
          settings: p.settings,
        };
      });
      setLocalState(state);
      setHasChanges(false);
    }
  }, [portals]);

  const updateLocalState = (portalId: string, updates: Partial<LocalPortalState>) => {
    setLocalState(prev => ({
      ...prev,
      [portalId]: { ...prev[portalId], ...updates },
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    if (!portals) return;

    const updates = portals
      .filter(p => {
        const local = localState[p.portal_id];
        return (
          local.enabled !== p.enabled ||
          local.frequency_minutes !== p.frequency_minutes ||
          local.priority !== p.priority ||
          JSON.stringify(local.settings) !== JSON.stringify(p.settings)
        );
      })
      .map(p => ({
        portalId: p.portal_id,
        updates: localState[p.portal_id],
      }));

    if (updates.length > 0) {
      bulkUpdate.mutate(updates, {
        onSuccess: () => setHasChanges(false),
      });
    }
  };

  const handleReset = () => {
    resetConfigs.mutate();
  };

  const handleSettingsSave = (portalId: string, settings: PortalSettings, priority: number) => {
    updateLocalState(portalId, { settings, priority });
  };

  const formatLastSuccess = (dateStr: string | null) => {
    if (!dateStr) return 'Nooit';
    try {
      return format(new Date(dateStr), "d MMM HH:mm", { locale: nl });
    } catch {
      return 'Nooit';
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5 text-primary" />
            Portal Configuratie
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5 text-primary" />
            Portal Configuratie
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive text-sm">Fout bij laden: {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5 text-primary" />
            Portal Configuratie
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {portals?.map((portal) => {
              const local = localState[portal.portal_id] || {
                enabled: portal.enabled,
                frequency_minutes: portal.frequency_minutes,
              };

              return (
                <div
                  key={portal.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border"
                >
                  <div className="flex items-center gap-4">
                    <Switch
                      checked={local.enabled}
                      onCheckedChange={(checked) =>
                        updateLocalState(portal.portal_id, { enabled: checked })
                      }
                    />
                    <div>
                      <p className="text-sm font-medium text-foreground">{portal.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Laatste sync: {formatLastSuccess(portal.last_success_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Select
                      value={String(local.frequency_minutes)}
                      onValueChange={(value) =>
                        updateLocalState(portal.portal_id, { frequency_minutes: parseInt(value) })
                      }
                    >
                      <SelectTrigger className="w-24 h-8 bg-background border-border text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {frequencyOptions.map((opt) => (
                          <SelectItem key={opt.value} value={String(opt.value)}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Badge variant={local.enabled ? 'default' : 'secondary'}>
                      {local.enabled ? 'Actief' : 'Inactief'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSettingsPortal(portal)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={resetConfigs.isPending}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset naar defaults
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || bulkUpdate.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {bulkUpdate.isPending ? 'Opslaan...' : 'Wijzigingen opslaan'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <PortalSettingsDialog
        portal={settingsPortal}
        open={!!settingsPortal}
        onOpenChange={(open) => !open && setSettingsPortal(null)}
        onSave={handleSettingsSave}
      />
    </>
  );
}
