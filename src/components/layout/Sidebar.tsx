import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Car,
  Calculator,
  Building2,
  TrendingUp,
  ShieldAlert,
  Settings,
  Bell,
  ChevronLeft,
  ChevronRight,
  Database,
  Search,
  Layers
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

const mainNavItems: NavItem[] = [
  { title: 'Dashboard', href: '/', icon: LayoutDashboard },
  { title: 'Markt Listings', href: '/listings', icon: Car },
  { title: 'Taxatie', href: '/valuation', icon: Calculator },
  { title: 'Segment Library', href: '/segments', icon: Layers },
  { title: 'Dealer Intelligence', href: '/dealers', icon: Building2 },
  { title: 'Inventory Monitor', href: '/inventory', icon: TrendingUp },
  { title: 'Alerts & Watchlists', href: '/alerts', icon: Bell, badge: 3 },
];

const systemNavItems: NavItem[] = [
  { title: 'Datakwaliteit', href: '/quality', icon: ShieldAlert, badge: 12 },
  { title: 'Admin & System', href: '/admin', icon: Settings },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Car className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-foreground">Autocity</span>
          </div>
        )}
        {collapsed && (
          <div className="mx-auto h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Car className="h-5 w-5 text-primary-foreground" />
          </div>
        )}
      </div>

      {/* Search (when expanded) */}
      {!collapsed && (
        <div className="p-4">
          <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent px-3 py-2 text-sidebar-foreground">
            <Search className="h-4 w-4" />
            <span className="text-sm text-muted-foreground">Zoeken...</span>
            <kbd className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">⌘K</kbd>
          </div>
        </div>
      )}

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        <div className={cn('mb-2', collapsed ? 'px-2' : 'px-3')}>
          {!collapsed && (
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Market Intelligence
            </span>
          )}
        </div>
        {mainNavItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
                collapsed && 'justify-center px-2'
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive && 'text-primary')} />
              {!collapsed && <span>{item.title}</span>}
              {!collapsed && item.badge && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {item.badge}
                </Badge>
              )}
            </Link>
          );
        })}

        <div className={cn('mb-2 mt-6', collapsed ? 'px-2' : 'px-3')}>
          {!collapsed && (
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Systeem
            </span>
          )}
        </div>
        {systemNavItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
                collapsed && 'justify-center px-2'
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive && 'text-primary')} />
              {!collapsed && <span>{item.title}</span>}
              {!collapsed && item.badge && (
                <Badge variant="destructive" className="ml-auto text-xs">
                  {item.badge}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Data Status */}
      {!collapsed && (
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Database className="h-3.5 w-3.5" />
            <span>52.340 listings</span>
            <span className="ml-auto flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
              Live
            </span>
          </div>
        </div>
      )}

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>
    </aside>
  );
}
