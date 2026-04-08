import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { usePaymentStore } from '@/store/paymentStore';
import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

type BillerRecord = { id: string; type: 'school' | 'etea' | 'private_agency'; name: string };
type TransactionRecord = { tenantId?: string | null; amount: number; status: 'completed' | 'pending' | 'failed' | string; date: string };

const COLORS = ['hsl(221, 83%, 53%)', 'hsl(160, 84%, 39%)', 'hsl(38, 92%, 50%)'];

const toMonthKey = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const toMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short' });
};

const Reports = () => {
  const paymentVersion = usePaymentStore((state) => state.version);
  const { data: txnData, loading: loadingTransactions } = useApiQuery(() => api.fetchTransactions({ pageSize: 5000 }), [paymentVersion]);
  const { data: billersData, loading: loadingBillers } = useApiQuery(() => api.fetchBillers({ pageSize: 100 }), []);

  const transactions = (txnData || []) as TransactionRecord[];
  const billers = (billersData || []) as BillerRecord[];

  const revenueData = useMemo(() => {
    const byMonth = new Map<string, number>();
    transactions
      .filter((t) => t.status === 'completed')
      .forEach((t) => {
        const key = toMonthKey(t.date);
        if (!key) return;
        byMonth.set(key, (byMonth.get(key) || 0) + Number(t.amount || 0));
      });

    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, revenue]) => ({ month: toMonthLabel(month), revenue }));
  }, [transactions]);

  const pieData = useMemo(() => {
    const tenantTypeById = new Map(billers.map((b) => [b.id, b.type] as const));
    const totals = {
      school: 0,
      etea: 0,
      private_agency: 0,
    };

    transactions
      .filter((t) => t.status === 'completed')
      .forEach((t) => {
        const tenantType = t.tenantId ? tenantTypeById.get(t.tenantId) : undefined;
        if (tenantType === 'school') totals.school += Number(t.amount || 0);
        else if (tenantType === 'etea') totals.etea += Number(t.amount || 0);
        else totals.private_agency += Number(t.amount || 0);
      });

    return [
      { name: 'Schools', value: totals.school },
      { name: 'ETEA', value: totals.etea },
      { name: 'Agencies', value: totals.private_agency },
    ];
  }, [transactions, billers]);

  if (loadingTransactions || loadingBillers) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-sm text-muted-foreground">Loading reports...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Reports</h1>
        <p className="page-description">Analytics and reports</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="dashboard-card">
          <h3 className="font-semibold mb-4">Revenue by Month</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={(v) => `${v / 1000}K`} />
              <Tooltip formatter={(v: number) => [`₨ ${v.toLocaleString()}`, 'Revenue']} />
              <Bar dataKey="revenue" fill="hsl(221, 83%, 53%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="dashboard-card">
          <h3 className="font-semibold mb-4">Revenue by Biller Type</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${Number.isFinite(percent) ? (percent * 100).toFixed(0) : '0'}%`}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => `₨ ${v.toLocaleString()}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Reports;
