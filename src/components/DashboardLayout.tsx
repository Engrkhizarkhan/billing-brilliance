import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import { GlobalSearch } from '@/components/GlobalSearch';
import { NotificationCenter } from '@/components/NotificationCenter';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { useDarkMode } from '@/hooks/useDarkMode';
import {
  LayoutDashboard, Users, CreditCard, BarChart3, Building2,
  GraduationCap, BookOpen, Award, Receipt, Wallet, Briefcase, UserPlus,
  LogOut, Menu, X, DollarSign, ChevronRight, Settings, Sun, Moon,
  AlertTriangle, FileText, Shield, ClipboardList, Megaphone, Activity
} from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  badge?: string;
  group?: string;
}

const navItems: Record<UserRole, NavItem[]> = {
  admin: [
    { label: 'Dashboard', path: '/admin', icon: LayoutDashboard, group: 'Overview' },
    { label: 'Schools', path: '/admin/billers', icon: Building2, badge: '5', group: 'Management' },
    { label: 'Users', path: '/admin/users', icon: Users, group: 'Management' },
    { label: 'Transactions', path: '/admin/transactions', icon: CreditCard, badge: '20', group: 'Finance' },
    { label: 'Cash Flow', path: '/admin/cashflow', icon: DollarSign, group: 'Finance' },
    { label: 'Reports', path: '/admin/reports', icon: BarChart3, group: 'Analytics' },
    { label: 'Audit Trail', path: '/admin/audit', icon: ClipboardList, group: 'Analytics' },
    { label: 'API Health', path: '/admin/api-health', icon: Shield, group: 'System' },
  ],
  school: [
    { label: 'Dashboard', path: '/school', icon: LayoutDashboard, group: 'Overview' },
    { label: 'Students', path: '/school/students', icon: GraduationCap, badge: '50', group: 'Students' },
    { label: 'Fee Structure', path: '/school/fee-plans', icon: BookOpen, group: 'Finance' },
    { label: 'Fee Ledger', path: '/school/fee-ledger', icon: FileText, group: 'Finance' },
    { label: 'Billing', path: '/school/billing', icon: Receipt, group: 'Finance' },
    { label: 'Scholarships', path: '/school/scholarships', icon: Award, group: 'Students' },
    { label: 'Defaulters', path: '/school/defaulters', icon: AlertTriangle, group: 'Finance' },
    { label: 'Payment Programs', path: '/school/payment-programs', icon: CreditCard, group: 'Finance' },
    { label: 'Payments', path: '/school/payments', icon: Wallet, group: 'Finance' },
    { label: 'Real-Time Payments', path: '/school/realtime-payments', icon: Activity, group: 'Finance' },
    { label: 'Reports', path: '/school/reports', icon: BarChart3, group: 'Analytics' },
    { label: 'Login Activity', path: '/school/login-activity', icon: Shield, group: 'System' },
    { label: 'Settings', path: '/school/settings', icon: Settings, group: 'System' },
  ],
  eta: [
    { label: 'Dashboard', path: '/eta', icon: LayoutDashboard, group: 'Overview' },
    { label: 'Postings', path: '/eta/postings', icon: Megaphone, group: 'Management' },
    { label: 'Application References', path: '/eta/applicants', icon: UserPlus, badge: '15', group: 'Management' },
    { label: 'Payments', path: '/eta/payments', icon: Wallet, group: 'Finance' },
    { label: 'Real-Time Payments', path: '/eta/realtime-payments', icon: Activity, group: 'Finance' },
    { label: 'Reports', path: '/eta/reports', icon: BarChart3, group: 'Analytics' },
    { label: 'Settings', path: '/eta/settings', icon: Settings, group: 'System' },
  ],
};

const roleLabels: Record<UserRole, string> = {
  admin: 'Super Admin',
  school: 'School Portal',
  eta: 'ETEA Portal',
};

