import { Navigate, Route, Routes } from 'react-router-dom';
import { ConsoleLayout } from '@/layouts/ConsoleLayout';
import { TasksPage } from '@/features/tasks/TasksPage';
import { UsersPage } from '@/features/users/UsersPage';
import { ClientsPage } from '@/features/clients/ClientsPage';
import { DriversPage } from '@/features/drivers/DriversPage';
import { ChatPage } from '@/features/chat/ChatPage';
import { MapPage } from '@/features/map/MapPage';
import { AdditionalServicesPage } from '@/features/finance/AdditionalServicesPage';
import { FreightItemsPage } from '@/features/finance/FreightItemsPage';
import { ServiceLevelsPage } from '@/features/finance/ServiceLevelsPage';
import { ServiceZonesPage } from '@/features/finance/ServiceZonesPage';
import { ZoneBookEditorPage } from '@/features/finance/ZoneBookEditorPage';
import { ZoneMapPage } from '@/features/finance/ZoneMapPage';
import { InvoicesPage } from '@/features/finance/InvoicesPage';
import { InvoiceDetailPage } from '@/features/finance/InvoiceDetailPage';
import { RateCardsPage } from '@/features/finance/RateCardsPage';
import { RateCardEditorPage } from '@/features/finance/RateCardEditorPage';
import { RateCardTestPage } from '@/features/finance/RateCardTestPage';

export default function App() {
  return (
    <Routes>
      <Route element={<ConsoleLayout />}>
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/drivers" element={<DriversPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/finance/additional-services" element={<AdditionalServicesPage />} />
        <Route path="/finance/freight-items" element={<FreightItemsPage />} />
        <Route path="/finance/service-levels" element={<ServiceLevelsPage />} />
        <Route path="/finance/service-zones" element={<ServiceZonesPage />} />
        <Route path="/finance/service-zones/:bookId" element={<ZoneBookEditorPage />} />
        <Route path="/finance/service-zones/:bookId/map" element={<ZoneMapPage />} />
        <Route path="/finance/invoices" element={<InvoicesPage />} />
        <Route path="/finance/invoices/:invoiceId" element={<InvoiceDetailPage />} />
        <Route path="/finance/rate-cards" element={<RateCardsPage />} />
        <Route path="/finance/rate-cards/:cardId" element={<RateCardEditorPage />} />
        <Route path="/finance/rate-cards/:cardId/test" element={<RateCardTestPage />} />
        <Route path="*" element={<Navigate to="/tasks" replace />} />
      </Route>
    </Routes>
  );
}
