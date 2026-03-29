import { StatCard } from '@/components/StatCard';
import { Briefcase, UserPlus, Receipt, Wallet, Activity, Megaphone, Ticket, Trophy } from 'lucide-react';
import { services, applicants, eteaPostings, revenueData } from '@/data/mockData';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, FunnelChart } from 'recharts';
import { formatPKR } from '@/lib/formatters';
import { useNavigate } from 'react-router-dom';

const pipelineData = [
  { stage: 'Submitted', count: applicants.filter(a => a.applicationStatus === 'submitted').length },
  { stage: 'Fee Paid', count: applicants.filter(a => a.applicationStatus === 'fee_paid').length },
  { stage: 'Roll Assigned', count: applicants.filter(a => a.applicationStatus === 'roll_assigned').length },
  { stage: 'Appeared', count: applicants.filter(a => a.applicationStatus === 'appeared').length },
  { stage: 'Selected', count: applicants.filter(a => a.applicationStatus === 'selected').length },
];

const applicationsPerPosting = eteaPostings.map(p => ({ name: p.title.length > 15 ? p.title.slice(0, 15) + '…' : p.title, applications: p.applicationsReceived }));

const ETADashboard = () => {
  const navigate = useNavigate();
  const feeCollectedToday = 245000;
  const admitCardsIssued = applicants.filter(a => a.rollNumber).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">ETEA Dashboard</h1>
          <p className="page-description">Manage entry tests, job postings, and applicants</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="w-3.5 h-3.5 text-success" />
          <span>System online</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="cursor-pointer" onClick={() => navigate('/eta/postings')}><StatCard title="Active Postings" value={eteaPostings.filter(p => p.status === 'active').length} icon={Megaphone} /></div>
        <div className="cursor-pointer" onClick={() => navigate('/eta/applicants')}><StatCard title="Total Applicants" value={applicants.length} icon={UserPlus} trend="3 new today" trendUp /></div>
        <StatCard title="Fee Collected Today" value={formatPKR(feeCollectedToday)} icon={Wallet} trend="12% vs yesterday" trendUp />
        <StatCard title="Pending Payments" value={applicants.filter(a => a.paymentStatus === 'pending').length} icon={Receipt} />
        <StatCard title="Admit Cards Issued" value={admitCardsIssued} icon={Ticket} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="dashboard-card">
          <h3 className="section-title mb-4">Applications per Posting</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={applicationsPerPosting} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis type="number" fontSize={11} tick={{ fill: 'hsl(220, 9%, 46%)' }} />
              <YAxis dataKey="name" type="category" fontSize={11} width={120} tick={{ fill: 'hsl(220, 9%, 46%)' }} />
              <Tooltip contentStyle={{ borderRadius: '10px', fontSize: '12px', border: '1px solid hsl(220, 13%, 91%)' }} />
              <Bar dataKey="applications" fill="hsl(221, 83%, 53%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="dashboard-card">
          <h3 className="section-title mb-4">Applicant Pipeline</h3>
          <div className="space-y-3 mt-2">
            {pipelineData.map((stage, i) => {
              const maxCount = Math.max(...pipelineData.map(s => s.count), 1);
              const pct = (stage.count / maxCount) * 100;
              const colors = ['bg-muted-foreground', 'bg-warning', 'bg-primary', 'bg-info', 'bg-success'];
              return (
                <div key={stage.stage} className="flex items-center gap-3">
                  <span className="text-xs font-medium w-24 text-right text-muted-foreground">{stage.stage}</span>
                  <div className="flex-1 h-8 bg-muted/50 rounded-lg overflow-hidden">
                    <div className={`h-full ${colors[i]} rounded-lg flex items-center px-3 transition-all`} style={{ width: `${Math.max(pct, 10)}%` }}>
                      <span className="text-xs font-bold text-white">{stage.count}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="dashboard-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title">Collection Trend</h3>
          <span className="metric-change-up">↑ 8%</span>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={revenueData}>
            <defs>
              <linearGradient id="etaRevGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.15} />
                <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
            <XAxis dataKey="month" fontSize={11} tick={{ fill: 'hsl(220, 9%, 46%)' }} />
            <YAxis fontSize={11} tickFormatter={(v) => `${v / 1000}K`} tick={{ fill: 'hsl(220, 9%, 46%)' }} />
            <Tooltip formatter={(v: number) => [formatPKR(v), 'Collected']} contentStyle={{ borderRadius: '10px', fontSize: '12px', border: '1px solid hsl(220, 13%, 91%)' }} />
            <Area type="monotone" dataKey="revenue" stroke="hsl(221, 83%, 53%)" fill="url(#etaRevGrad)" strokeWidth={2.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ETADashboard;
