import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Save, Sliders } from 'lucide-react';
import { useSystemSettings, useBulkUpdateSystemSettings, SystemSettings } from '@/hooks/useSystemSettings';

export function SystemSettingsCard() {
  const { data: settings, isLoading, error } = useSystemSettings();
  const updateSettings = useBulkUpdateSystemSettings();

  const [localSettings, setLocalSettings] = useState<SystemSettings>({
    api_rate_limit: 100,
    api_timeout: 30,
    debug_mode: false,
  });
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
      setHasChanges(false);
    }
  }, [settings]);

  const updateLocal = (key: keyof SystemSettings, value: number | boolean) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateSettings.mutate(localSettings, {
      onSuccess: () => setHasChanges(false),
    });
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sliders className="h-5 w-5 text-primary" />
            API Instellingen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sliders className="h-5 w-5 text-primary" />
            API Instellingen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive text-sm">Fout bij laden</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Sliders className="h-5 w-5 text-primary" />
          API Instellingen
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs text-muted-foreground">Rate Limit (req/min)</Label>
          <Input
            type="number"
            value={localSettings.api_rate_limit}
            onChange={(e) => updateLocal('api_rate_limit', parseInt(e.target.value) || 0)}
            min={1}
            max={1000}
            className="mt-1 bg-muted border-border"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Timeout (seconds)</Label>
          <Input
            type="number"
            value={localSettings.api_timeout}
            onChange={(e) => updateLocal('api_timeout', parseInt(e.target.value) || 0)}
            min={1}
            max={300}
            className="mt-1 bg-muted border-border"
          />
        </div>
        <div className="flex items-center justify-between pt-2">
          <Label className="text-sm text-foreground">Debug mode</Label>
          <Switch
            checked={localSettings.debug_mode}
            onCheckedChange={(checked) => updateLocal('debug_mode', checked)}
          />
        </div>
        {hasChanges && (
          <Button
            onClick={handleSave}
            disabled={updateSettings.isPending}
            className="w-full mt-2"
            size="sm"
          >
            <Save className="h-4 w-4 mr-2" />
            {updateSettings.isPending ? 'Opslaan...' : 'Opslaan'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
