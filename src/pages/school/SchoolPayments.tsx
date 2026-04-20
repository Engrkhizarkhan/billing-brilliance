import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { usePaymentStore } from '@/store/paymentStore';
import type { Student } from '@/types';
import { FilterBar } from '@/components/FilterBar';
import { TablePagination } from '@/components/TablePagination';
import { EmptyState } from '@/components/EmptyState';
import { ExportButton } from '@/components/ExportButton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard } from 'lucide-react';
import { formatPKR } from '@/lib/formatters';

const CHANNELS: Record<string, string> = {
  bank_app: 'Bank App',
  jazzcash: 'JazzCash',
  easypaisa: 'Easypaisa',
  atm: 'ATM',
  counter: 'Bank Counter',
  cash_offline: 'Cash / Offline',
};

const monthLabelFromKey = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

type PaymentRecord = {
  id: string;
  studentName: string;
  rollNumber: string;
  consumerNumber: string;
  billId: string;
  amount: number;
  date: string;
  reference: string;
  receiptNumber: string;
  note: string;
  className: string;
  section: string;
  channel: string;
  voucherNumber: string;
};

const SchoolPayments = () => {
  const paymentVersion = usePaymentStore((state) => state.version);

  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: studentsData } = useApiQuery(() => api.fetchStudents({ pageSize: 9999 }), []);
  const students = useMemo(() => (studentsData || []) as Student[], [studentsData]);

  const { data: historyRaw, meta: historyMeta } = useApiQuery(
    () => api.fetchPaymentHistory({
      page,
      pageSize,
      search: search || undefined,
      className: classFilter !== 'all' ? classFilter : undefined,
      channel: channelFilter !== 'all' ? channelFilter : undefined,
      month: monthFilter !== 'all' ? monthFilter : undefined,
    }),
    [paymentVersion, page, pageSize, search, classFilter, channelFilter, monthFilter]
  );

  const payments = useMemo(() => (historyRaw || []) as PaymentRecord[], [historyRaw]);
  const total = historyMeta?.total ?? 0;

  const classOptions = useMemo(
    () => Array.from(new Set(students.map((s) => s.class))).sort((a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, ''))),
    [students]
  );

  const monthOptions = useMemo(
    () => Array.from(new Set(payments.map((p) => p.date?.slice(0, 7)).filter(Boolean))).sort((a, b) => b.localeCompare(a)),
    [payments]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Payment History</h1>
          <p className="page-description">All completed student payments recorded in the system.</p>
        </div>
        <ExportButton
          data={payments.map((p) => ({
            Date: p.date,
            Student: p.studentName,
            Class: `${p.className} ${p.section}`,
            'Roll #': p.rollNumber,
            'Consumer #': p.consumerNumber,
            'Bill ID': p.billId,
            Amount: p.amount,
            Channel: CHANNELS[p.channel] || p.channel || '---',
            'Receipt #': p.receiptNumber || '---',
            'Txn Ref': p.reference || '---',
            Note: p.note || '',
          }))}
          filename={`payment-history-${new Date().toISOString().slice(0, 10)}`}
        />
      </div>

      <FilterBar
        searchPlaceholder="Search by student, consumer #, receipt #, or reference..."
        onSearch={(value) => { setSearch(value); setPage(1); }}
        filters={[
          { key: 'class', label: 'Class', options: classOptions.map((c) => ({ value: c, label: c })) },
          { key: 'channel', label: 'Channel', options: Object.entries(CHANNELS).map(([value, label]) => ({ value, label })) },
          { key: 'month', label: 'Month', options: monthOptions.map((m) => ({ value: m, label: monthLabelFromKey(m) })) },
        ]}
        onFilterChange={(key, value) => {
          if (key === 'class') setClassFilter(value);
          if (key === 'channel') setChannelFilter(value);
          if (key === 'month') setMonthFilter(value);
          setPage(1);
        }}
      />

      <div className="table-container">
        {payments.length === 0 ? (
          <EmptyState icon={CreditCard} title="No payments found" description="No completed student payments match your current search or filter criteria." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold">Date</TableHead>
                <TableHead className="text-xs font-semibold">Student</TableHead>
                <TableHead className="text-xs font-semibold">Class</TableHead>
                <TableHead className="text-xs font-semibold">Consumer #</TableHead>
                <TableHead className="text-xs font-semibold">Channel</TableHead>
                <TableHead className="text-xs font-semibold">Receipt #</TableHead>
                <TableHead className="text-xs font-semibold">Txn Ref</TableHead>
                <TableHead className="text-xs font-semibold text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id} className="hover:bg-muted/30">
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{p.date}</TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{p.studentName || '---'}</p>
                    <p className="text-[11px] text-muted-foreground">Roll {p.rollNumber || '---'}</p>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-md whitespace-nowrap">
                      {[p.className, p.section].filter(Boolean).join(' ') || '---'}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{p.consumerNumber || '---'}</TableCell>
                  <TableCell>
                    <span className="text-xs font-medium bg-muted px-2 py-0.5 rounded-md">
                      {CHANNELS[p.channel] || p.channel || '---'}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{p.receiptNumber || '---'}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{p.reference || '---'}</TableCell>
                  <TableCell className="font-mono text-sm font-semibold text-success text-right">{formatPKR(p.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <TablePagination
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>
    </div>
  );
};

export default SchoolPayments;
