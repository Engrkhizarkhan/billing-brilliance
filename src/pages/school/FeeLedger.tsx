import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { LedgerEntry, Student, StudentFinancialSnapshot, StudentLedgerSummary } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { ExportButton } from '@/components/ExportButton';
import { EmptyState } from '@/components/EmptyState';
import { TablePagination } from '@/components/TablePagination';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { formatPKR } from '@/lib/formatters';
import { FileText, AlertTriangle, CheckCircle2, School, Search, Loader2, BookOpen, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { usePaymentStore } from '@/store/paymentStore';

const allClasses = ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];

const monthKeyFromDate = (date: string) => date.slice(0, 7);

const monthLabelFromKey = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const NON_TUITION = /transport|bus|gym|book|stationer|library|sport|fine|late fee/i;

const isTuitionEntry = (entry: LedgerEntry) => {
  if (entry.credit > 0) return false;
  if (entry.feeHeadId === 'fh1') return true;
  // Exclude any description that clearly belongs to a different fee head
  if (NON_TUITION.test(entry.description)) return false;
  // grossTuition is set by the invoice generator — reliable for tuition plans
  if (entry.grossTuition != null) return true;
  return /tuition/i.test(entry.description);
};
const isBusEntry = (entry: LedgerEntry) => entry.feeHeadId === 'fh2' || /transport|bus/i.test(entry.description);

const grossTuitionForEntry = (entry: LedgerEntry) => Number(entry.grossTuition ?? (isTuitionEntry(entry) ? entry.debit : 0));
const scholarshipDiscountForEntry = (entry: LedgerEntry) => Number(entry.scholarshipDiscount ?? 0);
const currentMonthKey = () => new Date().toISOString().slice(0, 7);

const feeHeadLabel = (entry: LedgerEntry) => {
  if (entry.entryType === 'late_fee') return 'Late Fee';
  if (entry.credit > 0) return 'Payment';
  if (isTuitionEntry(entry)) return 'Tuition';
  if (isBusEntry(entry)) return 'Bus Fee';
  if (/fine/i.test(entry.description)) return 'Fine';
  if (/late fee/i.test(entry.description)) return 'Late Fee';
  if (/gym/i.test(entry.description)) return 'Gym Fee';
  if (/\bbook/i.test(entry.description)) return 'Books Fee';
  if (/stationer/i.test(entry.description)) return 'Stationery Fee';
  if (/library/i.test(entry.description)) return 'Library Fee';
  if (/sport/i.test(entry.description)) return 'Sports Fee';
  return 'Other Charges';
};

