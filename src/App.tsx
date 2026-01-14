import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DataSourceProvider } from "@/providers/DataSourceProvider";
import Dashboard from "./pages/Dashboard";
import Listings from "./pages/Listings";
import Valuation from "./pages/Valuation";
import Dealers from "./pages/Dealers";
import DealerDetail from "./pages/DealerDetail";
import Inventory from "./pages/Inventory";
import DataQuality from "./pages/DataQuality";
import SegmentLibrary from "./pages/SegmentLibrary";
import Bestsellers from "./pages/Bestsellers";
import Alerts from "./pages/Alerts";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <DataSourceProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/listings" element={<Listings />} />
            <Route path="/valuation" element={<Valuation />} />
            <Route path="/segments" element={<SegmentLibrary />} />
            <Route path="/bestsellers" element={<Bestsellers />} />
            <Route path="/dealers" element={<Dealers />} />
            <Route path="/dealers/:id" element={<DealerDetail />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/quality" element={<DataQuality />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </DataSourceProvider>
  </QueryClientProvider>
);

export default App;
