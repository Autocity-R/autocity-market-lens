import { Bell, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { mockAlerts } from '@/lib/mockData';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const unreadAlerts = mockAlerts.filter(a => !a.isRead).length;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 backdrop-blur px-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Quick Stats */}
        <div className="hidden md:flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-success" />
            <span className="text-muted-foreground">4 scrapers actief</span>
          </div>
          <div className="text-muted-foreground">
            Laatste update: <span className="text-foreground">09:30</span>
          </div>
        </div>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unreadAlerts > 0 && (
                <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs bg-destructive">
                  {unreadAlerts}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Meldingen</span>
              <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-primary">
                Alles gelezen
              </Button>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {mockAlerts.slice(0, 4).map((alert) => (
              <DropdownMenuItem key={alert.id} className="flex flex-col items-start gap-1 py-3">
                <div className="flex items-center gap-2 w-full">
                  <span className={`h-2 w-2 rounded-full ${
                    alert.severity === 'critical' ? 'bg-destructive' :
                    alert.severity === 'warning' ? 'bg-warning' : 'bg-info'
                  }`} />
                  <span className="font-medium text-sm">{alert.title}</span>
                  {!alert.isRead && (
                    <span className="ml-auto h-2 w-2 rounded-full bg-primary" />
                  )}
                </div>
                <span className="text-xs text-muted-foreground pl-4">{alert.description}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-center text-sm text-primary">
              Alle meldingen bekijken
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Settings */}
        <Button variant="ghost" size="icon">
          <Settings className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
