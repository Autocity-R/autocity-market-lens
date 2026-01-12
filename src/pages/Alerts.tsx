import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { mockAlerts } from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Bell,
  Layers,
  Car,
  Building2,
  X,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

type AlertFilter = 'all' | 'segment' | 'listing' | 'dealer';

export default function Alerts() {
  const [filter, setFilter] = useState<AlertFilter>('all');

  const filteredAlerts = mockAlerts.filter((alert) => {
    if (filter === 'all') return true;
    return alert.type === filter;
  });

  const unreadCount = mockAlerts.filter((a) => !a.isRead).length;
  const segmentCount = mockAlerts.filter((a) => a.type === 'segment').length;
  const listingCount = mockAlerts.filter((a) => a.type === 'listing').length;
  const dealerCount = mockAlerts.filter((a) => a.type === 'dealer').length;

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'segment':
        return <Layers className="h-4 w-4" />;
      case 'listing':
        return <Car className="h-4 w-4" />;
      case 'dealer':
        return <Building2 className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      default:
        return <Info className="h-4 w-4 text-info" />;
    }
  };

  const getSeverityClass = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-l-destructive bg-destructive/5';
      case 'warning':
        return 'border-l-warning bg-warning/5';
      default:
        return 'border-l-info bg-info/5';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'segment':
        return 'Segment';
      case 'listing':
        return 'Listing';
      case 'dealer':
        return 'Dealer';
      default:
        return type;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffHours < 1) return 'Zojuist';
    if (diffHours < 24) return `${diffHours}u geleden`;
    if (diffHours < 48) return 'Gisteren';
    return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  };

  return (
    <MainLayout
      title="Alerts & Watchlists"
      subtitle="Proactieve meldingen voor marktsegmenten, listings en dealers"
    >
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card
          className={cn(
            'bg-card border-border cursor-pointer transition-all',
            filter === 'all' && 'ring-2 ring-primary'
          )}
          onClick={() => setFilter('all')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">{mockAlerts.length}</p>
                <p className="text-sm text-muted-foreground">Alle alerts</p>
              </div>
              <div className="flex items-center gap-1">
                <Bell className="h-6 w-6 text-primary/50" />
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {unreadCount}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn(
            'bg-card border-border cursor-pointer transition-all',
            filter === 'segment' && 'ring-2 ring-primary'
          )}
          onClick={() => setFilter('segment')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">{segmentCount}</p>
                <p className="text-sm text-muted-foreground">Segment alerts</p>
              </div>
              <Layers className="h-6 w-6 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn(
            'bg-card border-border cursor-pointer transition-all',
            filter === 'listing' && 'ring-2 ring-primary'
          )}
          onClick={() => setFilter('listing')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">{listingCount}</p>
                <p className="text-sm text-muted-foreground">Listing alerts</p>
              </div>
              <Car className="h-6 w-6 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn(
            'bg-card border-border cursor-pointer transition-all',
            filter === 'dealer' && 'ring-2 ring-primary'
          )}
          onClick={() => setFilter('dealer')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">{dealerCount}</p>
                <p className="text-sm text-muted-foreground">Dealer alerts</p>
              </div>
              <Building2 className="h-6 w-6 text-primary/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts List */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5 text-primary" />
            {filter === 'all' ? 'Alle Alerts' : `${getTypeLabel(filter)} Alerts`}
            <Badge variant="secondary" className="ml-2">
              {filteredAlerts.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  'flex items-start justify-between p-4 rounded-lg border-l-2 transition-colors',
                  getSeverityClass(alert.severity),
                  !alert.isRead && 'ring-1 ring-primary/20'
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'h-8 w-8 rounded-full flex items-center justify-center',
                      alert.severity === 'critical'
                        ? 'bg-destructive/20'
                        : alert.severity === 'warning'
                        ? 'bg-warning/20'
                        : 'bg-info/20'
                    )}
                  >
                    {getSeverityIcon(alert.severity)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {getAlertIcon(alert.type)}
                        <span className="ml-1">{getTypeLabel(alert.type)}</span>
                      </Badge>
                      {!alert.isRead && (
                        <Badge variant="default" className="text-xs">
                          Nieuw
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatTimestamp(alert.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground">{alert.title}</p>
                    <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
                    {(alert.segmentName || alert.dealerName) && (
                      <div className="flex items-center gap-2 mt-2">
                        {alert.segmentName && (
                          <Link
                            to="/segments"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <Layers className="h-3 w-3" />
                            {alert.segmentName}
                          </Link>
                        )}
                        {alert.dealerName && (
                          <Link
                            to="/dealers"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <Building2 className="h-3 w-3" />
                            {alert.dealerName}
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-4">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {filteredAlerts.length === 0 && (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">Geen alerts in deze categorie</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-card border-border mt-6">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-info mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Over Alerts</p>
              <p className="text-sm text-muted-foreground mt-1">
                Alerts worden automatisch gegenereerd op basis van uw opgeslagen marktsegmenten in de
                Segment Library. Voeg alerts toe aan segmenten om proactief geïnformeerd te worden over
                prijswijzigingen, marktbewegingen en dealer-activiteit.
              </p>
              <Button variant="link" className="p-0 h-auto mt-2" asChild>
                <Link to="/segments">
                  Ga naar Segment Library
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
