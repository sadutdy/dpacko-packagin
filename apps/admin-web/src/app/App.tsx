import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from '../components/AppShell.js';
import { NotFound } from '../components/NotFound.js';
import { CrmPage } from '../modules/crm/CrmPage.js';
import { ControlsPage } from '../modules/office/ControlsPage.js';
import { DashboardPage } from '../modules/dashboard/DashboardPage.js';
import { DeliveryPage } from '../modules/delivery/DeliveryPage.js';
import { DeskPage } from '../modules/office/DeskPage.js';
import { DispatchPage } from '../modules/office/DispatchPage.js';
import { InvoiceDocumentPage } from '../modules/invoices/InvoiceDocumentPage.js';
import { InvoiceEditorPage } from '../modules/invoices/editor/InvoiceEditorPage.js';
import { InvoicesPage } from '../modules/invoices/InvoicesPage.js';
import { InventoryPage } from '../modules/inventory/InventoryPage.js';
import { LoginPage } from '../modules/auth/LoginPage.js';
import { MyDayPage } from '../modules/office/MyDayPage.js';
import { OrdersPage } from '../modules/orders/OrdersPage.js';
import { OutstandingPage } from '../modules/office/OutstandingPage.js';
import { ProductionPage } from '../modules/production/ProductionPage.js';
import { QuoteDocumentPage } from '../modules/quotes/QuoteDocumentPage.js';
import { QuoteEditorPage } from '../modules/quotes/editor/QuoteEditorPage.js';
import { QuotesPage } from '../modules/quotes/QuotesPage.js';
import { RegistersPage } from '../modules/office/RegistersPage.js';
import { ReportsPage } from '../modules/reports/ReportsPage.js';
import { RoutesPage } from '../modules/office/RoutesPage.js';
import { UsersPage } from '../modules/users/UsersPage.js';
import { SettingsPage } from '../modules/settings/SettingsPage.js';
import { AuthProvider } from './auth/AuthContext.js';
import { ProtectedRoute } from './auth/ProtectedRoute.js';
import { UiPrefsProvider } from './settings/UiPrefsContext.js';

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <AuthProvider>
        <UiPrefsProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/quotes" element={<QuotesPage />} />
              <Route path="/quotes/new" element={<QuoteEditorPage />} />
              <Route path="/quotes/:id" element={<QuoteDocumentPage />} />
              <Route path="/quotes/:id/edit" element={<QuoteEditorPage />} />
              <Route path="/invoices" element={<InvoicesPage />} />
              <Route path="/invoices/new" element={<InvoiceEditorPage />} />
              <Route path="/invoices/:id" element={<InvoiceDocumentPage />} />
              <Route path="/invoices/:id/edit" element={<InvoiceEditorPage />} />
              <Route path="/production" element={<ProductionPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/delivery" element={<DeliveryPage />} />
              <Route path="/crm" element={<CrmPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/office" element={<MyDayPage />} />
              <Route path="/office/desk" element={<DeskPage />} />
              <Route path="/office/routes" element={<RoutesPage />} />
              <Route path="/office/outstanding" element={<OutstandingPage />} />
              <Route path="/office/dispatch" element={<DispatchPage />} />
              <Route path="/office/registers" element={<RegistersPage />} />
              <Route path="/office/controls" element={<ControlsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </UiPrefsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
