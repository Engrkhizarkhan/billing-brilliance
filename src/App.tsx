import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { Loader2 } from "lucide-react";
import type { UserRole } from "@/types";
import LoginPage from "./pages/LoginPage";
import DashboardLayout from "./components/DashboardLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import BillerManagement from "./pages/admin/BillerManagement";
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
import ETEADashboard from "./pages/etea/ETEADashboard";
import ETEALoginActivity from "./pages/etea/ETEALoginActivity";
import ETEAInvoices from "./pages/etea/ETEAInvoices";
import ETEAPayments from "./pages/etea/ETEAPayments";
import ETEARealtimePayments from "./pages/etea/ETEARealtimePayments";
import ETEAReports from "./pages/etea/ETEAReports";
import ETEASettings from "./pages/etea/ETEASettings";
import AuditTrail from "./pages/admin/AuditTrail";
import ApiHealth from "./pages/admin/ApiHealth";
import OneLinkSandbox from "./pages/admin/OneLinkSandbox";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

/** Redirects unauthenticated users to /login and cross-role intruders to their own dashboard. */
const ProtectedRoute = ({ requiredRole }: { requiredRole: UserRole }) => {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== requiredRole) return <Navigate to={`/${user.role}`} replace />;
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
            <Route path="users" element={<UserManagement />} />
            <Route path="transactions" element={<TransactionList />} />
            <Route path="cashflow" element={<CashFlow />} />
            <Route path="reports" element={<Reports />} />
            <Route path="audit" element={<AuditTrail />} />
            <Route path="api-health" element={<ApiHealth />} />
            <Route path="onelink-sandbox" element={<OneLinkSandbox />} />
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

          <Route path="/etea" element={<ProtectedRoute requiredRole="etea" />}>
            <Route index element={<ETEADashboard />} />
            <Route path="invoices" element={<ETEAInvoices />} />
            <Route path="payments" element={<ETEAPayments />} />
            <Route path="realtime-payments" element={<ETEARealtimePayments />} />
            <Route path="reports" element={<ETEAReports />} />
            <Route path="login-activity" element={<ETEALoginActivity />} />
            <Route path="settings" element={<ETEASettings />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
