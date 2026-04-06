import { useMemo, useState } from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterBar } from '@/components/FilterBar';
import { TablePagination } from '@/components/TablePagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatPKR } from '@/lib/formatters';
import { usePaymentStore } from '@/store/paymentStore';
import { listPayments } from '@/services/eteaPaymentController';

const mapPaymentToInvoiceStatus = (status: 'pending' | 'paid' | 'failed' | 'expired'): 'paid' | 'pending' | 'overdue' => {
  if (status === 'paid') return 'paid';
  if (status === 'pending') return 'pending';
  return 'overdue';
};

const ETEAInvoices = () => {
  const paymentVersion = usePaymentStore((state) => state.version);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const invoiceRows = useMemo(
    () => listPayments().map((payment) => ({
      id: payment.id,
      invoiceNumber: payment.billId,
      applicationId: payment.applicationId,
      applicantId: payment.applicantId,
      postingId: payment.postingId,
      amount: payment.amount,
      status: mapPaymentToInvoiceStatus(payment.status),
      dueDate: payment.dueDate,
    })),
    [paymentVersion]
  );

  const filteredRows = invoiceRows.filter((row) => {
    const query = search.toLowerCase();
    const matchSearch =
      row.invoiceNumber.toLowerCase().includes(query) ||
      row.applicationId.toLowerCase().includes(query) ||
      row.applicantId.toLowerCase().includes(query) ||
      row.postingId.toLowerCase().includes(query);
    const matchStatus = statusFilter === 'all' || row.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const paginatedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Invoices</h1>
        <p className="page-description">ETEA payment invoices generated from temporary payment records.</p>
      </div>

      <FilterBar
        searchPlaceholder="Search by bill_id, application_id, applicant_id, or posting_id..."
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: [
              { value: 'paid', label: 'Paid' },
              { value: 'pending', label: 'Pending' },
              { value: 'overdue', label: 'Overdue' },
            ],
          },
        ]}
        onFilterChange={(_, value) => {
          setStatusFilter(value);
          setPage(1);
        }}
      />

      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>bill_id</TableHead>
              <TableHead>application_id</TableHead>
              <TableHead>applicant_id</TableHead>
              <TableHead>posting_id</TableHead>
              <TableHead>amount</TableHead>
              <TableHead>status</TableHead>
              <TableHead>due_date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                  No ETEA invoices match your filters.
                </TableCell>
              </TableRow>
            ) : (
              paginatedRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.invoiceNumber}</TableCell>
                  <TableCell className="font-mono text-xs">{row.applicationId}</TableCell>
                  <TableCell className="font-mono text-xs">{row.applicantId}</TableCell>
                  <TableCell className="font-mono text-xs">{row.postingId}</TableCell>
                  <TableCell className="font-mono text-sm">{formatPKR(row.amount)}</TableCell>
                  <TableCell><StatusBadge status={row.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.dueDate}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <TablePagination
          total={filteredRows.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
};

export default ETEAInvoices;
