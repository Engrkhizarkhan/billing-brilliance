import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { students, generateLedger } from '@/data/mockData';
import { LedgerEntry } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { ExportButton } from '@/components/ExportButton';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/ui/input';
import { formatPKR } from '@/lib/formatters';
import { FileText, CreditCard, AlertTriangle, CheckCircle2, BusFront, School, Search } from 'lucide-react';

const monthKeyFromDate = (date: string) => date.slice(0, 7);

const monthLabelFromKey = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const isTuitionEntry = (entry: LedgerEntry) => entry.feeHeadId === 'fh1' || /tuition/i.test(entry.description);
const isBusEntry = (entry: LedgerEntry) => entry.feeHeadId === 'fh2' || /transport|bus/i.test(entry.description);

const feeHeadLabel = (entry: LedgerEntry) => {
  if (entry.credit > 0) return 'Payment';
  if (isTuitionEntry(entry)) return 'Tuition';
  if (isBusEntry(entry)) return 'Bus Fee';
  if (/fine/i.test(entry.description)) return 'Fine';
  return 'Other';
};

const FeeLedger = () => {
  const [searchParams] = useSearchParams();
  const defaultStudent = searchParams.get('student') || students[0]?.id || '';
  const [selectedStudent, setSelectedStudent] = useState(defaultStudent);
  const defaultStudentInfo = students.find((s) => s.id === defaultStudent);
  const [studentQuery, setStudentQuery] = useState(defaultStudentInfo ? `${defaultStudentInfo.name} — ${defaultStudentInfo.class} ${defaultStudentInfo.section} (${defaultStudentInfo.rollNumber})` : '');
  const [showStudentResults, setShowStudentResults] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('all');

  const student = students.find(s => s.id === selectedStudent);
  const ledger = useMemo(() => selectedStudent ? generateLedger(selectedStudent) : [], [selectedStudent]);

  const studentMatches = useMemo(() => {
    const query = studentQuery.trim().toLowerCase();
    const source = !query
      ? students
      : students.filter((s) =>
          s.name.toLowerCase().includes(query) ||
          s.rollNumber.toLowerCase().includes(query) ||
          s.cnic.includes(query) ||
          s.consumerNumber.includes(query)
        );
    return source.slice(0, 12);
  }, [studentQuery]);

  const monthOptions = useMemo(() => Array.from(new Set(ledger.map((e) => monthKeyFromDate(e.date)))), [ledger]);

  const filteredLedger = useMemo(
    () => selectedMonth === 'all' ? ledger : ledger.filter((entry) => monthKeyFromDate(entry.date) === selectedMonth),
    [ledger, selectedMonth]
  );

  const totalDebit = filteredLedger.reduce((sum, e) => sum + e.debit, 0);
  const totalCredit = filteredLedger.reduce((sum, e) => sum + e.credit, 0);
  const tuitionTotal = filteredLedger.reduce((sum, e) => sum + (isTuitionEntry(e) ? e.debit : 0), 0);
  const busTotal = filteredLedger.reduce((sum, e) => sum + (isBusEntry(e) ? e.debit : 0), 0);
  const periodBalance = totalDebit - totalCredit;

  const selectStudent = (studentId: string) => {
    const chosen = students.find((s) => s.id === studentId);
    if (!chosen) return;
    setSelectedStudent(chosen.id);
    setStudentQuery(`${chosen.name} — ${chosen.class} ${chosen.section} (${chosen.rollNumber})`);
    setSelectedMonth('all');
    setShowStudentResults(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Student Fee Ledger</h1>
          <p className="page-description">Running balance for each student — FIFO payment allocation</p>
        </div>
        <div className="flex gap-2 items-center">
          <ExportButton
            data={filteredLedger.map((e) => ({
              Date: e.date,
              Month: monthLabelFromKey(monthKeyFromDate(e.date)),
              Head: feeHeadLabel(e),
              Description: e.description,
              Tuition: isTuitionEntry(e) ? e.debit : 0,
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
                    setStudentQuery(e.target.value);
                    setShowStudentResults(true);
                  }}
                />
              </div>

              {showStudentResults && (
                <div className="absolute z-20 w-full mt-2 rounded-xl border border-border bg-card shadow-lg max-h-64 overflow-y-auto">
                  {studentMatches.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3">No student matched your search.</p>
                  ) : (
                    studentMatches.map((candidate) => (
                      <button
                        key={candidate.id}
                        type="button"
                        className="w-full text-left px-3 py-2.5 hover:bg-muted/60 border-b border-border/50 last:border-b-0"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectStudent(candidate.id)}
                      >
                        <p className="text-sm font-medium">{candidate.name}</p>
                        <p className="text-[11px] text-muted-foreground">{candidate.class} {candidate.section} • {candidate.rollNumber}</p>
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
              <div><span className="text-xs text-muted-foreground block">Bill ID</span><span className="font-mono font-semibold text-primary">{student.billId}</span></div>
              <div><span className="text-xs text-muted-foreground block">Father</span><span className="font-medium">{student.fatherName}</span></div>
              <div><span className="text-xs text-muted-foreground block">CNIC</span><span className="font-mono text-xs">{student.cnic}</span></div>
              <div><span className="text-xs text-muted-foreground block">Section</span><span className="font-medium">{student.class} {student.section}</span></div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <div className="dashboard-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-destructive" /></div>
          <div><p className="stat-label">Total Charged</p><p className="text-lg font-bold">{formatPKR(totalDebit)}</p></div>
        </div>
        <div className="dashboard-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-success" /></div>
          <div><p className="stat-label">Total Paid</p><p className="text-lg font-bold">{formatPKR(totalCredit)}</p></div>
        </div>
        <div className="dashboard-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><School className="w-5 h-5 text-primary" /></div>
          <div><p className="stat-label">Tuition Charges</p><p className="text-lg font-bold">{formatPKR(tuitionTotal)}</p></div>
        </div>
        <div className="dashboard-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center"><BusFront className="w-5 h-5 text-info" /></div>
          <div><p className="stat-label">Bus Fee Charges</p><p className="text-lg font-bold">{formatPKR(busTotal)}</p></div>
        </div>
        <div className="dashboard-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center"><CreditCard className="w-5 h-5 text-warning" /></div>
          <div><p className="stat-label">Period Balance</p><p className={`text-lg font-bold ${periodBalance > 0 ? 'text-destructive' : 'text-success'}`}>{formatPKR(periodBalance)}</p></div>
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
                <TableHead className="text-xs font-semibold text-right">Tuition</TableHead>
                <TableHead className="text-xs font-semibold text-right">Bus Fee</TableHead>
                <TableHead className="text-xs font-semibold text-right">Other Charges</TableHead>
                <TableHead className="text-xs font-semibold text-right">Payment</TableHead>
                <TableHead className="text-xs font-semibold text-right">Running Balance</TableHead>
                <TableHead className="text-xs font-semibold">Reference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLedger.map((entry) => {
                const tuition = isTuitionEntry(entry) ? entry.debit : 0;
                const busFee = isBusEntry(entry) ? entry.debit : 0;
                const otherCharges = entry.debit > 0 ? Math.max(0, entry.debit - tuition - busFee) : 0;

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
                    <TableCell className="text-right font-mono text-sm">{tuition > 0 ? <span>{formatPKR(tuition)}</span> : '—'}</TableCell>
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
