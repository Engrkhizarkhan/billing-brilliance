import { StatCard } from '@/components/StatCard';
import { DollarSign, TrendingUp, CreditCard, AlertTriangle } from 'lucide-react';

const CashFlow = () => (
  <div className="space-y-6 animate-fade-in">
    <div>
      <h1 className="page-header">Cash Flow</h1>
      <p className="page-description">Financial overview</p>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard title="Revenue Today" value="₨ 125,000" icon={DollarSign} trend="15% vs yesterday" trendUp />
      <StatCard title="Revenue This Month" value="₨ 1,250,000" icon={TrendingUp} trend="12% vs last month" trendUp />
      <StatCard title="Total Payments" value="₨ 7,900,000" icon={CreditCard} />
      <StatCard title="Overdue Payments" value="₨ 450,000" icon={AlertTriangle} trend="3% increase" trendUp={false} />
    </div>
  </div>
);

export default CashFlow;
