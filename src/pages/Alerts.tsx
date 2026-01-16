import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { mockAlerts } from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  useWatchlistAlerts,
  useTriggeredAlerts,
  useCreateAlert,
  useDeleteAlert,
  useDismissAlert,
} from '@/hooks/useWatchlist';
import { useMarketSegments } from '@/hooks/useCourantheid';
import { useDealersList } from '@/hooks/useDealerIntelligence';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Bell,
  Layers,
  Car,
  Building2,
  X,
  CheckCircle,
  AlertTriangle,
  Info,
  Plus,
  Loader2,
  TrendingDown,
  Eye,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

type AlertFilter = 'all' | 'watchlist' | 'triggered';
type AlertType = 'price_drop' | 'courantheid_change' | 'new_listing' | 'segment_change';

const alertTypeLabels: Record<AlertType, string> = {
  price_drop: 'Prijsdaling',
  courantheid_change: 'Courantheid wijziging',
  new_listing: 'Nieuwe listing',
  segment_change: 'Segment verandering',
};

const alertTypeIcons: Record<AlertType, React.ReactNode> = {
  price_drop: <TrendingDown className="h-4 w-4" />,
  courantheid_change: <Layers className="h-4 w-4" />,
  new_listing: <Car className="h-4 w-4" />,
  segment_change: <Eye className="h-4 w-4" />,
};

export default function Alerts() {
  const [filter, setFilter] = useState<AlertFilter>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newAlertType, setNewAlertType] = useState<AlertType>('price_drop');
  const [newAlertSegmentId, setNewAlertSegmentId] = useState<string>('');
  const [newAlertDealerId, setNewAlertDealerId] = useState<string>('');

  const { data: watchlistAlerts, isLoading: watchlistLoading } = useWatchlistAlerts();
  const { data: triggeredAlerts, isLoading: triggeredLoading } = useTriggeredAlerts();
  const { data: segments } = useMarketSegments();
  const { data: dealers } = useDealersList();
  const createAlert = useCreateAlert();
  const deleteAlert = useDeleteAlert();
  const dismissAlert = useDismissAlert();

  const isLoading = watchlistLoading || triggeredLoading;

  // Combine real alerts with mock alerts for display
  const allAlerts = [
    ...(triggeredAlerts || []).map(a => ({
      id: a.id,
      type: a.alert_type === 'price_drop' ? 'listing' : 
            a.alert_type === 'segment_change' ? 'segment' : 'dealer',
      title: alertTypeLabels[a.alert_type as AlertType],
      description: a.trigger_data?.message || 'Alert getriggerd',
      severity: 'warning' as const,
      timestamp: a.triggered_at || a.created_at,
      isRead: false,
      segmentName: a.segment_name,
      dealerName: a.dealer_name,
      isReal: true,
      realId: a.id,
    })),
    ...mockAlerts,
  ];

  const filteredAlerts = filter === 'watchlist' 
    ? [] // Watchlist shows configured alerts, not triggered ones
    : allAlerts;

  const unreadCount = allAlerts.filter((a) => !a.isRead).length;
  const watchlistCount = watchlistAlerts?.length || 0;
  const triggeredCount = triggeredAlerts?.length || 0;

  const handleCreateAlert = async () => {
    await createAlert.mutateAsync({
      alert_type: newAlertType,
      segment_id: newAlertSegmentId || undefined,
      dealer_id: newAlertDealerId || undefined,
    });
    setIsCreateDialogOpen(false);
    setNewAlertSegmentId('');
    setNewAlertDealerId('');
  };

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
      subtitle="Proactieve meldingen en geconfigureerde alerts"
    >
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
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
                <p className="text-2xl font-bold text-foreground">{unreadCount}</p>
                <p className="text-sm text-muted-foreground">Nieuwe alerts</p>
              </div>
              <Bell className="h-6 w-6 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn(
            'bg-card border-border cursor-pointer transition-all',
            filter === 'watchlist' && 'ring-2 ring-primary'
          )}
          onClick={() => setFilter('watchlist')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">{watchlistCount}</p>
                <p className="text-sm text-muted-foreground">Actieve watchlists</p>
              </div>
              <Eye className="h-6 w-6 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn(
            'bg-card border-border cursor-pointer transition-all',
            filter === 'triggered' && 'ring-2 ring-primary'
          )}
          onClick={() => setFilter('triggered')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">{triggeredCount}</p>
                <p className="text-sm text-muted-foreground">Getriggerde alerts</p>
              </div>
              <AlertTriangle className="h-6 w-6 text-warning/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Watchlist Section */}
      {filter === 'watchlist' && (
        <Card className="bg-card border-border mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Eye className="h-5 w-5 text-primary" />
                Geconfigureerde Watchlists
              </CardTitle>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Nieuwe Alert
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nieuwe Alert Configureren</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <label className="text-sm font-medium">Alert Type</label>
                      <Select value={newAlertType} onValueChange={(v) => setNewAlertType(v as AlertType)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(alertTypeLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              <div className="flex items-center gap-2">
                                {alertTypeIcons[value as AlertType]}
                                {label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Segment (optioneel)</label>
                      <Select value={newAlertSegmentId} onValueChange={setNewAlertSegmentId}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Selecteer segment" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Geen segment</SelectItem>
                          {segments?.map((segment) => (
                            <SelectItem key={segment.id} value={segment.id}>
                              {segment.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Dealer (optioneel)</label>
                      <Select value={newAlertDealerId} onValueChange={setNewAlertDealerId}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Selecteer dealer" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Geen dealer</SelectItem>
                          {dealers?.slice(0, 20).map((dealer) => (
                            <SelectItem key={dealer.id} value={dealer.id}>
                              {dealer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button 
                      className="w-full" 
                      onClick={handleCreateAlert}
                      disabled={createAlert.isPending}
                    >
                      {createAlert.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Alert Toevoegen
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : watchlistAlerts?.length === 0 ? (
              <div className="text-center py-8">
                <Eye className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">Nog geen watchlists geconfigureerd</p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Eerste Alert Toevoegen
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {watchlistAlerts?.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        {alertTypeIcons[alert.alert_type as AlertType]}
                      </div>
                      <div>
                        <p className="font-medium">{alertTypeLabels[alert.alert_type as AlertType]}</p>
                        <p className="text-sm text-muted-foreground">
                          {alert.segment_name && `Segment: ${alert.segment_name}`}
                          {alert.dealer_name && `Dealer: ${alert.dealer_name}`}
                          {!alert.segment_name && !alert.dealer_name && 'Alle items'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={alert.is_active ? 'default' : 'secondary'}>
                        {alert.is_active ? 'Actief' : 'Inactief'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => deleteAlert.mutate(alert.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Alerts List */}
      {filter !== 'watchlist' && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className="h-5 w-5 text-primary" />
              {filter === 'triggered' ? 'Getriggerde Alerts' : 'Alle Alerts'}
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
                          <span className="ml-1 capitalize">{alert.type}</span>
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
                    {(alert as any).isReal && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => dismissAlert.mutate((alert as any).realId)}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    )}
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
      )}

      {/* Info Card */}
      <Card className="bg-card border-border mt-6">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-info mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Over Alerts & Watchlists</p>
              <p className="text-sm text-muted-foreground mt-1">
                Configureer watchlists om automatisch geïnformeerd te worden over prijswijzigingen, 
                courantheid veranderingen en nieuwe listings in uw geselecteerde segmenten en dealers.
              </p>
              <Button variant="link" className="p-0 h-auto mt-2" asChild>
                <Link to="/bestsellers">
                  Bekijk Bestsellers →
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
