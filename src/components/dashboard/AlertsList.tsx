import { mockAlerts } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { Bell, TrendingDown, Users, Package, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AlertsList() {
  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'price_drop':
        return <TrendingDown className="h-4 w-4" />;
      case 'competitor':
        return <Users className="h-4 w-4" />;
      case 'inventory':
        return <Package className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-l-destructive bg-destructive/5';
      case 'warning':
        return 'border-l-warning bg-warning/5';
      default:
        return 'border-l-info bg-info/5';
    }
  };

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-foreground">Recente Alerts</h3>
        <Button variant="ghost" size="sm" className="text-xs text-primary">
          Bekijk alle <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </div>
      <div className="space-y-2">
        {mockAlerts.slice(0, 4).map((alert) => (
          <div
            key={alert.id}
            className={cn(
              'rounded-lg border-l-2 p-3 transition-colors hover:bg-accent/50',
              getSeverityStyles(alert.severity)
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                'mt-0.5 rounded-full p-1.5',
                alert.severity === 'critical' ? 'bg-destructive/20 text-destructive' :
                alert.severity === 'warning' ? 'bg-warning/20 text-warning' : 'bg-info/20 text-info'
              )}>
                {getAlertIcon(alert.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{alert.title}</p>
                  {!alert.isRead && (
                    <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {alert.description}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {new Date(alert.timestamp).toLocaleString('nl-NL', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: 'numeric',
                    month: 'short'
                  })}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