const FeeLedger = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedStudent = searchParams.get('student') || '';

  // ---- LIST VIEW STATE ----
  const [listSearch, setListSearch] = useState('');
  const [listClass, setListClass] = useState('all');
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(25);

  const { data: summaryData, loading: summaryLoading } = useApiQuery(
    () => !selectedStudent
      ? api.fetchStudentLedgerSummary({ pageSize: 1000 })
      : Promise.resolve({ data: [] as StudentLedgerSummary[] }),
    [selectedStudent]
  );
  const allSummaries = (summaryData || []) as StudentLedgerSummary[];

  const filteredSummaries = useMemo(() => {
    let list = allSummaries;
    if (listSearch.trim()) {
      const q = listSearch.toLowerCase();
      list = list.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        s.consumerNumber.toLowerCase().includes(q) ||
        (s.rollNumber || '').toLowerCase().includes(q)
      );
    }
    if (listClass !== 'all') list = list.filter((s) => s.class === listClass);
    return list;
  }, [allSummaries, listSearch, listClass]);

  const paginatedSummaries = filteredSummaries.slice((listPage - 1) * listPageSize, listPage * listPageSize);

  // ---- DETAIL VIEW STATE ----
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

  // Load student when URL param changes
  useEffect(() => {
    if (!selectedStudent) return;
    void api.getStudent(selectedStudent).then((res) => {
      const s = res?.data;
      if (s) {
        setSelectedStudentObj(s);
        setStudentQuery(`${s.name} — ${s.class} ${s.section} (${s.rollNumber})`);
      }
    });
  }, [selectedStudent]);

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
  const scholarshipDiscountTotal = filteredLedger.reduce((sum, e) => sum + scholarshipDiscountForEntry(e), 0);
  const totalLateFees = filteredLedger.reduce((sum, e) => sum + (e.entryType === 'late_fee' ? Number(e.debit) : 0), 0);
  const outstandingAllMonths = financialSnapshot?.totalDue || 0;
  const overdueMonths = financialSnapshot?.overdueMonths || 0;

  // Build set of transaction references that had a late fee applied — used to badge payment rows
  const latePaymentRefs = useMemo(
    () => new Set(filteredLedger.filter((e) => e.entryType === 'late_fee').map((e) => e.reference).filter(Boolean)),
    [filteredLedger]
  );

  const selectStudent = (s: Student) => {
    setSearchParams({ student: s.id });
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

  if (!selectedStudent) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="page-header">Student Fee Ledger</h1>
            <p className="page-description">View running balance and fee breakdown per student. Click "View" to see the full ledger.</p>
          </div>
          <ExportButton
            data={filteredSummaries.map((s) => ({
              Name: s.name,
              Class: `${s.class} ${s.section}`,
              ConsumerNumber: s.consumerNumber,
              TotalCharged: s.totalDebit,
              TotalPaid: s.totalCredit,
              RunningBalance: s.runningBalance,
              Entries: s.entryCount,
            }))}
            filename="fee-ledger-summary"
          />
        </div>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-4">
              <div className="relative">
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Search Student</label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={listSearch}
                    className="pl-10 h-10 rounded-xl"
                    placeholder="Name, consumer #, roll #"
                    onChange={(e) => { setListSearch(e.target.value); setListPage(1); }}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Class</label>
                <Select value={listClass} onValueChange={(v) => { setListClass(v); setListPage(1); }}>
                  <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="All classes" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All classes</SelectItem>
                    {allClasses.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="table-container">
          <div className="px-5 py-3 border-b border-border">
            <p className="text-sm font-semibold">
              {filteredSummaries.length} students
            </p>
          </div>
          {summaryLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
              <span className="text-sm text-muted-foreground">Loading ledger…</span>
            </div>
          ) : filteredSummaries.length === 0 ? (
            <EmptyState icon={FileText} title="No ledger data" description="No students found. Ledger entries are created when fees are assigned." />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Student</TableHead>
                    <TableHead className="text-xs font-semibold">Class</TableHead>
                    <TableHead className="text-xs font-semibold">Consumer #</TableHead>
                    <TableHead className="text-xs font-semibold">Ledger Summary</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedSummaries.map((s) => (
                    <TableRow key={s.id} className="hover:bg-muted/30">
                      <TableCell>
                        <p className="text-sm font-medium">{s.name}</p>
                        <p className="text-[11px] text-muted-foreground">Roll {s.rollNumber || '—'}</p>
                      </TableCell>
                      <TableCell className="text-sm">{s.class} {s.section}</TableCell>
                      <TableCell className="font-mono text-sm text-primary">{s.consumerNumber}</TableCell>
                      <TableCell>
                        <p className="text-sm">
                          <span className="text-muted-foreground">Charged: </span>
                          <span className="font-mono text-destructive font-medium">{formatPKR(s.totalDebit)}</span>
                          <span className="text-muted-foreground"> · Paid: </span>
                          <span className="font-mono text-success font-medium">{formatPKR(s.totalCredit)}</span>
                          <span className="text-muted-foreground"> · {s.entryCount} {s.entryCount === 1 ? 'entry' : 'entries'}</span>
                        </p>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-xs"
                          onClick={() => setSearchParams({ student: s.id })}
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                total={filteredSummaries.length}
                page={listPage}
                pageSize={listPageSize}
                onPageChange={setListPage}
                onPageSizeChange={(s) => { setListPageSize(s); setListPage(1); }}
              />
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" className="gap-1.5 mb-1 -ml-2 text-muted-foreground" onClick={() => setSearchParams({})}>
            <ArrowLeft className="w-3.5 h-3.5" />
            All Students
          </Button>
          <h1 className="page-header">Student Fee Ledger</h1>
          <p className="page-description">Running balance with clear fee breakdown. Additional service charges are posted automatically when assigned via Payment Programs.</p>
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
              Description: feeHeadLabel(e),
              Details: e.description,
              ScholarshipDiscount: scholarshipDiscountForEntry(e),
              Charged: e.debit,
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
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <div className="dashboard-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><School className="w-5 h-5 text-primary" /></div>
          <div><p className="stat-label">Total Charged</p><p className="text-lg font-bold">{formatPKR(totalDebit)}</p></div>
        </div>
        <div className="dashboard-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-success" /></div>
          <div><p className="stat-label">Scholarship Discount</p><p className="text-lg font-bold text-success">-{formatPKR(scholarshipDiscountTotal)}</p></div>
        </div>
        <div className="dashboard-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-success" /></div>
          <div><p className="stat-label">Total Paid</p><p className="text-lg font-bold text-success">{formatPKR(totalCredit)}</p></div>
        </div>
        <div className="dashboard-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-destructive" /></div>
          <div>
            <p className="stat-label">Outstanding</p>
            <p className={`text-lg font-bold ${outstandingAllMonths > 0 ? 'text-destructive' : 'text-success'}`}>{formatPKR(outstandingAllMonths)}</p>
            {overdueMonths > 0 && <p className="text-[11px] text-destructive">{overdueMonths} overdue month(s)</p>}
          </div>
        </div>
        <div className="dashboard-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-warning" /></div>
          <div>
            <p className="stat-label">Late Fees</p>
            <p className={`text-lg font-bold ${totalLateFees > 0 ? 'text-warning' : 'text-muted-foreground'}`}>{formatPKR(totalLateFees)}</p>
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
                <TableHead className="text-xs font-semibold w-[90px]">Date</TableHead>
                <TableHead className="text-xs font-semibold w-[70px]">Month</TableHead>
                <TableHead className="text-xs font-semibold">Description</TableHead>
                <TableHead className="text-xs font-semibold text-right">Charged</TableHead>
                <TableHead className="text-xs font-semibold text-right">Paid</TableHead>
                <TableHead className="text-xs font-semibold text-right">Balance</TableHead>
                <TableHead className="text-xs font-semibold">Ref</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLedger.map((entry) => {
                const discount = scholarshipDiscountForEntry(entry);
                const isPayment = entry.entryType === 'payment' || (Number(entry.credit) > 0 && entry.entryType !== 'late_fee');
                const isLateFee = entry.entryType === 'late_fee';
                const isLatePayment = isPayment && latePaymentRefs.has(entry.reference ?? '');

                return (
                  <TableRow key={entry.id} className={`hover:bg-muted/30 ${isLateFee ? 'bg-warning/5' : ''}`}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{entry.date}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{monthLabelFromKey(monthKeyFromDate(entry.date))}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-semibold ${isLateFee ? 'text-warning' : ''}`}>{feeHeadLabel(entry)}</p>
                        {isPayment && (
                          isLatePayment
                            ? <span className="text-[10px] font-medium bg-warning/15 text-warning rounded-full px-1.5 py-0.5">Late</span>
                            : <span className="text-[10px] font-medium bg-success/15 text-success rounded-full px-1.5 py-0.5">On Time</span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{entry.description}</p>
                      {discount > 0 && (
                        <p className="text-[11px] text-success font-medium">Scholarship: -{formatPKR(discount)}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {!isPayment && Number(entry.debit) > 0 ? (
                        <span className={isLateFee ? 'text-warning font-semibold' : 'text-foreground'}>{formatPKR(Number(entry.debit))}</span>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {isPayment ? (
                        <span className="text-success font-semibold">{formatPKR(Number(entry.credit))}</span>
                      ) : '—'}
                    </TableCell>
                    <TableCell className={`text-right font-mono text-sm font-bold ${Number(entry.balance) > 0 ? 'text-destructive' : 'text-success'}`}>
                      {formatPKR(Number(entry.balance))}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">{entry.reference || '—'}</TableCell>
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
