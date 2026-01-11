import { MainLayout } from '@/components/layout/MainLayout';
import { ListingFilters } from '@/components/listings/ListingFilters';
import { ListingTable } from '@/components/listings/ListingTable';

export default function Listings() {
  return (
    <MainLayout
      title="Markt Listings"
      subtitle="Alle actieve advertenties in de Nederlandse markt"
    >
      <ListingFilters />
      <ListingTable />
    </MainLayout>
  );
}
