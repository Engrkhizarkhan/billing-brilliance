import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { LedgerEntry, Student, StudentFinancialSnapshot } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { ExportButton } from '@/components/ExportButton';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { formatPKR } from '@/lib/formatters';
import { FileText, AlertTriangle, CheckCircle2, BusFront, School, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePaymentStore } from '@/store/paymentStore';

const monthKeyFromDate = (date: string) => date.slice(0, 7);

const monthLabelFromKey = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const isTuitionEntry = (entry: LedgerEntry) => entry.feeHeadId === 'fh1' || /tuition/i.test(entry.description);
const isBusEntry = (entry: LedgerEntry) => entry.feeHeadId === 'fh2' || /transport|bus/i.test(entry.description);

const grossTuitionForEntry = (entry: LedgerEntry) => Number(entry.grossTuition ?? (isTuitionEntry(entry) ? entry.debit : 0));
const scholarshipDiscountForEntry = (entry: LedgerEntry) => Number(entry.scholarshipDiscount ?? 0);
const netTuitionForEntry = (entry: LedgerEntry) => Number(entry.netTuition ?? (isTuitionEntry(entry) ? entry.debit : 0));
const currentMonthKey = () => new Date().toISOString().slice(0, 7);

const feeHeadLabel = (entry: LedgerEntry) => {
  if (entry.credit > 0) return 'Payment';
  if (isTuitionEntry(entry)) return 'Tuition';
  if (isBusEntry(entry)) return 'Bus Fee';
  if (/fine/i.test(entry.description)) return 'Fine';
  return 'Other';
};

