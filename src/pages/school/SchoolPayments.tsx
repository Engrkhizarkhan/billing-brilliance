import { transactions } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const SchoolPayments = () => (
  <div className="space-y-6 animate-fade-in">
    <div>
      <h1 className="page-header">Payments</h1>
      <p className="page-description">Payment history</p>
    </div>
    <div className="table-container">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Transaction ID</TableHead>
            <TableHead>Consumer Number</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.slice(0, 10).map((t) => (
            <TableRow key={t.id}>
              <TableCell className="font-mono text-sm">{t.transactionId}</TableCell>
              <TableCell className="font-mono text-xs">{t.consumerNumber}</TableCell>
              <TableCell>₨ {t.amount.toLocaleString()}</TableCell>
              <TableCell><StatusBadge status={t.status} /></TableCell>
              <TableCell>{t.date}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </div>
);

export default SchoolPayments;
