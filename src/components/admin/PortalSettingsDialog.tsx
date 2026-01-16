import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PortalConfig, PortalSettings } from '@/hooks/usePortalConfigs';

interface PortalSettingsDialogProps {
  portal: PortalConfig | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (portalId: string, settings: PortalSettings, priority: number) => void;
}

export function PortalSettingsDialog({
  portal,
  open,
  onOpenChange,
  onSave,
}: PortalSettingsDialogProps) {
  const [maxPages, setMaxPages] = useState(10);
  const [maxListings, setMaxListings] = useState(500);
  const [delayMs, setDelayMs] = useState(1500);
  const [priority, setPriority] = useState('1');

  useEffect(() => {
    if (portal) {
      setMaxPages(portal.settings.max_pages || 10);
      setMaxListings(portal.settings.max_listings || 500);
      setDelayMs(portal.settings.delay_ms || 1500);
      setPriority(String(portal.priority || 1));
    }
  }, [portal]);

  const handleSave = () => {
    if (!portal) return;
    
    onSave(
      portal.portal_id,
      {
        max_pages: maxPages,
        max_listings: maxListings,
        delay_ms: delayMs,
      },
      parseInt(priority)
    );
    onOpenChange(false);
  };

  if (!portal) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            ⚙️ {portal.name} Instellingen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Scraper Instellingen</Label>
            <div className="h-px bg-border" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-pages" className="text-xs text-muted-foreground">
              Max pagina's per run
            </Label>
            <Input
              id="max-pages"
              type="number"
              value={maxPages}
              onChange={(e) => setMaxPages(parseInt(e.target.value) || 0)}
              min={1}
              max={100}
              className="bg-muted border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-listings" className="text-xs text-muted-foreground">
              Max listings per run
            </Label>
            <Input
              id="max-listings"
              type="number"
              value={maxListings}
              onChange={(e) => setMaxListings(parseInt(e.target.value) || 0)}
              min={10}
              max={5000}
              className="bg-muted border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="delay-ms" className="text-xs text-muted-foreground">
              Delay tussen requests (ms)
            </Label>
            <Input
              id="delay-ms"
              type="number"
              value={delayMs}
              onChange={(e) => setDelayMs(parseInt(e.target.value) || 0)}
              min={100}
              max={10000}
              step={100}
              className="bg-muted border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority" className="text-xs text-muted-foreground">
              Prioriteit
            </Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="bg-muted border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Hoog (1)</SelectItem>
                <SelectItem value="2">Normaal (2)</SelectItem>
                <SelectItem value="3">Laag (3)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button onClick={handleSave}>Opslaan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
