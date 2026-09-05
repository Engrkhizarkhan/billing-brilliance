import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense, useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { Loader2 } from "lucide-react";
import type { UserRole } from "@/types";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import LoginPage from "./pages/LoginPage";
import DashboardLayout from "./components/DashboardLayout";
import NotFound from "./pages/NotFound";

const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const BillerManagement = lazy(() => import("./pages/admin/BillerManagement"));
const BundleManagement = lazy(() => import("./pages/admin/BundleManagement"));
const UserManagement = lazy(() => import("./pages/admin/UserManagement"));
const TransactionList = lazy(() => import("./pages/admin/TransactionList"));
const CashFlow = lazy(() => import("./pages/admin/CashFlow"));
const Reports = lazy(() => import("./pages/admin/Reports"));
const AuditTrail = lazy(() => import("./pages/admin/AuditTrail"));
const OneLinkSandbox = lazy(() => import("./pages/admin/OneLinkSandbox"));
const FetchBundleSandbox = lazy(() => import("./pages/admin/FetchBundleSandbox"));
const ApiReference = lazy(() => import("./pages/admin/ApiReference"));
const DevTools = lazy(() => import("./pages/admin/DevTools"));
const SchoolDashboard = lazy(() => import("./pages/school/SchoolDashboard"));
const StudentList = lazy(() => import("./pages/school/StudentList"));
const FeePlans = lazy(() => import("./pages/school/FeePlans"));
const FeeLedger = lazy(() => import("./pages/school/FeeLedger"));
const Scholarships = lazy(() => import("./pages/school/Scholarships"));
const InvoiceList = lazy(() => import("./pages/school/InvoiceList"));
const SchoolPayments = lazy(() => import("./pages/school/SchoolPayments"));
const RealTimePayments = lazy(() => import("./pages/school/RealTimePayments"));
const SchoolReports = lazy(() => import("./pages/school/SchoolReports"));
const PaymentPrograms = lazy(() => import("./pages/school/PaymentPrograms"));
const Defaulters = lazy(() => import("./pages/school/Defaulters"));
const SchoolSettings = lazy(() => import("./pages/school/SchoolSettings"));
const LoginActivity = lazy(() => import("./pages/school/LoginActivity"));
const OrgDashboard = lazy(() => import("./pages/org/OrgDashboard"));
const OrgApiIntegration = lazy(() => import("./pages/org/OrgApiIntegration"));
const OrgInvoices = lazy(() => import("./pages/org/OrgInvoices"));
const OrgPayments = lazy(() => import("./pages/org/OrgPayments"));
const OrgPaymentHistory = lazy(() => import("./pages/org/OrgPaymentHistory"));
const OrgRealtimePayments = lazy(() => import("./pages/org/OrgRealtimePayments"));
const OrgReports = lazy(() => import("./pages/org/OrgReports"));
const OrgSandbox = lazy(() => import("./pages/org/OrgSandbox"));
const OrgLoginActivity = lazy(() => import("./pages/org/OrgLoginActivity"));
const OrgSettings = lazy(() => import("./pages/org/OrgSettings"));
const OrgWebhookConfig = lazy(() => import("./pages/org/OrgWebhookConfig"));

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
    <Suspense fallback={<div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}>
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
            <Route path="payments" element={<OrgPayments />} />
            <Route path="history" element={<OrgPaymentHistory />} />
            <Route path="realtime-payments" element={<OrgRealtimePayments />} />
            <Route path="invoices" element={<OrgInvoices />} />
            <Route path="reports" element={<OrgReports />} />
            <Route path="sandbox" element={<OrgSandbox />} />
            <Route path="api-integration" element={<OrgApiIntegration />} />
            <Route path="api-reference" element={<Navigate to="/org/api-integration" replace />} />
            <Route path="reference" element={<Navigate to="/org/api-integration" replace />} />
            <Route path="login-activity" element={<OrgLoginActivity />} />
            <Route path="settings" element={<OrgSettings />} />
            <Route path="webhook-config" element={<OrgWebhookConfig />} />
            <Route path="*" element={<Navigate to="/org" replace />} />
          </Route>

          <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
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
