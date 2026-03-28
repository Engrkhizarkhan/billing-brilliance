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
import Scholarships from "./pages/school/Scholarships";
import InvoiceList from "./pages/school/InvoiceList";
import SchoolPayments from "./pages/school/SchoolPayments";
import SchoolReports from "./pages/school/SchoolReports";
import PaymentPrograms from "./pages/school/PaymentPrograms";
import ETADashboard from "./pages/eta/ETADashboard";
import ServiceList from "./pages/eta/ServiceList";
import ApplicantList from "./pages/eta/ApplicantList";
import ETAInvoices from "./pages/eta/ETAInvoices";
import ETAPayments from "./pages/eta/ETAPayments";
import ETAReports from "./pages/eta/ETAReports";

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
          </Route>

          <Route path="/school" element={<DashboardLayout />}>
            <Route index element={<SchoolDashboard />} />
            <Route path="students" element={<StudentList />} />
            <Route path="fee-plans" element={<FeePlans />} />
            <Route path="scholarships" element={<Scholarships />} />
            <Route path="invoices" element={<InvoiceList />} />
            <Route path="payments" element={<SchoolPayments />} />
            <Route path="payment-programs" element={<PaymentPrograms />} />
            <Route path="reports" element={<SchoolReports />} />
          </Route>

          <Route path="/eta" element={<DashboardLayout />}>
            <Route index element={<ETADashboard />} />
            <Route path="services" element={<ServiceList />} />
            <Route path="applicants" element={<ApplicantList />} />
            <Route path="invoices" element={<ETAInvoices />} />
            <Route path="payments" element={<ETAPayments />} />
            <Route path="reports" element={<ETAReports />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
