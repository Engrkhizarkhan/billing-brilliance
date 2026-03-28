import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard, Users, CreditCard, BarChart3, FileText, Building2,
  GraduationCap, BookOpen, Award, Receipt, Wallet, Briefcase, UserPlus,
  Settings, LogOut, Menu, X, DollarSign
} from 'lucide-react';
import { useState } from 'react';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const navItems: Record<UserRole, NavItem[]> = {
  admin: [
    { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { label: 'Biller Management', path: '/admin/billers', icon: Building2 },
    { label: 'User Management', path: '/admin/users', icon: Users },
    { label: 'Transactions', path: '/admin/transactions', icon: CreditCard },
    { label: 'Cash Flow', path: '/admin/cashflow', icon: DollarSign },
    { label: 'Reports', path: '/admin/reports', icon: BarChart3 },
  ],
  school: [
    { label: 'Dashboard', path: '/school', icon: LayoutDashboard },
    { label: 'Students', path: '/school/students', icon: GraduationCap },
    { label: 'Fee Plans', path: '/school/fee-plans', icon: BookOpen },
    { label: 'Scholarships', path: '/school/scholarships', icon: Award },
    { label: 'Invoices', path: '/school/invoices', icon: Receipt },
    { label: 'Payments', path: '/school/payments', icon: Wallet },
    { label: 'Reports', path: '/school/reports', icon: BarChart3 },
  ],
  eta: [
    { label: 'Dashboard', path: '/eta', icon: LayoutDashboard },
    { label: 'Services', path: '/eta/services', icon: Briefcase },
    { label: 'Applicants', path: '/eta/applicants', icon: UserPlus },
    { label: 'Invoices', path: '/eta/invoices', icon: Receipt },
    { label: 'Payments', path: '/eta/payments', icon: Wallet },
    { label: 'Reports', path: '/eta/reports', icon: BarChart3 },
  ],
};

const DashboardLayout = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) {
    navigate('/login');
    return null;
  }

  const items = navItems[user.role];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === `/${user.role}`) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/20 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sidebar-primary flex items-center justify-center">
            <Building2 className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h2 className="font-bold text-sm">FinBill</h2>
            <p className="text-xs capitalize" style={{ color: 'hsl(var(--sidebar-muted))' }}>{user.role} Panel</p>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(item.path)
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-foreground'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-bold">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs truncate" style={{ color: 'hsl(var(--sidebar-muted))' }}>{user.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b bg-card flex items-center px-4 gap-4 sticky top-0 z-30">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-sm font-semibold text-foreground capitalize">{user.role} Dashboard</h1>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
