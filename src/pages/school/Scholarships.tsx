import { useMemo, useState } from 'react';
import { scholarships as initialScholarships, studentScholarshipAssignments as initialAssignments, students as studentDirectory } from '@/data/mockData';
import { Scholarship, StudentScholarshipAssignment } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Plus, Power, RotateCcw, UserPlus, X, Search } from 'lucide-react';

const Scholarships = () => {
  const [list, setList] = useState<Scholarship[]>(initialScholarships);
  const [assignments, setAssignments] = useState<StudentScholarshipAssignment[]>(initialAssignments);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [studentLookup, setStudentLookup] = useState('');
  const [form, setForm] = useState({ name: '', type: 'percentage' as Scholarship['type'], value: '', startDate: '', endDate: '', isLifetime: false });
  const [assignmentForm, setAssignmentForm] = useState({
    scholarshipId: '',
    scope: 'student' as 'student' | 'class',
    studentId: '',
    className: 'Class 1',
    section: 'all',
    effectiveFrom: new Date().toISOString().split('T')[0],
  });

  const syncScholarships = (next: Scholarship[]) => {
    setList(next);
    initialScholarships.splice(0, initialScholarships.length, ...next);
  };

  const syncAssignments = (next: StudentScholarshipAssignment[]) => {
    setAssignments(next);
    initialAssignments.splice(0, initialAssignments.length, ...next);
  };

  const classOptions = useMemo(() => {
    return Array.from(new Set(studentDirectory.map((student) => student.class)))
      .sort((a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, '')));
  }, []);

  const sectionOptions = useMemo(() => {
    return Array.from(
      new Set(
        studentDirectory
          .filter((student) => student.class === assignmentForm.className)
          .map((student) => student.section)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [assignmentForm.className]);

  const activeAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.status === 'active'),
    [assignments]
  );

  const assignmentCountByScholarship = useMemo(() => {
    const map: Record<string, number> = {};
    activeAssignments.forEach((assignment) => {
      map[assignment.scholarshipId] = (map[assignment.scholarshipId] || 0) + 1;
    });
    return map;
  }, [activeAssignments]);

  const activeAssignmentKeySet = useMemo(
    () => new Set(activeAssignments.map((assignment) => `${assignment.studentId}::${assignment.scholarshipId}`)),
    [activeAssignments]
  );

  const assignmentRows = useMemo(() => {
    return activeAssignments
      .map((assignment) => {
        const scholarship = list.find((item) => item.id === assignment.scholarshipId);
        const student = studentDirectory.find((item) => item.id === assignment.studentId);
        if (!scholarship || !student) return null;
        return { assignment, scholarship, student };
      })
      .filter((row): row is { assignment: StudentScholarshipAssignment; scholarship: Scholarship; student: typeof studentDirectory[number] } => row !== null)
      .sort((a, b) => a.student.class.localeCompare(b.student.class) || a.student.name.localeCompare(b.student.name));
  }, [activeAssignments, list]);

  const assignmentTargetPreview = useMemo(() => {
    if (assignmentForm.scope === 'student') return assignmentForm.studentId ? 1 : 0;
    return studentDirectory.filter((student) =>
      student.class === assignmentForm.className &&
      (assignmentForm.section === 'all' || student.section === assignmentForm.section)
    ).length;
  }, [assignmentForm]);

  const filteredStudentDirectory = useMemo(() => {
    const query = studentLookup.trim().toLowerCase();
    const source = !query
      ? studentDirectory
      : studentDirectory.filter((student) =>
          student.name.toLowerCase().includes(query) ||
          student.rollNumber.toLowerCase().includes(query) ||
          student.cnic.includes(studentLookup) ||
          student.consumerNumber.includes(studentLookup)
        );

    return source.slice(0, 120);
  }, [studentLookup]);

  const handleCreate = () => {
    if (!form.name || !form.value || !form.startDate || (!form.isLifetime && !form.endDate)) {
      toast.error('Please complete all required scholarship fields');
      return;
    }

    const s: Scholarship = {
      id: `sch${list.length + 1}`,
      name: form.name,
      type: form.type,
      value: Number(form.value),
      startDate: form.startDate,
      endDate: form.isLifetime ? null : form.endDate,
      isLifetime: form.isLifetime,
      status: 'active',
    };
    syncScholarships([...list, s]);
    setDialogOpen(false);
    setForm({ name: '', type: 'percentage', value: '', startDate: '', endDate: '', isLifetime: false });
    toast.success(`Scholarship "${form.name}" created. Discount will be applied to invoices.`);
  };

  const deactivateScholarship = (id: string) => {
    const next = list.map((s) => {
      if (s.id !== id) return s;
      return {
        ...s,
        status: 'inactive',
        endDate: s.isLifetime ? null : (s.endDate || new Date().toISOString().split('T')[0]),
      };
    });
    syncScholarships(next);
    toast.success('Scholarship deactivated');
  };

  const reactivateScholarship = (id: string) => {
    const next = list.map((s) => s.id === id ? { ...s, status: 'active' } : s);
    syncScholarships(next);
    toast.success('Scholarship reactivated');
  };

  const assignScholarship = () => {
    if (!assignmentForm.scholarshipId) {
      toast.error('Please select a scholarship to assign');
      return;
    }

    if (assignmentForm.scope === 'student' && !assignmentForm.studentId) {
      toast.error('Please choose a student for assignment');
      return;
    }

    const targetStudentIds = assignmentForm.scope === 'student'
      ? [assignmentForm.studentId]
      : studentDirectory
        .filter((student) =>
          student.class === assignmentForm.className &&
          (assignmentForm.section === 'all' || student.section === assignmentForm.section)
        )
        .map((student) => student.id);

    if (targetStudentIds.length === 0) {
      toast.error('No students found for the selected assignment scope');
      return;
    }

    const toCreate = targetStudentIds
      .filter((studentId) => !activeAssignmentKeySet.has(`${studentId}::${assignmentForm.scholarshipId}`))
      .map((studentId, index) => ({
        id: `ssa-${Date.now()}-${index}`,
        studentId,
        scholarshipId: assignmentForm.scholarshipId,
        effectiveFrom: assignmentForm.effectiveFrom,
        assignedAt: new Date().toISOString().split('T')[0],
        status: 'active' as const,
      }));

    if (toCreate.length === 0) {
      toast.info('Selected students are already assigned to this scholarship');
      return;
    }

    syncAssignments([...assignments, ...toCreate]);
    setAssignDialogOpen(false);
    setStudentLookup('');
    setAssignmentForm({
      scholarshipId: '',
      scope: 'student',
      studentId: '',
      className: 'Class 1',
      section: 'all',
      effectiveFrom: new Date().toISOString().split('T')[0],
    });
    toast.success(`${toCreate.length} student(s) assigned to scholarship`);
  };

  const unassignScholarship = (assignmentId: string) => {
    const next = assignments.map((assignment) =>
      assignment.id === assignmentId ? { ...assignment, status: 'inactive' } : assignment
    );
    syncAssignments(next);
    toast.success('Scholarship assignment removed');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Scholarships</h1>
          <p className="page-description">Manage discounts, assign them to students, and track active coverage</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Dialog
            open={assignDialogOpen}
            onOpenChange={(open) => {
              setAssignDialogOpen(open);
              if (!open) {
                setStudentLookup('');
                setAssignmentForm((prev) => ({ ...prev, studentId: '' }));
              }
            }}
          >
            <DialogTrigger asChild><Button variant="outline"><UserPlus className="w-4 h-4 mr-2" />Assign Scholarship</Button></DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader><DialogTitle>Assign Scholarship</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Scholarship</Label>
                  <Select value={assignmentForm.scholarshipId} onValueChange={(value) => setAssignmentForm({ ...assignmentForm, scholarshipId: value })}>
                    <SelectTrigger><SelectValue placeholder="Select scholarship" /></SelectTrigger>
                    <SelectContent>
                      {list.filter((scholarship) => scholarship.status === 'active').map((scholarship) => (
                        <SelectItem key={scholarship.id} value={scholarship.id}>
                          {scholarship.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Assign Scope</Label>
                  <Select value={assignmentForm.scope} onValueChange={(value: 'student' | 'class') => setAssignmentForm({ ...assignmentForm, scope: value, studentId: '' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Single Student</SelectItem>
                      <SelectItem value="class">Class / Section</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {assignmentForm.scope === 'student' ? (
                  <div>
                    <Label>Student</Label>
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          value={studentLookup}
                          className="pl-10 h-10 rounded-xl"
                          placeholder="Search by name, roll #, CNIC, or consumer #"
                          onChange={(e) => setStudentLookup(e.target.value)}
                        />
                      </div>
                      <div className="max-h-56 overflow-y-auto border rounded-xl p-2 space-y-1">
                        {filteredStudentDirectory.length === 0 ? (
                          <p className="text-sm text-muted-foreground p-3">No students match your search.</p>
                        ) : (
                          filteredStudentDirectory.map((student) => {
                            const isSelected = assignmentForm.studentId === student.id;
                            return (
                              <button
                                key={student.id}
                                type="button"
                                onClick={() => setAssignmentForm({ ...assignmentForm, studentId: student.id })}
                                className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted'}`}
                              >
                                <p className="text-sm font-medium truncate">{student.name}</p>
                                <p className="text-[11px] text-muted-foreground truncate">{student.class} {student.section} • {student.rollNumber} • {student.consumerNumber}</p>
                              </button>
                            );
                          })
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">Showing up to 120 students. Narrow the search to find specific students quickly.</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Class</Label>
                      <Select
                        value={assignmentForm.className}
                        onValueChange={(value) => setAssignmentForm({ ...assignmentForm, className: value, section: 'all' })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {classOptions.map((className) => <SelectItem key={className} value={className}>{className}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Section</Label>
                      <Select value={assignmentForm.section} onValueChange={(value) => setAssignmentForm({ ...assignmentForm, section: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Sections</SelectItem>
                          {sectionOptions.map((section) => <SelectItem key={section} value={section}>{section}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div>
                  <Label>Effective From</Label>
                  <Input
                    type="date"
                    value={assignmentForm.effectiveFrom}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, effectiveFrom: e.target.value })}
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  Assignment preview: {assignmentTargetPreview} student(s) will be linked to the selected scholarship.
                </p>

                <Button onClick={assignScholarship} className="w-full">Assign Scholarship</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Create Scholarship</Button></DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader><DialogTitle>Create Scholarship</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div>
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as Scholarship['type'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Value {form.type === 'percentage' ? '(%)' : '(Rs)'}</Label><Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
                <div><Label>Start Date</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
                <div className="flex items-center gap-2 rounded-lg border border-border p-3">
                  <Checkbox
                    id="lifetime-scholarship"
                    checked={form.isLifetime}
                    onCheckedChange={(checked) => setForm({ ...form, isLifetime: checked === true, endDate: checked === true ? '' : form.endDate })}
                  />
                  <Label htmlFor="lifetime-scholarship" className="text-sm">Lifetime scholarship (expires only on deactivation)</Label>
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={form.endDate}
                    disabled={form.isLifetime}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                </div>
                <Button onClick={handleCreate} className="w-full">Create</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Assigned Students</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="capitalize">{s.type}</TableCell>
                <TableCell>{s.type === 'percentage' ? `${s.value}%` : `₨ ${s.value.toLocaleString()}`}</TableCell>
                <TableCell className="text-sm">{s.isLifetime ? 'Lifetime (until deactivated)' : `${s.startDate} to ${s.endDate || '-'}`}</TableCell>
                <TableCell className="font-mono text-sm">{assignmentCountByScholarship[s.id] || 0}</TableCell>
                <TableCell><StatusBadge status={s.status} /></TableCell>
                <TableCell>
                  {s.status === 'active' ? (
                    <Button variant="outline" size="sm" className="h-8" onClick={() => deactivateScholarship(s.id)}>
                      <Power className="w-3.5 h-3.5 mr-1.5" />Deactivate
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-8" onClick={() => reactivateScholarship(s.id)}>
                      <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Reactivate
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="table-container">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <p className="text-sm font-semibold">Active Scholarship Assignments</p>
          <p className="text-xs text-muted-foreground">{assignmentRows.length} mapped students</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Scholarship</TableHead>
              <TableHead>Effective From</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignmentRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  No active scholarship assignments yet.
                </TableCell>
              </TableRow>
            ) : (
              assignmentRows.map((row) => (
                <TableRow key={row.assignment.id}>
                  <TableCell className="font-medium">{row.student.name}</TableCell>
                  <TableCell>{row.student.class} {row.student.section}</TableCell>
                  <TableCell>{row.scholarship.name}</TableCell>
                  <TableCell>{row.assignment.effectiveFrom}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="h-8 text-destructive" onClick={() => unassignScholarship(row.assignment.id)}>
                      <X className="w-3.5 h-3.5 mr-1.5" />Unassign
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Scholarships;
