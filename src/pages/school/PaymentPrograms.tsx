import { useState } from 'react';
import { students } from '@/data/mockData';
import { feePlans } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterBar } from '@/components/FilterBar';
import { toast } from 'sonner';
import { CreditCard, Plus, Users } from 'lucide-react';

interface PaymentAssignment {
  id: string;
  studentName: string;
  consumerNumber: string;
  planName: string;
  amount: number;
  frequency: string;
  status: 'active' | 'pending' | 'completed';
  assignedDate: string;
  nextDue: string;
}

const initialAssignments: PaymentAssignment[] = [
  { id: 'pa1', studentName: 'Ahmed Khan', consumerNumber: students[0].consumerNumber, planName: 'Standard Monthly', amount: 15000, frequency: 'monthly', status: 'active', assignedDate: '2025-01-15', nextDue: '2025-04-10' },
  { id: 'pa2', studentName: 'Sara Ali', consumerNumber: students[1].consumerNumber, planName: 'Premium Monthly', amount: 25000, frequency: 'monthly', status: 'active', assignedDate: '2025-01-15', nextDue: '2025-04-05' },
  { id: 'pa3', studentName: 'Hassan Raza', consumerNumber: students[2].consumerNumber, planName: 'Quarterly Plan', amount: 42000, frequency: 'quarterly', status: 'pending', assignedDate: '2025-02-01', nextDue: '2025-04-01' },
  { id: 'pa4', studentName: 'Fatima Noor', consumerNumber: students[3].consumerNumber, planName: 'Standard Monthly', amount: 15000, frequency: 'monthly', status: 'active', assignedDate: '2025-01-15', nextDue: '2025-04-10' },
  { id: 'pa5', studentName: 'Bilal Ahmed', consumerNumber: students[4].consumerNumber, planName: 'Annual Plan', amount: 150000, frequency: 'yearly', status: 'completed', assignedDate: '2025-01-01', nextDue: '2026-01-15' },
];

const PaymentPrograms = () => {
  const [assignments, setAssignments] = useState<PaymentAssignment[]>(initialAssignments);
  const [search, setSearch] = useState('');
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

  const filtered = assignments.filter((a) =>
    a.studentName.toLowerCase().includes(search.toLowerCase()) || a.planName.toLowerCase().includes(search.toLowerCase())
  );

  const handleAssignSingle = () => {
    if (!selectedPlan || selectedStudents.length === 0) {
      toast.error('Select a plan and at least one student');
      return;
    }
    const plan = feePlans.find((p) => p.id === selectedPlan);
    if (!plan) return;

    const newAssignments = selectedStudents.map((sid, i) => {
      const student = students.find((s) => s.id === sid);
      return {
        id: `pa-new-${Date.now()}-${i}`,
        studentName: student?.name || 'Unknown',
        consumerNumber: student?.consumerNumber || '',
        planName: plan.name,
        amount: plan.amount,
        frequency: plan.frequency,
        status: 'active' as const,
        assignedDate: new Date().toISOString().split('T')[0],
        nextDue: `2025-04-${String(plan.dueDay).padStart(2, '0')}`,
      };
    });

    setAssignments([...assignments, ...newAssignments]);
    setAssignDialogOpen(false);
    setBulkAssignOpen(false);
    setSelectedPlan('');
    setSelectedStudents([]);
    toast.success(`Payment plan assigned to ${newAssignments.length} student(s)`);
  };

  const toggleStudent = (id: string) => {
    setSelectedStudents((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const availableStudents = students.slice(0, 15);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-header">Payment Programs</h1>
          <p className="page-description">Assign fee plans to students and track payment schedules</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Users className="w-3.5 h-3.5 mr-1.5" />Bulk Assign
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Bulk Assign Payment Plan</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Select Fee Plan</Label>
                  <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Choose a plan" /></SelectTrigger>
                    <SelectContent>
                      {feePlans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — ₨ {p.amount.toLocaleString()} / {p.frequency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Select Students ({selectedStudents.length} selected)</Label>
                  <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                    {availableStudents.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted cursor-pointer">
                        <Checkbox
                          checked={selectedStudents.includes(s.id)}
                          onCheckedChange={() => toggleStudent(s.id)}
                        />
                        <span className="text-sm flex-1">{s.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{s.rollNumber}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Button onClick={handleAssignSingle} className="w-full h-9 text-sm">
                  Assign to {selectedStudents.length} Student(s)
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-3.5 h-3.5 mr-1.5" />Assign Plan</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Assign Payment Plan</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Fee Plan</Label>
                  <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Choose a plan" /></SelectTrigger>
                    <SelectContent>
                      {feePlans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — ₨ {p.amount.toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Student</Label>
                  <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                    {availableStudents.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted cursor-pointer">
                        <Checkbox
                          checked={selectedStudents.includes(s.id)}
                          onCheckedChange={() => toggleStudent(s.id)}
                        />
                        <span className="text-sm">{s.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Button onClick={handleAssignSingle} className="w-full h-9 text-sm">Assign Plan</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <FilterBar searchPlaceholder="Search by student or plan…" onSearch={setSearch} />

      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Student</TableHead>
              <TableHead className="text-xs">Consumer #</TableHead>
              <TableHead className="text-xs">Plan</TableHead>
              <TableHead className="text-xs">Amount</TableHead>
              <TableHead className="text-xs">Frequency</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Next Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium text-sm">{a.studentName}</TableCell>
                <TableCell className="font-mono text-[11px] text-muted-foreground">{a.consumerNumber}</TableCell>
                <TableCell className="text-sm">{a.planName}</TableCell>
                <TableCell className="text-sm font-mono">₨ {a.amount.toLocaleString()}</TableCell>
                <TableCell className="text-sm capitalize">{a.frequency}</TableCell>
                <TableCell><StatusBadge status={a.status} /></TableCell>
                <TableCell className="text-sm text-muted-foreground">{a.nextDue}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default PaymentPrograms;
