import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { Loader2 } from "lucide-react";
import type { UserRole } from "@/types";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import LoginPage from "./pages/LoginPage";
import DashboardLayout from "./components/DashboardLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import BillerManagement from "./pages/admin/BillerManagement";
import BundleManagement from "./pages/admin/BundleManagement";
import UserManagement from "./pages/admin/UserManagement";
import TransactionList from "./pages/admin/TransactionList";
import CashFlow from "./pages/admin/CashFlow";
import Reports from "./pages/admin/Reports";
import SchoolDashboard from "./pages/school/SchoolDashboard";
import StudentList from "./pages/school/StudentList";
import FeePlans from "./pages/school/FeePlans";
import FeeLedger from "./pages/school/FeeLedger";
import Scholarships from "./pages/school/Scholarships";
import InvoiceList from "./pages/school/InvoiceList";
import SchoolPayments from "./pages/school/SchoolPayments";
import RealTimePayments from "./pages/school/RealTimePayments";
import SchoolReports from "./pages/school/SchoolReports";
import PaymentPrograms from "./pages/school/PaymentPrograms";
import Defaulters from "./pages/school/Defaulters";
import SchoolSettings from "./pages/school/SchoolSettings";
import LoginActivity from "./pages/school/LoginActivity";
import OrgDashboard from "./pages/org/OrgDashboard";
import OrgLoginActivity from "./pages/org/OrgLoginActivity";
import OrgInvoices from "./pages/org/OrgInvoices";
import OrgPayments from "./pages/org/OrgPayments";
import OrgPaymentHistory from "./pages/org/OrgPaymentHistory";
import OrgRealtimePayments from "./pages/org/OrgRealtimePayments";
import OrgReports from "./pages/org/OrgReports";
import OrgSettings from "./pages/org/OrgSettings";
import OrgSandbox from "./pages/org/OrgSandbox";
import OrgWebhookConfig from "./pages/org/OrgWebhookConfig";
import AuditTrail from "./pages/admin/AuditTrail";
import OneLinkSandbox from "./pages/admin/OneLinkSandbox";
import FetchBundleSandbox from "./pages/admin/FetchBundleSandbox";
import ApiReference from "./pages/admin/ApiReference";
import DevTools from "./pages/admin/DevTools";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ROLE_PATHS: Record<UserRole, string> = { admin: '/admin', school: '/school', org: '/org' };

/** Redirects unauthenticated users to /login and cross-role intruders to their own dashboard. */
const ProtectedRoute = ({ requiredRole }: { requiredRole: UserRole }) => {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== requiredRole) return <Navigate to={ROLE_PATHS[user.role]} replace />;
  return <DashboardLayout />;
};

const AppRoutes = () => {
  const [restoring, setRestoring] = useState(true);
  const restoreSession = useAuthStore((s) => s.restoreSession);

  useEffect(() => {
    restoreSession().finally(() => setRestoring(false));
  }, [restoreSession]);

  if (restoring) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
          
          <Route path="/admin" element={<ProtectedRoute requiredRole="admin" />}>
            <Route index element={<AdminDashboard />} />
            <Route path="billers" element={<BillerManagement />} />
            <Route path="bundles" element={<BundleManagement />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="transactions" element={<TransactionList />} />
            <Route path="cashflow" element={<CashFlow />} />
            <Route path="reports" element={<Reports />} />
            <Route path="audit" element={<AuditTrail />} />
            <Route path="onelink-sandbox" element={<OneLinkSandbox />} />
            <Route path="fetchbundle-sandbox" element={<FetchBundleSandbox />} />
            <Route path="api-reference" element={<ApiReference />} />
            <Route path="dev-tools" element={<DevTools />} />
          </Route>

          <Route path="/school" element={<ProtectedRoute requiredRole="school" />}>
            <Route index element={<SchoolDashboard />} />
            <Route path="students" element={<StudentList />} />
            <Route path="fee-plans" element={<FeePlans />} />
            <Route path="fee-ledger" element={<FeeLedger />} />
            <Route path="scholarships" element={<Scholarships />} />
            <Route path="billing" element={<InvoiceList />} />
            <Route path="invoices" element={<InvoiceList />} />
            <Route path="defaulters" element={<Defaulters />} />
            <Route path="payments" element={<SchoolPayments />} />
            <Route path="realtime-payments" element={<RealTimePayments />} />
            <Route path="payment-programs" element={<PaymentPrograms />} />
            <Route path="reports" element={<SchoolReports />} />
            <Route path="login-activity" element={<LoginActivity />} />
            <Route path="settings" element={<SchoolSettings />} />
          </Route>

          <Route path="/org" element={<ProtectedRoute requiredRole="org" />}>
            <Route index element={<OrgDashboard />} />
            <Route path="invoices" element={<OrgInvoices />} />
            <Route path="payments" element={<OrgPayments />} />
            <Route path="history" element={<OrgPaymentHistory />} />
            <Route path="realtime-payments" element={<OrgRealtimePayments />} />
            <Route path="reports" element={<OrgReports />} />
            <Route path="login-activity" element={<OrgLoginActivity />} />
            <Route path="sandbox" element={<OrgSandbox />} />
            <Route path="settings" element={<OrgSettings />} />
            <Route path="webhook-config" element={<OrgWebhookConfig />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
