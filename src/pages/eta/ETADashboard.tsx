import { StatCard } from '@/components/StatCard';
import { Briefcase, UserPlus, Receipt, Wallet } from 'lucide-react';
import { services, applicants } from '@/data/mockData';

const ETADashboard = () => (
  <div className="space-y-6 animate-fade-in">
    <div>
      <h1 className="page-header">ETA / Agency Dashboard</h1>
      <p className="page-description">Manage services and applicants</p>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard title="Active Services" value={services.filter(s => s.status === 'active').length} icon={Briefcase} />
      <StatCard title="Total Applicants" value={applicants.length} icon={UserPlus} />
      <StatCard title="Pending Invoices" value="12" icon={Receipt} />
      <StatCard title="Collections" value="₨ 2.1M" icon={Wallet} trend="8% vs last month" trendUp />
    </div>
  </div>
);

export default ETADashboard;