const DashboardLayout = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isDark, toggle: toggleDark } = useDarkMode();

  const handleLogout = () => { logout(); navigate('/login'); };
  const { showWarning, dismissWarning } = useSessionTimeout(handleLogout);

  if (!user) { navigate('/login'); return null; }

  const items = navItems[user.role];

  const isActive = (path: string) => {
    if (path === `/${user.role}`) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const currentPage = items.find((i) => isActive(i.path));

  // Group items
  const groups = items.reduce<Record<string, typeof items>>((acc, item) => {
    const g = item.group || 'Other';
    if (!acc[g]) acc[g] = [];
    acc[g].push(item);
    return acc;
  }, {});

  return (
    <div className="h-screen overflow-hidden flex bg-background">
      {/* Session timeout warning */}
      <Dialog open={showWarning} onOpenChange={() => {}}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Session Expiring</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Your session will expire in 5 minutes due to inactivity.</p>
          <div className="flex gap-2 mt-2">
            <Button onClick={dismissWarning} className="flex-1 rounded-xl">Stay Logged In</Button>
            <Button variant="outline" onClick={handleLogout} className="rounded-xl">Sign Out</Button>
          </div>
        </DialogContent>
      </Dialog>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 h-screen w-[260px] bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 px-5 flex items-center gap-3 border-b border-sidebar-border">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
            <Building2 className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-bold text-[15px] tracking-tight">FinBill</span>
            <p className="text-[10px] text-sidebar-muted leading-none mt-0.5">{roleLabels[user.role]}</p>
          </div>
          <button className="lg:hidden p-1.5 hover:bg-sidebar-accent rounded-lg" onClick={() => setSidebarOpen(false)}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="thin-scrollbar flex-1 py-2 px-3 overflow-y-auto">
          {Object.entries(groups).map(([group, groupItems]) => (
            <div key={group} className="mb-1">
              <p className="text-[10px] font-semibold text-sidebar-muted uppercase tracking-[0.1em] px-3 mb-1 mt-3 first:mt-1">{group}</p>
              {groupItems.map((item) => {
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                      active
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-primary/20'
                        : 'text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                    }`}
                  >
                    <item.icon className="w-[18px] h-[18px] shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge && !active && (
                      <span className="text-[10px] font-semibold bg-sidebar-accent px-1.5 py-0.5 rounded-md text-sidebar-muted">{item.badge}</span>
                    )}
                    {active && <ChevronRight className="w-3.5 h-3.5 opacity-70" />}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2.5 mb-1 rounded-lg bg-sidebar-accent/50">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sidebar-primary/80 to-sidebar-primary/40 flex items-center justify-center text-[12px] font-bold text-sidebar-primary-foreground">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold truncate">{user.name}</p>
              <p className="text-[10px] text-sidebar-muted truncate">{user.email}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
            <LogOut className="w-[18px] h-[18px]" />Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 h-screen flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 border-b bg-card flex items-center px-4 md:px-6 gap-3 sticky top-0 z-30 shadow-sm shadow-foreground/[0.02]">
          <button className="lg:hidden p-2 hover:bg-muted rounded-lg" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5 text-foreground" />
          </button>
          
          {/* Breadcrumb */}
          <div className="hidden sm:flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">{roleLabels[user.role]}</span>
            {currentPage && currentPage.path !== `/${user.role}` && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                <span className="font-medium text-foreground">{currentPage.label}</span>
              </>
            )}
          </div>

          <div className="flex-1" />

          <GlobalSearch />
          <NotificationCenter />
          <button onClick={toggleDark} className="p-2 hover:bg-muted rounded-lg transition-colors">
            {isDark ? <Sun className="w-[18px] h-[18px] text-muted-foreground" /> : <Moon className="w-[18px] h-[18px] text-muted-foreground" />}
          </button>
          <div className="w-px h-6 bg-border mx-1" />
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-[12px] font-bold text-primary-foreground shadow-sm">
            {user.name.charAt(0)}
          </div>
        </header>
        <main className="thin-scrollbar flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
