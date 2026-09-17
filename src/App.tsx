import { Navigate, Route, Routes } from 'react-router-dom';
import { ConsoleLayout } from '@/layouts/ConsoleLayout';
import { TasksPage } from '@/features/tasks/TasksPage';
import { UsersPage } from '@/features/users/UsersPage';
import { ClientsPage } from '@/features/clients/ClientsPage';
import { ChatPage } from '@/features/chat/ChatPage';
import { MapPage } from '@/features/map/MapPage';
import { AdditionalServicesPage } from '@/features/finance/AdditionalServicesPage';
import { FreightItemsPage } from '@/features/finance/FreightItemsPage';
import { ServiceLevelsPage } from '@/features/finance/ServiceLevelsPage';
import { ServiceZonesPage } from '@/features/finance/ServiceZonesPage';
import { ZoneBookEditorPage } from '@/features/finance/ZoneBookEditorPage';
import { ZoneMapPage } from '@/features/finance/ZoneMapPage';
import { TaxRatesPage } from '@/features/finance/TaxRatesPage';
import { RateLeviesPage } from '@/features/finance/RateLeviesPage';
import { RatePlansPage } from '@/features/finance/RatePlansPage';
import { RateVersionBuilderPage } from '@/features/finance/RateVersionBuilderPage';
import { QuoteCalculatorPage } from '@/features/finance/QuoteCalculatorPage';

export default function App() {
  return (
    <Routes>
      <Route element={<ConsoleLayout />}>
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/finance/additional-services" element={<AdditionalServicesPage />} />
        <Route path="/finance/freight-items" element={<FreightItemsPage />} />
        <Route path="/finance/service-levels" element={<ServiceLevelsPage />} />
        <Route path="/finance/service-zones" element={<ServiceZonesPage />} />
        <Route path="/finance/service-zones/:bookId" element={<ZoneBookEditorPage />} />
        <Route path="/finance/service-zones/:bookId/map" element={<ZoneMapPage />} />
        <Route path="/finance/tax-rates" element={<TaxRatesPage />} />
        <Route path="/finance/rate-levies" element={<RateLeviesPage />} />
        <Route path="/finance/rate-plans" element={<RatePlansPage />} />
        <Route path="/finance/rate-plans/:planId/build/:versionId" element={<RateVersionBuilderPage />} />
        <Route path="/finance/quote" element={<QuoteCalculatorPage />} />
        <Route path="*" element={<Navigate to="/tasks" replace />} />
      </Route>
    </Routes>
  );
}
