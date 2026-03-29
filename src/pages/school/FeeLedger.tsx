import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { students, generateLedger } from '@/data/mockData';
import { LedgerEntry } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExportButton } from '@/components/ExportButton';
import { EmptyState } from '@/components/EmptyState';
import { formatPKR } from '@/lib/formatters';
import { FileText, User, CreditCard, AlertTriangle, CheckCircle2 } from 'lucide-react';

const FeeLedger = () => {
  const [searchParams] = useSearchParams();
  const defaultStudent = searchParams.get('student') || students[0]?.id || '';
  const [selectedStudent, setSelectedStudent] = useState(defaultStudent);

  const student = students.find(s => s.id === selectedStudent);
  const ledger = useMemo(() => selectedStudent ? generateLedger(selectedStudent) : [], [selectedStudent]);

  const totalDebit = ledger.reduce((sum, e) => sum + e.debit, 0);
  const totalCredit = ledger.reduce((sum, e) => sum + e.credit, 0);
  const currentBalance = totalDebit - totalCredit;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Student Fee Ledger</h1>
          <p className="page-description">Running balance for each student — FIFO payment allocation</p>
        </div>
        <div className="flex gap-2 items-center">
          <ExportButton data={ledger.map(e => ({ Date: e.date, Description: e.description, Debit: e.debit, Credit: e.credit, Balance: e.balance }))} filename={`ledger-${student?.name || 'student'}`} />
        </div>
      </div>

      {/* Student Selector */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex-1">
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Select Student</label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger className="h-10 rounded-xl max-w-md"><SelectValue placeholder="Choose a student" /></SelectTrigger>
                <SelectContent>
                  {students.slice(0, 30).map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name} — {s.class} {s.section} ({s.rollNumber})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {student && (
              <div className="flex gap-6 text-sm">
                <div><span className="text-xs text-muted-foreground block">Bill ID</span><span className="font-mono font-semibold text-primary">{student.billId}</span></div>
                <div><span className="text-xs text-muted-foreground block">Father</span><span className="font-medium">{student.fatherName}</span></div>
                <div><span className="text-xs text-muted-foreground block">CNIC</span><span className="font-mono text-xs">{student.cnic}</span></div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="dashboard-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-destructive" /></div>
          <div><p className="stat-label">Total Charged</p><p className="text-lg font-bold">{formatPKR(totalDebit)}</p></div>
        </div>
        <div className="dashboard-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-success" /></div>
          <div><p className="stat-label">Total Paid</p><p className="text-lg font-bold">{formatPKR(totalCredit)}</p></div>
        </div>
        <div className="dashboard-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center"><CreditCard className="w-5 h-5 text-warning" /></div>
          <div><p className="stat-label">Outstanding</p><p className={`text-lg font-bold ${currentBalance > 0 ? 'text-destructive' : 'text-success'}`}>{formatPKR(currentBalance)}</p></div>
        </div>
        <div className="dashboard-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><FileText className="w-5 h-5 text-primary" /></div>
          <div><p className="stat-label">Entries</p><p className="text-lg font-bold">{ledger.length}</p></div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="table-container">
        <div className="px-5 py-3 border-b border-border">
          <p className="text-sm font-semibold">Fee Ledger — {student?.name || 'Select a student'}</p>
        </div>
        {ledger.length === 0 ? (
          <EmptyState icon={FileText} title="No ledger entries" description="Select a student to view their fee ledger with all charges and payments." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold">Date</TableHead>
                <TableHead className="text-xs font-semibold">Description</TableHead>
                <TableHead className="text-xs font-semibold text-right">Debit (Charged)</TableHead>
                <TableHead className="text-xs font-semibold text-right">Credit (Paid)</TableHead>
                <TableHead className="text-xs font-semibold text-right">Balance</TableHead>
                <TableHead className="text-xs font-semibold">Reference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.map((entry) => (
                <TableRow key={entry.id} className="hover:bg-muted/30">
                  <TableCell className="text-sm text-muted-foreground">{entry.date}</TableCell>
                  <TableCell className="text-sm font-medium">{entry.description}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{entry.debit > 0 ? <span className="text-destructive">{formatPKR(entry.debit)}</span> : '—'}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{entry.credit > 0 ? <span className="text-success">{formatPKR(entry.credit)}</span> : '—'}</TableCell>
                  <TableCell className={`text-right font-mono text-sm font-semibold ${entry.balance > 0 ? 'text-destructive' : 'text-success'}`}>{formatPKR(entry.balance)}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{entry.reference || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

export default FeeLedger;
