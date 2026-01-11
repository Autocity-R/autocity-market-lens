import { MainLayout } from '@/components/layout/MainLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { CrawlerStatus } from '@/components/dashboard/CrawlerStatus';
import { AlertsList } from '@/components/dashboard/AlertsList';
import { PriceChart } from '@/components/dashboard/PriceChart';
import { SegmentTable } from '@/components/dashboard/SegmentTable';
import { PortalDistribution } from '@/components/dashboard/PortalDistribution';
import { kpiData } from '@/lib/mockData';
import { Car, Building2, Euro, CheckCircle2, Gauge } from 'lucide-react';

export default function Dashboard() {
  return (
    <MainLayout
      title="Dashboard"
      subtitle="Marktoverzicht Nederlandse automotive sector"
    >
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard
          title="Totaal Listings"
          value={kpiData.totalListings.toLocaleString()}
          change={kpiData.listingsChange}
          changeLabel="vs vorige week"
          icon={<Car className="h-5 w-5" />}
        />
        <StatCard
          title="Actieve Dealers"
          value={kpiData.activeDealers.toLocaleString()}
          change={kpiData.dealersChange}
          changeLabel="vs vorige maand"
          icon={<Building2 className="h-5 w-5" />}
        />
        <StatCard
          title="Gem. Vraagprijs"
          value={`€${kpiData.avgPrice.toLocaleString()}`}
          change={kpiData.priceChange}
          changeLabel="vs vorige week"
          icon={<Euro className="h-5 w-5" />}
        />
        <StatCard
          title="AI Genormaliseerd"
          value={`${kpiData.normalizedPercentage}%`}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard
          title="Gem. Courantheid"
          value={kpiData.avgCourantheid}
          change={kpiData.courantheidChange}
          changeLabel="vs vorige week"
          icon={<Gauge className="h-5 w-5" />}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <PriceChart />
        </div>
        <PortalDistribution />
      </div>

      {/* Data Tables & Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SegmentTable />
        </div>
        <div className="space-y-4">
          <CrawlerStatus />
          <AlertsList />
        </div>
      </div>
    </MainLayout>
  );
}
