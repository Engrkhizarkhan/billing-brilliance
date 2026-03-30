import { useState, useMemo } from 'react';
import { students } from '@/data/mockData';
import { feePlans } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterBar } from '@/components/FilterBar';
import { toast } from 'sonner';
import { Plus, GraduationCap, CheckCircle2, Search } from 'lucide-react';

const allClasses = ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];

interface PaymentAssignment {
  id: string;
  studentName: string;
  consumerNumber: string;
  className: string;
  planName: string;
  amount: number;
  frequency: string;
  status: 'active' | 'pending' | 'completed';
  assignedDate: string;
  nextDue: string;
}

const initialAssignments: PaymentAssignment[] = [
  { id: 'pa1', studentName: 'Ahmed Khan', consumerNumber: students[0].consumerNumber, className: students[0].class, planName: 'Standard Monthly', amount: 15000, frequency: 'monthly', status: 'active', assignedDate: '2025-01-15', nextDue: '2025-04-10' },
  { id: 'pa2', studentName: 'Sara Ali', consumerNumber: students[1].consumerNumber, className: students[1].class, planName: 'Premium Monthly', amount: 25000, frequency: 'monthly', status: 'active', assignedDate: '2025-01-15', nextDue: '2025-04-05' },
  { id: 'pa3', studentName: 'Hassan Raza', consumerNumber: students[2].consumerNumber, className: students[2].class, planName: 'Quarterly Plan', amount: 42000, frequency: 'quarterly', status: 'pending', assignedDate: '2025-02-01', nextDue: '2025-04-01' },
  { id: 'pa4', studentName: 'Fatima Noor', consumerNumber: students[3].consumerNumber, className: students[3].class, planName: 'Standard Monthly', amount: 15000, frequency: 'monthly', status: 'active', assignedDate: '2025-01-15', nextDue: '2025-04-10' },
  { id: 'pa5', studentName: 'Bilal Ahmed', consumerNumber: students[4].consumerNumber, className: students[4].class, planName: 'Annual Plan', amount: 150000, frequency: 'yearly', status: 'completed', assignedDate: '2025-01-01', nextDue: '2026-01-15' },
];