const FeeLedger = () => {
  const [searchParams] = useSearchParams();
  const defaultStudent = searchParams.get('student') || '';
  const [selectedStudent, setSelectedStudent] = useState(defaultStudent);
  const [ledgerVersion, setLedgerVersion] = useState(0);
  const [busDialogOpen, setBusDialogOpen] = useState(false);
  const [busForm, setBusForm] = useState({
    enabled: false,
    monthlyFee: '1500',
  });
  const [studentQuery, setStudentQuery] = useState('');
  const [showStudentResults, setShowStudentResults] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudentObj, setSelectedStudentObj] = useState<Student | null>(null);
  const paymentVersion = usePaymentStore((state) => state.version);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load student from URL param on mount (single fetch)
  useEffect(() => {
    if (!defaultStudent) return;
    void api.getStudent(defaultStudent).then((res) => {
      const s = res?.data;
      if (s) {
        setSelectedStudentObj(s);
        setStudentQuery(`${s.name} — ${s.class} ${s.section} (${s.rollNumber})`);
      }
    });
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await api.fetchStudents({ search: q.trim(), pageSize: 15 });
      setSearchResults((res?.data || []) as Student[]);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleQueryChange = (value: string) => {
    setStudentQuery(value);
    setShowStudentResults(true);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => void doSearch(value), 300);
  };

  useEffect(() => () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); }, []);

  const { data: ledgerData } = useApiQuery(
    () => selectedStudent ? api.getStudentLedger(selectedStudent) : Promise.resolve({ data: [] }),
    [selectedStudent, ledgerVersion, paymentVersion]
  );
  const ledger = (ledgerData || []) as LedgerEntry[];

  const { data: financialSnapshot } = useApiQuery(
    () => selectedStudent ? api.getStudentSnapshot(selectedStudent) : Promise.resolve({ data: null as unknown as StudentFinancialSnapshot }),
    [selectedStudent, ledgerVersion, paymentVersion]
  );

  const { data: scholarshipsData } = useApiQuery(
    () => selectedStudent ? api.fetchStudentScholarships(selectedStudent) : Promise.resolve({ data: [] }),
    [selectedStudent, ledgerVersion]
  );
  const activeScholarships = (scholarshipsData || []) as Array<{ name: string }>;

  const student = selectedStudentObj;

  useEffect(() => {
    if (!student) return;
    setBusForm({
      enabled: student.usesBusService,
      monthlyFee: String(student.busMonthlyFee > 0 ? student.busMonthlyFee : 1500),
    });
  }, [student]);

  const studentMatches = searchResults;

  const monthOptions = useMemo(() => Array.from(new Set(ledger.map((e) => monthKeyFromDate(e.date)))), [ledger]);

  const filteredLedger = useMemo(
    () => selectedMonth === 'all' ? ledger : ledger.filter((entry) => monthKeyFromDate(entry.date) === selectedMonth),
    [ledger, selectedMonth]
  );

  const totalDebit = filteredLedger.reduce((sum, e) => sum + Number(e.debit), 0);
  const totalCredit = filteredLedger.reduce((sum, e) => sum + Number(e.credit), 0);
  const grossTuitionTotal = filteredLedger.reduce((sum, e) => sum + grossTuitionForEntry(e), 0);
  const scholarshipDiscountTotal = filteredLedger.reduce((sum, e) => sum + scholarshipDiscountForEntry(e), 0);
  const netTuitionTotal = filteredLedger.reduce((sum, e) => sum + netTuitionForEntry(e), 0);
  const busTotal = filteredLedger.reduce((sum, e) => sum + (isBusEntry(e) ? Number(e.debit) : 0), 0);
  const outstandingAllMonths = financialSnapshot?.totalDue || 0;
  const overdueMonths = financialSnapshot?.overdueMonths || 0;

  const selectStudent = (s: Student) => {
    setSelectedStudent(s.id);
    setSelectedStudentObj(s);
    setStudentQuery(`${s.name} — ${s.class} ${s.section} (${s.rollNumber})`);
    setSelectedMonth('all');
    setShowStudentResults(false);
    setSearchResults([]);
  };

  const saveBusService = async () => {
    if (!student) return;

    const monthlyFee = Number(busForm.monthlyFee);
    if (!Number.isFinite(monthlyFee) || monthlyFee <= 0) {
      toast.error('Please enter a valid bus monthly fee');
      return;
    }

    try {
      if (busForm.enabled) {
        const startMonth = student.busServiceStartMonth || currentMonthKey();
        await api.updateStudentBusService(student.id, {
          usesBusService: true,
          busServiceStartMonth: startMonth,
          busServiceEndMonth: null,
          busMonthlyFee: Math.round(monthlyFee),
        });
        setLedgerVersion((prev) => prev + 1);
        setBusDialogOpen(false);
        toast.success('Bus service enabled');
        return;
      }

      await api.updateStudentBusService(student.id, {
        usesBusService: false,
        busServiceStartMonth: student.busServiceStartMonth || null,
        busServiceEndMonth: currentMonthKey(),
        busMonthlyFee: student.busMonthlyFee > 0 ? student.busMonthlyFee : Math.round(monthlyFee),
      });
      setLedgerVersion((prev) => prev + 1);
      setBusDialogOpen(false);
      toast.success('Bus service disabled');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update bus service');
    }
  };

  if (false) {
    return null; // studentsLoading guard removed — search is on-demand
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Student Fee Ledger</h1>
          <p className="page-description">Running balance with clear fee breakdown: gross tuition, scholarship discount, net tuition, and bus fees</p>
        </div>
        <div className="flex gap-2 items-center">
          <Dialog open={busDialogOpen} onOpenChange={setBusDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-lg">Update Bus Service</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Bus Service for Existing Student</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 rounded-lg border border-border p-3">
                  <Checkbox
                    id="bus-active-toggle"
                    checked={busForm.enabled}
                    onCheckedChange={(checked) => setBusForm({ ...busForm, enabled: checked === true })}
                  />
                  <Label htmlFor="bus-active-toggle" className="text-sm">Student currently uses bus service</Label>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Monthly Fee (Rs)</Label>
                  <Input
                    type="number"
                    min={0}
                    className="h-10 rounded-xl"
                    value={busForm.monthlyFee}
                    onChange={(e) => setBusForm({ ...busForm, monthlyFee: e.target.value })}
                  />
                  {!busForm.enabled && (
                    <p className="text-xs text-muted-foreground">Disabling stops bus charges after the current month.</p>
                  )}
                </div>

                <Button onClick={saveBusService} className="w-full">Save Bus Service Settings</Button>
              </div>
            </DialogContent>
          </Dialog>
          <ExportButton
            data={filteredLedger.map((e) => ({
              Date: e.date,
              Month: monthLabelFromKey(monthKeyFromDate(e.date)),
              Head: feeHeadLabel(e),
              Description: e.description,
              GrossTuition: grossTuitionForEntry(e),
              ScholarshipDiscount: scholarshipDiscountForEntry(e),
              NetTuition: netTuitionForEntry(e),
              BusFee: isBusEntry(e) ? e.debit : 0,
              OtherCharges: !isTuitionEntry(e) && !isBusEntry(e) ? e.debit : 0,
              Paid: e.credit,
              RunningBalance: e.balance,
              Reference: e.reference || '',
            }))}
            filename={`ledger-${student?.name || 'student'}`}
          />
        </div>
      </div>

      {/* Student search + month controls */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_220px] gap-4 items-start">
            <div className="relative">
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Search Student</label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={studentQuery}
                  className="pl-10 h-10 rounded-xl"
                  placeholder="Search by name, roll #, CNIC or consumer #"
                  onFocus={() => setShowStudentResults(true)}
                  onBlur={() => window.setTimeout(() => setShowStudentResults(false), 120)}
                  onChange={(e) => {
                    handleQueryChange(e.target.value);
                  }}
                />
              </div>

              {showStudentResults && (studentQuery.trim().length >= 2) && (
                <div className="absolute z-20 w-full mt-2 rounded-xl border border-border bg-card shadow-lg max-h-64 overflow-y-auto">
                  {searching ? (
                    <p className="text-xs text-muted-foreground p-3 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />Searching…</p>
                  ) : studentMatches.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3">No student matched your search.</p>
                  ) : (
                    studentMatches.map((candidate) => (
                      <button
                        key={candidate.id}
                        type="button"
                        className="w-full text-left px-3 py-2.5 hover:bg-muted/60 border-b border-border/50 last:border-b-0"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectStudent(candidate)}
                      >
                        <p className="text-sm font-medium">{candidate.name}</p>
                        <p className="text-[11px] text-muted-foreground">{candidate.class} {candidate.section} • Roll {candidate.rollNumber} • {candidate.consumerNumber}</p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Month</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="All months" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All months</SelectItem>
                  {monthOptions.map((monthKey) => (
                    <SelectItem key={monthKey} value={monthKey}>{monthLabelFromKey(monthKey)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {student && (
            <div className="flex flex-wrap gap-6 text-sm mt-4">
              <div><span className="text-xs text-muted-foreground block">Consumer #</span><span className="font-mono font-semibold text-primary">{student.consumerNumber}</span></div>
              <div><span className="text-xs text-muted-foreground block">Bill ID</span><span className="font-mono font-semibold">{student.billId}</span></div>
              <div><span className="text-xs text-muted-foreground block">Father</span><span className="font-medium">{student.fatherName}</span></div>
              <div><span className="text-xs text-muted-foreground block">CNIC</span><span className="font-mono text-xs">{student.cnic}</span></div>
              <div><span className="text-xs text-muted-foreground block">Section</span><span className="font-medium">{student.class} {student.section}</span></div>
              <div><span className="text-xs text-muted-foreground block">Bus Service</span><span className="font-medium">{student.usesBusService ? 'Enabled' : 'Not Enabled'}</span></div>
              <div><span className="text-xs text-muted-foreground block">Bus Monthly Fee</span><span className="font-medium">{student.usesBusService ? formatPKR(student.busMonthlyFee) : '-'}</span></div>
              <div><span className="text-xs text-muted-foreground block">Risk</span><span className="font-semibold capitalize">{financialSnapshot?.riskTier || 'current'}</span></div>
              <div><span className="text-xs text-muted-foreground block">Scholarships</span><span className="font-medium">{activeScholarships.length > 0 ? activeScholarships.map((scholarship) => scholarship.name).join(', ') : '-'}</span></div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-6 gap-3">
        <div className="dashboard-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-success" /></div>
          <div><p className="stat-label">Total Paid</p><p className="text-lg font-bold">{formatPKR(totalCredit)}</p></div>
        </div>
        <div className="dashboard-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><School className="w-5 h-5 text-primary" /></div>
          <div><p className="stat-label">Tuition (Gross)</p><p className="text-lg font-bold">{formatPKR(grossTuitionTotal)}</p></div>
        </div>
        <div className="dashboard-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-success" /></div>
          <div><p className="stat-label">Scholarship Discount</p><p className="text-lg font-bold text-success">-{formatPKR(scholarshipDiscountTotal)}</p></div>
        </div>
        <div className="dashboard-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><School className="w-5 h-5 text-primary" /></div>
          <div><p className="stat-label">Tuition (Net)</p><p className="text-lg font-bold">{formatPKR(netTuitionTotal)}</p></div>
        </div>
        <div className="dashboard-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center"><BusFront className="w-5 h-5 text-info" /></div>
          <div><p className="stat-label">Bus Charges</p><p className="text-lg font-bold">{formatPKR(busTotal)}</p></div>
        </div>
        <div className="dashboard-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-primary" /></div>
          <div>
            <p className="stat-label">Outstanding (All Months)</p>
            <p className={`text-lg font-bold ${outstandingAllMonths > 0 ? 'text-destructive' : 'text-success'}`}>{formatPKR(outstandingAllMonths)}</p>
            <p className="text-[11px] text-muted-foreground">{overdueMonths} overdue month(s)</p>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="table-container">
        <div className="px-5 py-3 border-b border-border">
          <p className="text-sm font-semibold">
            Fee Ledger — {student?.name || 'Select a student'}
            <span className="text-muted-foreground font-normal ml-2">({selectedMonth === 'all' ? 'All months' : monthLabelFromKey(selectedMonth)})</span>
          </p>
        </div>
        {filteredLedger.length === 0 ? (
          <EmptyState icon={FileText} title="No ledger entries" description="No fee entries are available for the selected student or month." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold">Date</TableHead>
                <TableHead className="text-xs font-semibold">Month</TableHead>
                <TableHead className="text-xs font-semibold">Fee Head</TableHead>
                <TableHead className="text-xs font-semibold text-right">Tuition (Gross)</TableHead>
                <TableHead className="text-xs font-semibold text-right">Discount</TableHead>
                <TableHead className="text-xs font-semibold text-right">Tuition (Net)</TableHead>
                <TableHead className="text-xs font-semibold text-right">Bus Fee</TableHead>
                <TableHead className="text-xs font-semibold text-right">Other Charges</TableHead>
                <TableHead className="text-xs font-semibold text-right">Payment</TableHead>
                <TableHead className="text-xs font-semibold text-right">Running Balance</TableHead>
                <TableHead className="text-xs font-semibold">Reference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLedger.map((entry) => {
                const grossTuition = grossTuitionForEntry(entry);
                const scholarshipDiscount = scholarshipDiscountForEntry(entry);
                const netTuition = netTuitionForEntry(entry);
                const busFee = isBusEntry(entry) ? Number(entry.debit) : 0;
                const otherCharges = Number(entry.debit) > 0
                  ? Math.max(0, Number(entry.debit) - (isTuitionEntry(entry) ? netTuition : 0) - busFee)
                  : 0;

                return (
                  <TableRow key={entry.id} className="hover:bg-muted/30">
                    <TableCell className="text-sm text-muted-foreground">{entry.date}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{monthLabelFromKey(monthKeyFromDate(entry.date))}</TableCell>
                    <TableCell>
                      <div>
                        <p className="text-xs font-semibold">{feeHeadLabel(entry)}</p>
                        <p className="text-[11px] text-muted-foreground">{entry.description}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{grossTuition > 0 ? <span>{formatPKR(grossTuition)}</span> : '—'}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{scholarshipDiscount > 0 ? <span className="text-success">-{formatPKR(scholarshipDiscount)}</span> : '—'}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{netTuition > 0 ? <span>{formatPKR(netTuition)}</span> : '—'}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{busFee > 0 ? <span>{formatPKR(busFee)}</span> : '—'}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{otherCharges > 0 ? <span className="text-destructive">{formatPKR(otherCharges)}</span> : '—'}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{entry.credit > 0 ? <span className="text-success">{formatPKR(entry.credit)}</span> : '—'}</TableCell>
                    <TableCell className={`text-right font-mono text-sm font-semibold ${entry.balance > 0 ? 'text-destructive' : 'text-success'}`}>{formatPKR(entry.balance)}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{entry.reference || '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

export default FeeLedger;
