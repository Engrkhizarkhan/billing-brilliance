import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatPKR } from '@/lib/formatters';
import { resolvePostingById } from '@/lib/etaFinance';
import { usePaymentStore } from '@/store/paymentStore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { listPayments } from '@/services/etaPaymentController';

const ETAReports = () => {
  const paymentVersion = usePaymentStore((state) => state.version);

  const paymentRecords = useMemo(() => listPayments(), [paymentVersion]);

  const monthlyCollections = useMemo(() => {
    const byMonth = new Map<string, number>();

    paymentRecords
      .filter((payment) => payment.status === 'paid')
      .forEach((payment) => {
        const monthKey = (payment.paidAt || payment.createdAt).slice(0, 7);
        byMonth.set(monthKey, (byMonth.get(monthKey) || 0) + payment.amount);
      });

    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monthKey, collected]) => {
        const [year, monthNum] = monthKey.split('-').map(Number);
        return {
          month: new Date(year, monthNum - 1, 1).toLocaleDateString('en-US', { month: 'short' }),
          collected,
        };
      });
  }, [paymentRecords]);

  const postingRevenue = useMemo(() => {
    const postingMap = new Map<string, { posting: string; totalRequests: number; paidRequests: number; collected: number }>();

    paymentRecords.forEach((payment) => {
      const posting = resolvePostingById(payment.postingId);
      const key = posting.id;
      const current = postingMap.get(key) || {
        posting: posting.title,
        totalRequests: 0,
        paidRequests: 0,
        collected: 0,
      };

      current.totalRequests += 1;
      if (payment.status === 'paid') {
        current.paidRequests += 1;
        current.collected += payment.amount;
      }

      postingMap.set(key, current);
    });

    return Array.from(postingMap.values()).sort((a, b) => b.collected - a.collected);
  }, [paymentRecords]);

  const totalCollected = postingRevenue.reduce((sum, row) => sum + row.collected, 0);
  const paidRequests = paymentRecords.filter((payment) => payment.status === 'paid').length;
  const collectionRate = paymentRecords.length > 0 ? Math.round((paidRequests / paymentRecords.length) * 100) : 0;
  const verifiedTransactions = paymentRecords.filter((payment) => payment.status === 'paid' && payment.transactionId).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Reports</h1>
        <p className="page-description">ETA payment-processor analytics from temporary payment records.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="dashboard-card"><p className="stat-label">Total Collected</p><p className="text-xl font-bold">{formatPKR(totalCollected)}</p></div>
        <div className="dashboard-card"><p className="stat-label">Paid Requests</p><p className="text-xl font-bold">{paidRequests}</p></div>
        <div className="dashboard-card"><p className="stat-label">Collection Rate</p><p className="text-xl font-bold">{collectionRate}%</p></div>
        <div className="dashboard-card"><p className="stat-label">Verified Transactions</p><p className="text-xl font-bold">{verifiedTransactions}</p></div>
      </div>

      <div className="dashboard-card">
        <h3 className="font-semibold mb-4">Monthly Collections</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlyCollections}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
            <XAxis dataKey="month" fontSize={12} />
            <YAxis fontSize={12} tickFormatter={(value) => `${value / 1000}K`} />
            <Tooltip formatter={(value: number) => [formatPKR(value), 'Collected']} />
            <Bar dataKey="collected" fill="hsl(221, 83%, 53%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Posting</TableHead>
              <TableHead>Total Requests</TableHead>
              <TableHead>Paid Requests</TableHead>
              <TableHead>Collected</TableHead>
              <TableHead>Collection Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {postingRevenue.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">No posting revenue available yet.</TableCell>
              </TableRow>
            ) : (
              postingRevenue.map((row) => (
                <TableRow key={row.posting}>
                  <TableCell className="font-medium text-sm">{row.posting}</TableCell>
                  <TableCell className="font-mono text-sm">{row.totalRequests}</TableCell>
                  <TableCell className="font-mono text-sm">{row.paidRequests}</TableCell>
                  <TableCell className="font-mono text-sm">{formatPKR(row.collected)}</TableCell>
                  <TableCell className="font-mono text-sm">{row.totalRequests > 0 ? Math.round((row.paidRequests / row.totalRequests) * 100) : 0}%</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ETAReports;