const PaymentPrograms = () => {
  const [assignments, setAssignments] = useState<PaymentAssignment[]>(initialAssignments);
  const [search, setSearch] = useState('');
  const [classAssignOpen, setClassAssignOpen] = useState(false);
  const [singleAssignOpen, setSingleAssignOpen] = useState(false);
  const [selectedClassPlan, setSelectedClassPlan] = useState('');
  const [selectedIndividualPlan, setSelectedIndividualPlan] = useState('');
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentClassFilter, setStudentClassFilter] = useState('all');
  const [studentSectionFilter, setStudentSectionFilter] = useState('all');

  const filtered = assignments.filter((a) =>
    a.studentName.toLowerCase().includes(search.toLowerCase()) || a.planName.toLowerCase().includes(search.toLowerCase()) || a.className.toLowerCase().includes(search.toLowerCase())
  );

  // Class summary
  const classCounts = useMemo(() => {
    const map: Record<string, number> = {};
    students.forEach((s) => { map[s.class] = (map[s.class] || 0) + 1; });
    return map;
  }, []);

  const individualSections = useMemo(() => {
    const pool = studentClassFilter === 'all' ? students : students.filter((student) => student.class === studentClassFilter);
    return Array.from(new Set(pool.map((student) => student.section))).sort((a, b) => a.localeCompare(b));
  }, [studentClassFilter]);

  const filteredStudentDirectory = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    return students.filter((student) => {
      const classMatch = studentClassFilter === 'all' || student.class === studentClassFilter;
      const sectionMatch = studentSectionFilter === 'all' || student.section === studentSectionFilter;
      const searchMatch = !query ||
        student.name.toLowerCase().includes(query) ||
        student.rollNumber.toLowerCase().includes(query) ||
        student.cnic.includes(studentSearch) ||
        student.consumerNumber.includes(studentSearch);
      return classMatch && sectionMatch && searchMatch;
    });
  }, [studentSearch, studentClassFilter, studentSectionFilter]);

  const handleClassAssign = () => {
    if (!selectedClassPlan || selectedClasses.length === 0) {
      toast.error('Select a plan and at least one class');
      return;
    }
    const plan = feePlans.find((p) => p.id === selectedClassPlan);
    if (!plan) return;

    const classStudents = students.filter((s) => selectedClasses.includes(s.class));
    const newAssignments: PaymentAssignment[] = classStudents.map((student, i) => ({
      id: `pa-class-${Date.now()}-${i}`,
      studentName: student.name,
      consumerNumber: student.consumerNumber,
      className: student.class,
      planName: plan.name,
      amount: plan.amount,
      frequency: plan.frequency,
      status: 'active' as const,
      assignedDate: new Date().toISOString().split('T')[0],
      nextDue: `2025-04-${String(plan.dueDay).padStart(2, '0')}`,
    }));

    setAssignments([...assignments, ...newAssignments]);
    setClassAssignOpen(false);
    setSelectedClassPlan('');
    setSelectedClasses([]);
    toast.success(`${plan.name} assigned to ${classStudents.length} students across ${selectedClasses.length} class(es)`);
  };

  const handleSingleAssign = () => {
    if (!selectedIndividualPlan || selectedStudents.length === 0) {
      toast.error('Select a plan and at least one student');
      return;
    }
    const plan = feePlans.find((p) => p.id === selectedIndividualPlan);
    if (!plan) return;

    const newAssignments: PaymentAssignment[] = selectedStudents.map((sid, i) => {
      const student = students.find((s) => s.id === sid);
      return {
        id: `pa-single-${Date.now()}-${i}`,
        studentName: student?.name || 'Unknown',
        consumerNumber: student?.consumerNumber || '',
        className: student?.class || '',
        planName: plan.name,
        amount: plan.amount,
        frequency: plan.frequency,
        status: 'active' as const,
        assignedDate: new Date().toISOString().split('T')[0],
        nextDue: `2025-04-${String(plan.dueDay).padStart(2, '0')}`,
      };
    });

    setAssignments([...assignments, ...newAssignments]);
    setSingleAssignOpen(false);
    setSelectedIndividualPlan('');
    setSelectedStudents([]);
    setStudentSearch('');
    setStudentClassFilter('all');
    setStudentSectionFilter('all');
    toast.success(`Payment plan assigned to ${newAssignments.length} student(s)`);
  };

  const toggleClass = (cls: string) => {
    setSelectedClasses((prev) => prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls]);
  };

  const toggleStudent = (id: string) => {
    setSelectedStudents((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  };

  const selectFilteredStudents = () => {
    const ids = filteredStudentDirectory.map((student) => student.id);
    setSelectedStudents((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const totalStudentsSelected = selectedClasses.reduce((acc, cls) => acc + (classCounts[cls] || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Payment Programs</h1>
          <p className="page-description">Assign fee plans to classes or individual students</p>
        </div>
        <div className="flex gap-2">
          {/* Class-level assignment (primary action) */}
          <Dialog open={classAssignOpen} onOpenChange={setClassAssignOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-lg">
                <GraduationCap className="w-4 h-4 mr-1.5" />Assign to Class
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Assign Plan to Entire Class</DialogTitle></DialogHeader>
              <p className="text-xs text-muted-foreground -mt-1">Select one or more classes to apply a fee plan to all students at once.</p>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Select Fee Plan</Label>
                  <Select value={selectedClassPlan} onValueChange={setSelectedClassPlan}>
                    <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Choose a plan" /></SelectTrigger>
                    <SelectContent>
                      {feePlans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — ₨ {p.amount.toLocaleString()} / {p.frequency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Select Classes ({selectedClasses.length} selected • {totalStudentsSelected} students)</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto border rounded-xl p-3">
                    {allClasses.map((cls) => (
                      <label key={cls} className={`flex items-center gap-2.5 py-2.5 px-3 rounded-lg cursor-pointer transition-colors ${selectedClasses.includes(cls) ? 'bg-primary/5 border border-primary/20' : 'hover:bg-muted border border-transparent'}`}>
                        <Checkbox
                          checked={selectedClasses.includes(cls)}
                          onCheckedChange={() => toggleClass(cls)}
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium">{cls}</span>
                          <span className="text-[10px] text-muted-foreground ml-2">{classCounts[cls] || 0} students</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {selectedClasses.length > 0 && selectedClassPlan && (
                  <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-primary">Ready to assign</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {feePlans.find(p => p.id === selectedClassPlan)?.name} will be assigned to {totalStudentsSelected} students in {selectedClasses.length} class(es)
                      </p>
                    </div>
                  </div>
                )}

                <Button onClick={handleClassAssign} className="w-full h-10 rounded-xl">
                  Assign to {totalStudentsSelected} Students
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Individual assignment */}
          <Dialog
            open={singleAssignOpen}
            onOpenChange={(open) => {
              setSingleAssignOpen(open);
              if (!open) {
                setSelectedStudents([]);
                setSelectedIndividualPlan('');
                setStudentSearch('');
                setStudentClassFilter('all');
                setStudentSectionFilter('all');
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-lg">
                <Plus className="w-4 h-4 mr-1.5" />Individual Assign
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader><DialogTitle>Assign Plan to Students</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_160px_160px] gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Fee Plan</Label>
                    <Select value={selectedIndividualPlan} onValueChange={setSelectedIndividualPlan}>
                      <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Choose a plan" /></SelectTrigger>
                      <SelectContent>
                        {feePlans.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} — ₨ {p.amount.toLocaleString()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Class</Label>
                    <Select value={studentClassFilter} onValueChange={(value) => { setStudentClassFilter(value); setStudentSectionFilter('all'); }}>
                      <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Classes</SelectItem>
                        {allClasses.map((className) => <SelectItem key={className} value={className}>{className}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Section</Label>
                    <Select value={studentSectionFilter} onValueChange={setStudentSectionFilter}>
                      <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sections</SelectItem>
                        {individualSections.map((section) => <SelectItem key={section} value={section}>{section}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Search Students</Label>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={studentSearch}
                      className="pl-10 h-10 rounded-xl"
                      placeholder="Search by name, roll #, CNIC, or consumer #"
                      onChange={(e) => setStudentSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">Showing {filteredStudentDirectory.length} students • {selectedStudents.length} selected</p>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" className="h-8" onClick={selectFilteredStudents} disabled={filteredStudentDirectory.length === 0}>
                      Select Filtered
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => setSelectedStudents([])} disabled={selectedStudents.length === 0}>
                      Clear Selection
                    </Button>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto border rounded-xl p-2 space-y-1">
                  {filteredStudentDirectory.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-3">No students match your current search/filter.</p>
                  ) : (
                    filteredStudentDirectory.map((student) => (
                      <label key={student.id} className="flex items-start gap-2.5 py-2 px-2.5 rounded-lg hover:bg-muted cursor-pointer">
                        <Checkbox
                          checked={selectedStudents.includes(student.id)}
                          onCheckedChange={() => toggleStudent(student.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{student.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{student.class} {student.section} • {student.rollNumber} • {student.consumerNumber}</p>
                        </div>
                      </label>
                    ))
                  )}
                </div>

                <Button onClick={handleSingleAssign} className="w-full h-10 rounded-xl">
                  Assign to {selectedStudents.length} Student(s)
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <FilterBar searchPlaceholder="Search by student, class, or plan…" onSearch={setSearch} />

      <div className="table-container">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <p className="text-sm font-semibold">
            Assignments
            <span className="text-muted-foreground font-normal ml-2">({filtered.length})</span>
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-semibold">Student</TableHead>
              <TableHead className="text-xs font-semibold">Class</TableHead>
              <TableHead className="text-xs font-semibold">Consumer #</TableHead>
              <TableHead className="text-xs font-semibold">Plan</TableHead>
              <TableHead className="text-xs font-semibold">Amount</TableHead>
              <TableHead className="text-xs font-semibold">Frequency</TableHead>
              <TableHead className="text-xs font-semibold">Status</TableHead>
              <TableHead className="text-xs font-semibold">Next Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((a) => (
              <TableRow key={a.id} className="hover:bg-muted/30">
                <TableCell className="font-medium text-sm">{a.studentName}</TableCell>
                <TableCell>
                  <span className="text-xs font-medium bg-primary/8 text-primary px-2 py-0.5 rounded-md">{a.className}</span>
                </TableCell>
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
