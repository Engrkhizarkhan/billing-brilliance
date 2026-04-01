import { useMemo, useState } from 'react';
import { getSchoolPaymentHistory, students } from '@/data/mockData';
import { billInquiry, billPayment, onebillConfig } from '@/services/onebillService';
import { reconcileBillPayment } from '@/services/paymentReconciliation';
import { usePaymentStore } from '@/store/paymentStore';
import { FilterBar } from '@/components/FilterBar';
import { TablePagination } from '@/components/TablePagination';
import { EmptyState } from '@/components/EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FeeSlip } from '@/components/FeeSlip';
import { CreditCard, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { formatPKR } from '@/lib/formatters';
import type { BillInquiryResponse, PaymentChannel } from '@/types';

const monthLabelFromKey = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const SchoolPayments = () => {
  const paymentVersion = usePaymentStore((state) => state.version);

  const [inquiryForm, setInquiryForm] = useState({
    consumerNumber: students[0]?.consumerNumber || '',
    studentRef: '',
    voucherNumber: '',
  });
  const [inquiryResult, setInquiryResult] = useState<BillInquiryResponse | null>(null);
  const [channel, setChannel] = useState('bank_app');
  const [paymentNote, setPaymentNote] = useState('');
  const [inquiryLoading, setInquiryLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const paymentHistory = useMemo(() => getSchoolPaymentHistory(), [paymentVersion]);

  const classOptions = useMemo(
    () => Array.from(new Set(students.map((student) => student.class))).sort((a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, ''))),
    []
  );

  const sectionOptions = useMemo(() => {
    const pool = classFilter === 'all' ? students : students.filter((student) => student.class === classFilter);
    return Array.from(new Set(pool.map((student) => student.section))).sort((a, b) => a.localeCompare(b));
  }, [classFilter]);

  const monthOptions = useMemo(
    () => Array.from(new Set(paymentHistory.map((record) => record.date.slice(0, 7)))).sort((a, b) => b.localeCompare(a)),
    [paymentHistory]
  );

  const runInquiry = async () => {
    setInquiryLoading(true);
    try {
      const result = await billInquiry({
        consumerNumber: inquiryForm.consumerNumber,
        studentRef: inquiryForm.studentRef || undefined,
        voucherNumber: inquiryForm.voucherNumber || undefined,
      });
      setInquiryResult(result);
      if (!result.found) {
        toast.error(result.message || 'Bill not found');
      } else {
        toast.success('Bill found and ready');
      }
    } catch (error) {
      console.error(error);
      toast.error('Inquiry failed');
    } finally {
      setInquiryLoading(false);
    }
  };

  const runPayment = async () => {
    if (!inquiryResult || !inquiryResult.found || !inquiryResult.consumerNumber) {
      toast.error('Run Bill Inquiry first');
      return;
    }
    if (inquiryResult.status === 'paid') {
      toast.message('Already paid');
      return;
    }
    const amount = inquiryResult.amount || 0;
    setPaymentLoading(true);
    try {
      const paidAt = new Date().toISOString();
      const transactionId = `TXN-${Date.now()}`;
      const result = await billPayment({
        consumerNumber: inquiryResult.consumerNumber,
        amount,
        transactionId,
        paidAt,
        channel: channel as PaymentChannel,
        voucherNumber: inquiryResult.invoiceNumber,
        notes: paymentNote,
      });
      reconcileBillPayment(result);
      toast.success('Payment marked paid');
    } catch (error) {
      console.error(error);
      toast.error('Payment failed');
    } finally {
      setPaymentLoading(false);
    }
  };

  const filtered = paymentHistory.filter((payment) => {
    const query = search.toLowerCase();
    const matchesSearch =
      payment.studentName.toLowerCase().includes(query) ||
      payment.rollNumber.toLowerCase().includes(query) ||
      payment.consumerNumber.includes(search) ||
      payment.reference.toLowerCase().includes(query) ||
      payment.billId.toLowerCase().includes(query) ||
      payment.date.includes(search);

    const matchesClass = classFilter === 'all' || payment.className === classFilter;
    const matchesSection = sectionFilter === 'all' || payment.section === sectionFilter;
    const matchesMonth = monthFilter === 'all' || payment.date.slice(0, 7) === monthFilter;

    return matchesSearch && matchesClass && matchesSection && matchesMonth;
  });

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-1">
        <h1 className="page-header">Payments</h1>
        <p className="page-description">BillInquiry → Fee Slip (QR) → BillPayment. Source: {onebillConfig.useMock ? 'Mock 1BILL sandbox' : onebillConfig.baseUrl}</p>
      </div>

      <div className="space-y-4">
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Bill Inquiry</p>
                <p className="text-xs text-muted-foreground">Consumer #, student ref, or voucher number</p>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><Activity className="w-4 h-4" /> {onebillConfig.useMock ? 'Mock mode' : 'Live mode'}</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Consumer Number</p>
                <Input value={inquiryForm.consumerNumber} onChange={(e) => setInquiryForm({ ...inquiryForm, consumerNumber: e.target.value })} placeholder="1234561001..." className="rounded-lg" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Student Ref (optional)</p>
                <Input value={inquiryForm.studentRef} onChange={(e) => setInquiryForm({ ...inquiryForm, studentRef: e.target.value })} placeholder="Student ID" className="rounded-lg" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Voucher # (optional)</p>
                <Input value={inquiryForm.voucherNumber} onChange={(e) => setInquiryForm({ ...inquiryForm, voucherNumber: e.target.value })} placeholder="Invoice #" className="rounded-lg" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={runInquiry} disabled={inquiryLoading} className="rounded-lg">{inquiryLoading ? 'Checking…' : 'Run BillInquiry'}</Button>
              <Button variant="outline" onClick={runPayment} disabled={paymentLoading || !inquiryResult?.found} className="rounded-lg">{paymentLoading ? 'Posting…' : 'Mark Paid via 1BILL'}</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Channel</p>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_app">Bank App</SelectItem>
                    <SelectItem value="jazzcash">JazzCash</SelectItem>
                    <SelectItem value="easypaisa">Easypaisa</SelectItem>
                    <SelectItem value="atm">ATM</SelectItem>
                    <SelectItem value="counter">Bank Counter</SelectItem>
                    <SelectItem value="cash_offline">Cash / Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Payment Note</p>
                <Input value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="Receipt note for audit trail" className="rounded-lg" />
              </div>
            </div>
            {inquiryResult && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm grid grid-cols-2 md:grid-cols-4 gap-2">
                <div><p className="text-[11px] text-muted-foreground">Status</p><p className="font-semibold capitalize">{inquiryResult.status}</p></div>
                <div><p className="text-[11px] text-muted-foreground">Amount</p><p className="font-semibold">{formatPKR(inquiryResult.amount || 0)}</p></div>
                <div><p className="text-[11px] text-muted-foreground">Due Date</p><p className="font-medium">{inquiryResult.dueDate || '-'}</p></div>
                <div><p className="text-[11px] text-muted-foreground">Invoice</p><p className="font-mono text-xs">{inquiryResult.invoiceNumber || '-'}</p></div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          {inquiryResult?.found && (
            <FeeSlip
              studentName={inquiryResult.studentName || '—'}
              fatherName=""
              className={inquiryResult.className}
              section={inquiryResult.section}
              consumerNumber={inquiryResult.consumerNumber || inquiryForm.consumerNumber}
              billId={inquiryResult.billId}
              amount={inquiryResult.amount || 0}
              dueDate={inquiryResult.dueDate || '-'}
              status={inquiryResult.status || 'unpaid'}
              invoiceNumber={inquiryResult.invoiceNumber}
              qrPayload={JSON.stringify({
                consumerNumber: inquiryResult.consumerNumber || inquiryForm.consumerNumber,
                amount: inquiryResult.amount || 0,
                dueDate: inquiryResult.dueDate,
                invoice: inquiryResult.invoiceNumber,
              })}
            />
          )}
        </div>
      </div>

      <FilterBar
        searchPlaceholder="Search by student, roll #, consumer #, bill ID, txn ref, or date..."
        onSearch={(value) => { setSearch(value); setPage(1); }}
        filters={[
          {
            key: 'class',
            label: 'Class',
            options: classOptions.map((className) => ({ value: className, label: className })),
          },
          {
            key: 'section',
            label: 'Section',
            options: sectionOptions.map((section) => ({ value: section, label: section })),
          },
          {
            key: 'month',
            label: 'Month',
            options: monthOptions.map((monthKey) => ({ value: monthKey, label: monthLabelFromKey(monthKey) })),
          },
        ]}
        onFilterChange={(key, value) => {
          if (key === 'class') {
            setClassFilter(value);
            setSectionFilter('all');
          }
          if (key === 'section') setSectionFilter(value);
          if (key === 'month') setMonthFilter(value);
          setPage(1);
        }}
      />

      <div className="table-container">
        {paginated.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No payments found"
            description="No completed student payments match your current search or filter criteria."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Roll #</TableHead>
                <TableHead>Consumer #</TableHead>
                <TableHead>Bill ID</TableHead>
                <TableHead>Txn Ref</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((payment) => (
                <TableRow key={payment.id} className="hover:bg-muted/30">
                  <TableCell className="text-sm text-muted-foreground">{payment.date}</TableCell>
                  <TableCell className="font-medium text-sm">{payment.studentName}</TableCell>
                  <TableCell><span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-md">{payment.className} {payment.section}</span></TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{payment.rollNumber}</TableCell>
                  <TableCell className="font-mono text-xs">{payment.consumerNumber}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{payment.billId}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{payment.reference}</TableCell>
                  <TableCell className="font-mono text-sm font-semibold text-success">{formatPKR(payment.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <TablePagination
          total={filtered.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
};

export default SchoolPayments;
