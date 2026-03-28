import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard, Users, CreditCard, BarChart3, Building2,
  GraduationCap, BookOpen, Award, Receipt, Wallet, Briefcase, UserPlus,
  LogOut, Menu, X, DollarSign, ChevronRight
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
    { label: 'Billers', path: '/admin/billers', icon: Building2 },
    { label: 'Users', path: '/admin/users', icon: Users },
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
    { label: 'Payment Programs', path: '/school/payment-programs', icon: CreditCard },
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

const roleLabels: Record<UserRole, string> = {
  admin: 'Administration',
  school: 'School Portal',
  eta: 'Agency Portal',
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
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-[240px] bg-sidebar text-sidebar-foreground flex flex-col transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-14 px-4 flex items-center gap-2.5 border-b border-sidebar-border">
          <div className="w-7 h-7 rounded-md bg-sidebar-primary flex items-center justify-center">
            <Building2 className="w-3.5 h-3.5 text-sidebar-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-bold text-sm tracking-tight">FinBill</span>
            <span className="text-[10px] ml-1.5 text-sidebar-muted">{roleLabels[user.role]}</span>
          </div>
          <button className="lg:hidden p-1 hover:bg-sidebar-accent rounded" onClick={() => setSidebarOpen(false)}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
          {items.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-colors ${
                  active
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {active && <ChevronRight className="w-3 h-3 opacity-60" />}
              </button>
            );
          })}
        </nav>

        <div className="p-2 border-t border-sidebar-border">
          <div className="flex items-center gap-2.5 px-2.5 py-2 mb-1">
            <div className="w-7 h-7 rounded-md bg-sidebar-accent flex items-center justify-center text-[11px] font-bold text-sidebar-foreground">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user.name}</p>
              <p className="text-[10px] text-sidebar-muted truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b bg-card flex items-center px-4 gap-3 sticky top-0 z-30">
          <button className="lg:hidden p-1.5 hover:bg-muted rounded-md" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-4 h-4 text-foreground" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary">
              {user.name.charAt(0)}
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
