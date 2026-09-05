import { useState, useMemo, useDeferredValue } from 'react';
import { api, type StudentDirectoryMeta } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import type { StudentDirectoryRecord, FeePlan, PaymentPlanAssignment } from '@/types';
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
import { Plus, GraduationCap, CheckCircle2, Search, Pencil, Trash2, Loader2 } from 'lucide-react';

const allClasses = ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];

const PaymentPrograms = () => {
  const [studentSearch, setStudentSearch] = useState('');
  const [studentClassFilter, setStudentClassFilter] = useState('all');
  const [studentSectionFilter, setStudentSectionFilter] = useState('all');
  const deferredStudentSearch = useDeferredValue(studentSearch);
  const { data: studentsData, meta: studentMeta, loading: ls } = useApiQuery<StudentDirectoryRecord[], StudentDirectoryMeta>(
    () => api.fetchStudents({
      pageSize: 200,
      search: deferredStudentSearch || undefined,
      className: studentClassFilter !== 'all' ? studentClassFilter : undefined,
      section: studentSectionFilter !== 'all' ? studentSectionFilter : undefined,
      status: 'active',
    }),
    [deferredStudentSearch, studentClassFilter, studentSectionFilter]
  );
  const { data: feePlansData, loading: lf } = useApiQuery(() => api.fetchFeePlans(), []);
  const { data: assignmentsData, loading: la, refetch: refetchAssignments } = useApiQuery(() => api.fetchPaymentPlanAssignments(), []);
  const students = useMemo(() => (studentsData || []) as StudentDirectoryRecord[], [studentsData]);
  const feePlans = (feePlansData || []) as FeePlan[];
  const assignments = useMemo(() => (assignmentsData || []) as PaymentPlanAssignment[], [assignmentsData]);
  const pageLoading = ls || lf || la;
  const [assigning, setAssigning] = useState(false);
  const [search, setSearch] = useState('');
  const [classAssignOpen, setClassAssignOpen] = useState(false);
  const [singleAssignOpen, setSingleAssignOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editAssignment, setEditAssignment] = useState<PaymentPlanAssignment | null>(null);
  const [editForm, setEditForm] = useState({ planId: '' });
  const [selectedClassPlan, setSelectedClassPlan] = useState('');
  const [selectedIndividualPlan, setSelectedIndividualPlan] = useState('');
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [assignmentClassFilter, setAssignmentClassFilter] = useState('all');
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState('all');
  const [assignmentFrequencyFilter, setAssignmentFrequencyFilter] = useState('all');

  const filtered = assignments.filter((a) => {
    const query = search.toLowerCase();
    const matchSearch =
      (a.studentName || '').toLowerCase().includes(query) ||
      (a.planName || '').toLowerCase().includes(query) ||
      (a.className || '').toLowerCase().includes(query) ||
      (a.consumerNumber || '').includes(search);
    const matchClass = assignmentClassFilter === 'all' || a.className === assignmentClassFilter;
    const matchStatus = assignmentStatusFilter === 'all' || a.status === assignmentStatusFilter;
    const matchFrequency = assignmentFrequencyFilter === 'all' || a.frequency === assignmentFrequencyFilter;
    return matchSearch && matchClass && matchStatus && matchFrequency;
  });

  // Group filtered assignments by student so each student is one row
  const groupedStudents = useMemo(() => {
    const map = new Map<string, { studentId: string; studentName: string; className: string; sectionName: string; consumerNumber: string; assignedVia: string; plans: PaymentPlanAssignment[] }>();
    for (const a of filtered) {
      if (!map.has(a.studentId)) {
        map.set(a.studentId, {
          studentId: a.studentId,
          studentName: a.studentName || '—',
          className: a.className || '',
          sectionName: a.sectionName || '',
          consumerNumber: a.consumerNumber || '—',
          assignedVia: a.assignedVia,
          plans: [],
        });
      }
      map.get(a.studentId)!.plans.push(a);
    }
    return Array.from(map.values());
  }, [filtered]);

  // Class summary
  const classCounts = useMemo(() => {
    return Object.fromEntries((studentMeta?.facets.classes || []).map((item) => [item.name, item.count]));
  }, [studentMeta]);

  const individualSections = useMemo(() => {
    if (studentClassFilter === 'all') {
      return Array.from(new Set((studentMeta?.facets.classes || []).flatMap((item) => item.sections.map((section) => section.name))))
        .sort((a, b) => a.localeCompare(b));
    }
    return (studentMeta?.facets.classes.find((item) => item.name === studentClassFilter)?.sections || [])
      .map((section) => section.name)
      .sort((a, b) => a.localeCompare(b));
  }, [studentClassFilter, studentMeta]);

  const filteredStudentDirectory = useMemo(() => {
    return students;
  }, [students]);

  // Students who already have any active/pending tuition plan (max 1 tuition per student)
  const assignedTuitionStudentIds = useMemo(
    () => new Set(
      assignments
        .filter((a) => (a.status === 'active' || a.status === 'pending') && (a.planType === 'tuition' || !a.planType))
        .map((a) => a.studentId)
    ),
    [assignments]
  );

  // studentId:planId pairs already active/pending — used to block exact duplicate additional plan assigns
  const assignedStudentPlanPairs = useMemo(
    () => new Set(
      assignments
        .filter((a) => a.status === 'active' || a.status === 'pending')
        .map((a) => `${a.studentId}:${a.feePlanId}`)
    ),
    [assignments]
  );

  const handleClassAssign = async () => {
    if (!selectedClassPlan || selectedClasses.length === 0) {
      toast.error('Select a plan and at least one class');
      return;
    }
    const plan = feePlans.find((p) => p.id === selectedClassPlan);
    if (!plan) return;

    setAssigning(true);
    try {
      const result = await api.bulkCreatePaymentPlanAssignments({
        feePlanId: plan.id,
        classNames: selectedClasses,
        assignedVia: 'class',
      });
      await refetchAssignments();
      setClassAssignOpen(false);
      setSelectedClassPlan('');
      setSelectedClasses([]);
      if (result.data.skipped === 0) {
        toast.success(`${plan.name} assigned to ${result.data.created} students across ${selectedClasses.length} class(es)`);
      } else {
        toast.success(`${plan.name} assigned to ${result.data.created} student(s). ${result.data.skipped} skipped.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to assign plan');
    } finally {
      setAssigning(false);
    }
  };

  const handleSingleAssign = async () => {
    if (!selectedIndividualPlan || selectedStudents.length === 0) {
      toast.error('Select a plan and at least one student');
      return;
    }
    const plan = feePlans.find((p) => p.id === selectedIndividualPlan);
    if (!plan) return;

    const eligibleIds = selectedStudents.filter((studentId) =>
      plan.planType === 'tuition'
        ? !assignedTuitionStudentIds.has(studentId)
        : !assignedStudentPlanPairs.has(`${studentId}:${plan.id}`)
    );

    if (eligibleIds.length === 0) {
      toast.info('All selected students already have this plan assigned.');
      return;
    }

    setAssigning(true);
    try {
      const result = await api.bulkCreatePaymentPlanAssignments({
        feePlanId: plan.id,
        studentIds: eligibleIds,
        assignedVia: 'individual',
      });
      await refetchAssignments();
      setSingleAssignOpen(false);
      setSelectedIndividualPlan('');
      setSelectedStudents([]);
      setStudentSearch('');
      setStudentClassFilter('all');
      setStudentSectionFilter('all');
      toast.success(`Payment plan assigned to ${result.data.created} student(s)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to assign plan');
    } finally {
      setAssigning(false);
    }
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

  const openEdit = (assignment: PaymentPlanAssignment) => {
    setEditAssignment(assignment);
    setEditForm({ planId: assignment.feePlanId });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editAssignment) return;
    if (!editForm.planId) {
      toast.error('Choose a fee plan');
      return;
    }
    setAssigning(true);
    try {
      await api.updatePaymentPlanAssignment(editAssignment.id, { feePlanId: editForm.planId });
      await refetchAssignments();
      toast.success('Assignment updated');
      setEditOpen(false);
      setEditAssignment(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update assignment');
    } finally {
      setAssigning(false);
    }
  };

  const deleteAssignment = async (id: string) => {
    setAssigning(true);
    try {
      await api.deletePaymentPlanAssignment(id);
      await refetchAssignments();
      toast.success('Assignment removed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove assignment');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {pageLoading && <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin" /></div>}
      {!pageLoading && <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Payment Programs</h1>
          <p className="page-description">Assign fee plans to classes or individual students</p>
          <p className="text-xs text-muted-foreground mt-1">Each student can hold only one active tuition plan. Multiple additional service charges (gym, books, stationery) can be assigned simultaneously.</p>
        </div>
        <div className="flex gap-2">
          {/* Class-level assignment (primary action) */}
          <Dialog open={classAssignOpen} onOpenChange={setClassAssignOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-lg">
                <GraduationCap className="w-4 h-4 mr-1.5" />Assign to Class
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader><DialogTitle>Assign Plan to Entire Class</DialogTitle></DialogHeader>
              <p className="text-xs text-muted-foreground -mt-1">Select one or more classes to apply a fee plan. Students who already have this specific plan will be skipped.</p>
              <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-4 pt-2">
                <div className="space-y-2 lg:pr-2">
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

                  {selectedClasses.length > 0 && selectedClassPlan && (
                    <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 flex items-start gap-2 mt-3">
                      <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-primary">Ready to assign</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {feePlans.find(p => p.id === selectedClassPlan)?.name} will be assigned to eligible students in {selectedClasses.length} class(es). Students already on this plan are skipped.
                        </p>
                      </div>
                    </div>
                  )}

                  <Button onClick={handleClassAssign} className="w-full h-10 rounded-xl mt-3" disabled={assigning}>
                    {assigning ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Assigning…</> : `Assign to ${totalStudentsSelected} Students`}
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Select Classes ({selectedClasses.length} selected • {totalStudentsSelected} students)</Label>
                  <div className="grid grid-cols-2 xl:grid-cols-3 gap-2 max-h-64 overflow-y-auto border rounded-xl p-3">
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
                            {p.planType === 'additional' ? ' (Service)' : ''}
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

                <p className="text-[11px] text-muted-foreground">Showing up to 200 students. Use class/section/search to narrow very large directories.</p>

                <div className="max-h-80 overflow-y-auto border rounded-xl p-2 space-y-1">
                  {filteredStudentDirectory.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-3">No students match your current search/filter.</p>
                  ) : (
                    filteredStudentDirectory.map((student) => {
                      const selectedPlanObj = feePlans.find((p) => p.id === selectedIndividualPlan);
                      const hasPlan = selectedPlanObj?.planType === 'tuition'
                        ? assignedTuitionStudentIds.has(student.id)
                        : !!selectedIndividualPlan && assignedStudentPlanPairs.has(`${student.id}:${selectedIndividualPlan}`);
                      return (
                      <label key={student.id} className={`flex items-start gap-2.5 py-2 px-2.5 rounded-lg cursor-pointer ${hasPlan ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted'}`}>
                        <Checkbox
                          checked={selectedStudents.includes(student.id)}
                          disabled={hasPlan}
                          onCheckedChange={() => !hasPlan && toggleStudent(student.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{student.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{student.class} {student.section} • {student.rollNumber} • {student.consumerNumber}</p>
                          {hasPlan && <p className="text-[10px] text-amber-600 font-medium">{feePlans.find(p => p.id === selectedIndividualPlan)?.planType === 'tuition' ? 'Already has a tuition plan' : 'Already assigned this plan'}</p>}
                        </div>
                      </label>
                      );
                    })
                  )}
                </div>

                <Button onClick={handleSingleAssign} className="w-full h-10 rounded-xl" disabled={assigning}>
                  {assigning ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Assigning…</> : `Assign to ${selectedStudents.length} Student(s)`}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <FilterBar
        searchPlaceholder="Search by student, consumer #, class, or plan..."
        onSearch={setSearch}
        filters={[
          {
            key: 'class',
            label: 'Class',
            options: allClasses.map((className) => ({ value: className, label: className })),
          },
          {
            key: 'status',
            label: 'Status',
            options: [
              { value: 'active', label: 'Active' },
              { value: 'pending', label: 'Pending' },
              { value: 'completed', label: 'Completed' },
            ],
          },
          {
            key: 'frequency',
            label: 'Frequency',
            options: [
              { value: 'monthly', label: 'Monthly' },
              { value: 'quarterly', label: 'Quarterly' },
              { value: 'yearly', label: 'Yearly' },
              { value: 'one-time', label: 'One-time' },
            ],
          },
        ]}
        onFilterChange={(key, value) => {
          if (key === 'class') setAssignmentClassFilter(value);
          if (key === 'status') setAssignmentStatusFilter(value);
          if (key === 'frequency') setAssignmentFrequencyFilter(value);
        }}
      />

      <div className="table-container">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <p className="text-sm font-semibold">
            Assignments
            <span className="text-muted-foreground font-normal ml-2">({groupedStudents.length} students · {filtered.length} plans)</span>
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-semibold">Student</TableHead>
              <TableHead className="text-xs font-semibold">Class</TableHead>
              <TableHead className="text-xs font-semibold">Consumer #</TableHead>
              <TableHead className="text-xs font-semibold">Fee Plans</TableHead>
              <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedStudents.map((g) => (
              <TableRow key={g.studentId} className="hover:bg-muted/30 align-top">
                <TableCell className="font-medium text-sm py-3">{g.studentName}</TableCell>
                <TableCell className="py-3">
                  <span className="text-xs font-medium bg-primary/8 text-primary px-2 py-0.5 rounded-md">{g.className} {g.sectionName}</span>
                </TableCell>
                <TableCell className="font-mono text-[11px] text-muted-foreground py-3">{g.consumerNumber}</TableCell>
                <TableCell className="py-2">
                  <div className="space-y-1.5">
                    {g.plans.map((a) => {
                      const isCompletedOneTime = a.status === 'completed' && a.frequency === 'one-time';
                      return (
                      <div key={a.id} className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs ${isCompletedOneTime ? 'opacity-50' : ''}`}>
                        <span className="font-medium text-sm">{a.planName}</span>
                        {a.planType === 'additional'
                          ? <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-medium">Service</span>
                          : <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-medium">Tuition</span>}
                        <span className="font-mono text-muted-foreground">₨ {(a.amount || 0).toLocaleString()}</span>
                        <span className="capitalize text-muted-foreground">{a.frequency}</span>
                        {isCompletedOneTime
                          ? <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-[10px] font-medium">Charged</span>
                          : <StatusBadge status={a.status} />}
                        {a.nextDueDate
                          ? <span className="text-muted-foreground">due {a.nextDueDate}</span>
                          : isCompletedOneTime
                            ? <span className="text-muted-foreground italic">charged once</span>
                            : <span className="text-muted-foreground italic">one-time</span>}
                      </div>
                      );
                    })}
                  </div>
                </TableCell>
                <TableCell className="text-right py-2">
                  <div className="flex flex-col items-end gap-1">
                    {g.plans.map((a) => (
                      <div key={a.id} className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => openEdit(a)} disabled={assigning}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-destructive" onClick={() => deleteAssignment(a.id)} disabled={assigning}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Assignment</DialogTitle></DialogHeader>
          {editAssignment && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-semibold">Fee Plan</Label>
                <Select value={editForm.planId} onValueChange={(value) => setEditForm({ ...editForm, planId: value })}>
                  <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Choose a plan" /></SelectTrigger>
                  <SelectContent>
                    {feePlans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} — ₨ {p.amount.toLocaleString()} / {p.frequency}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" className="rounded-lg" onClick={() => { setEditOpen(false); setEditAssignment(null); }}>Cancel</Button>
                <Button className="rounded-lg" onClick={saveEdit} disabled={!editForm.planId}>Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </>}
    </div>
  );
};

export default PaymentPrograms;
