import { invoices } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const ETAInvoices = () => (
  <div className="space-y-6 animate-fade-in">
    <div>
      <h1 className="page-header">Invoices</h1>
      <p className="page-description">Service invoices</p>
    </div>
    <div className="table-container">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice #</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Due Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.slice(0, 10).map((inv) => (
            <TableRow key={inv.id}>
              <TableCell className="font-mono">{inv.invoiceNumber}</TableCell>
              <TableCell className="font-medium">{inv.studentName}</TableCell>
              <TableCell>₨ {inv.amount.toLocaleString()}</TableCell>
              <TableCell><StatusBadge status={inv.status} /></TableCell>
              <TableCell>{inv.dueDate}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </div>
);

export default ETAInvoices;
