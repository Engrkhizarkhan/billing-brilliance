import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import ETADashboard from "./pages/eta/ETADashboard";
import ServiceList from "./pages/eta/ServiceList";
import ApplicantList from "./pages/eta/ApplicantList";
import ETEAPostings from "./pages/eta/ETEAPostings";
import ETAInvoices from "./pages/eta/ETAInvoices";
import ETAPayments from "./pages/eta/ETAPayments";
import ETAReports from "./pages/eta/ETAReports";
import ETAPaymentPrograms from "./pages/eta/ETAPaymentPrograms";
import RollAssignment from "./pages/eta/RollAssignment";
import AdmitCards from "./pages/eta/AdmitCards";
import Results from "./pages/eta/Results";
import ETASettings from "./pages/eta/ETASettings";
import AuditTrail from "./pages/admin/AuditTrail";
import ApiHealth from "./pages/admin/ApiHealth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          
          <Route path="/admin" element={<DashboardLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="billers" element={<BillerManagement />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="transactions" element={<TransactionList />} />
            <Route path="cashflow" element={<CashFlow />} />
            <Route path="reports" element={<Reports />} />
            <Route path="audit" element={<AuditTrail />} />
            <Route path="api-health" element={<ApiHealth />} />
          </Route>

          <Route path="/school" element={<DashboardLayout />}>
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

          <Route path="/eta" element={<DashboardLayout />}>
            <Route index element={<ETADashboard />} />
            <Route path="postings" element={<ETEAPostings />} />
            <Route path="services" element={<ServiceList />} />
            <Route path="applicants" element={<ApplicantList />} />
            <Route path="payment-programs" element={<ETAPaymentPrograms />} />
            <Route path="invoices" element={<ETAInvoices />} />
            <Route path="payments" element={<ETAPayments />} />
            <Route path="reports" element={<ETAReports />} />
            <Route path="roll-assignment" element={<RollAssignment />} />
            <Route path="admit-cards" element={<AdmitCards />} />
            <Route path="results" element={<Results />} />
            <Route path="settings" element={<ETASettings />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
