import { Fragment, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { Scholarship, Student, StudentScholarshipAssignment } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Plus, Power, UserPlus, X, Search, Loader2 } from 'lucide-react';

const Scholarships = () => {
  const { data: scholarshipsData, loading: scholarshipsLoading, refetch: refetchScholarships } = useApiQuery(() => api.fetchScholarships({}), []);
  const { data: assignmentsData, refetch: refetchAssignments } = useApiQuery(() => api.fetchAllScholarshipAssignments(), []);
  const { data: studentsData, loading: studentsLoading } = useApiQuery(() => api.fetchStudents({ pageSize: 9999 }), []);
  const studentDirectory = useMemo(() => (studentsData || []) as Student[], [studentsData]);

  const [list, setList] = useState<Scholarship[]>([]);
  const [assignments, setAssignments] = useState<StudentScholarshipAssignment[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<Scholarship | null>(null);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [unassigningId, setUnassigningId] = useState<string | null>(null);
  const [studentLookup, setStudentLookup] = useState('');
  const [expandedScholarshipId, setExpandedScholarshipId] = useState<string | null>(null);
  const [assignmentSearchTerm, setAssignmentSearchTerm] = useState('');
  const [assignmentClassFilter, setAssignmentClassFilter] = useState('all');
  const [form, setForm] = useState({ name: '', type: 'percentage' as Scholarship['type'], value: '', startDate: '', endDate: '', isLifetime: false });
  const [assignmentForm, setAssignmentForm] = useState({
    scholarshipId: '',
    scope: 'student' as 'student' | 'class',
    studentId: '',
    className: 'Class 1',
    section: 'all',
    effectiveFrom: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (scholarshipsData) setList(scholarshipsData as Scholarship[]);
  }, [scholarshipsData]);

  useEffect(() => {
    if (assignmentsData) setAssignments(assignmentsData as StudentScholarshipAssignment[]);
  }, [assignmentsData]);

  const classOptions = useMemo(() => {
    return Array.from(new Set(studentDirectory.map((student) => student.class)))
      .sort((a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, '')));
  }, [studentDirectory]);

  const sectionOptions = useMemo(() => {
    return Array.from(
      new Set(
        studentDirectory
          .filter((student) => student.class === assignmentForm.className)
          .map((student) => student.section)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [assignmentForm.className, studentDirectory]);

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
  }, [activeAssignments, list, studentDirectory]);

  const assignmentRowsByScholarship = useMemo(() => {
    const map: Record<string, typeof assignmentRows> = {};
    assignmentRows.forEach((row) => {
      if (!map[row.scholarship.id]) map[row.scholarship.id] = [];
      map[row.scholarship.id].push(row);
    });
    return map;
  }, [assignmentRows]);

  const activeScholarshipsWithAssignments = useMemo(() => {
    return list
      .map((scholarship) => ({
        scholarship,
        assignedCount: assignmentCountByScholarship[scholarship.id] || 0,
      }));
  }, [list, assignmentCountByScholarship]);

  const expandedScholarshipClassOptions = useMemo(() => {
    if (!expandedScholarshipId) return [];
    return Array.from(
      new Set((assignmentRowsByScholarship[expandedScholarshipId] || []).map((row) => row.student.class))
    ).sort((a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, '')));
  }, [assignmentRowsByScholarship, expandedScholarshipId]);

  const assignmentTargetPreview = useMemo(() => {
    if (assignmentForm.scope === 'student') return assignmentForm.studentId ? 1 : 0;
    return studentDirectory.filter((student) =>
      student.class === assignmentForm.className &&
      (assignmentForm.section === 'all' || student.section === assignmentForm.section)
    ).length;
  }, [assignmentForm, studentDirectory]);

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
  }, [studentLookup, studentDirectory]);

  const handleCreate = async () => {
    if (!form.name || !form.value || !form.startDate || (!form.isLifetime && !form.endDate)) {
      toast.error('Please complete all required scholarship fields');
      return;
    }

    setSaving(true);
    try {
      await api.createScholarship({
        name: form.name,
        type: form.type,
        value: Number(form.value),
        startDate: form.startDate,
        endDate: form.isLifetime ? null : form.endDate,
        isLifetime: form.isLifetime,
      });
      refetchScholarships();
      setDialogOpen(false);
      setForm({ name: '', type: 'percentage', value: '', startDate: '', endDate: '', isLifetime: false });
      toast.success(`Scholarship "${form.name}" created. Discount will be applied to invoices.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create scholarship');
    } finally {
      setSaving(false);
    }
  };

  const deactivateScholarship = async () => {
    if (!deactivateTarget) return;
    const id = deactivateTarget.id;
    setDeactivateTarget(null);
    setDeactivating(true);
    try {
      await api.updateScholarshipStatus(id, 'inactive');
      refetchScholarships();
      toast.success('Scholarship deactivated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to deactivate scholarship');
    } finally {
      setDeactivating(false);
    }
  };

  const assignScholarship = async () => {
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
      .filter((studentId) => !activeAssignmentKeySet.has(`${studentId}::${assignmentForm.scholarshipId}`));

    if (toCreate.length === 0) {
      toast.info('Selected students are already assigned to this scholarship');
      return;
    }

    setAssigning(true);
    try {
      for (const studentId of toCreate) {
        await api.createScholarshipAssignment({
          studentId,
          scholarshipId: assignmentForm.scholarshipId,
          effectiveFrom: assignmentForm.effectiveFrom,
        });
      }
      refetchAssignments();
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to assign scholarship');
    } finally {
      setAssigning(false);
    }
  };

  const unassignScholarship = async (assignmentId: string) => {
    setUnassigningId(assignmentId);
    try {
      await api.updateScholarshipAssignment(assignmentId, 'inactive');
      refetchAssignments();
      toast.success('Scholarship assignment removed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to remove assignment');
    } finally {
      setUnassigningId(null);
    }
  };

  const toggleScholarshipAssignments = (scholarshipId: string) => {
    setExpandedScholarshipId((current) => {
      const next = current === scholarshipId ? null : scholarshipId;
      setAssignmentSearchTerm('');
      setAssignmentClassFilter('all');
      return next;
    });
  };

  const getFilteredScholarshipStudents = (scholarshipId: string) => {
    const baseRows = assignmentRowsByScholarship[scholarshipId] || [];
    const query = assignmentSearchTerm.trim().toLowerCase();

    return baseRows.filter((row) => {
      const matchesSearch =
        !query ||
        row.student.name.toLowerCase().includes(query) ||
        row.student.rollNumber.toLowerCase().includes(query) ||
        row.student.consumerNumber.includes(assignmentSearchTerm);

      const matchesClass = assignmentClassFilter === 'all' || row.student.class === assignmentClassFilter;

      return matchesSearch && matchesClass;
    });
  };

  if (scholarshipsLoading || studentsLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

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

                <Button onClick={assignScholarship} className="w-full" disabled={assigning}>
                  {assigning ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Assigning…</> : 'Assign Scholarship'}
                </Button>
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
                <Button onClick={handleCreate} className="w-full" disabled={saving}>
                  {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</> : 'Create'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="table-container">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <p className="text-sm font-semibold">Scholarships</p>
          <p className="text-xs text-muted-foreground">{assignmentRows.length} mapped students</p>
        </div>
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
            {activeScholarshipsWithAssignments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  No scholarships found. Create one using the button above.
                </TableCell>
              </TableRow>
            ) : (
              activeScholarshipsWithAssignments.map(({ scholarship, assignedCount }) => {
                const isExpanded = expandedScholarshipId === scholarship.id;
                const filteredRows = isExpanded ? getFilteredScholarshipStudents(scholarship.id) : [];
                return (
                  <Fragment key={scholarship.id}>
                    <TableRow>
                      <TableCell className="font-medium">{scholarship.name}</TableCell>
                      <TableCell className="capitalize">{scholarship.type}</TableCell>
                      <TableCell>{scholarship.type === 'percentage' ? `${scholarship.value}%` : `₨ ${scholarship.value.toLocaleString()}`}</TableCell>
                      <TableCell className="text-sm">{scholarship.isLifetime ? 'Lifetime (until deactivated)' : `${scholarship.startDate} to ${scholarship.endDate || '-'}`}</TableCell>
                      <TableCell className="font-mono text-sm">{assignedCount}</TableCell>
                      <TableCell><StatusBadge status={scholarship.status} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 justify-end">
                          <Button variant="outline" size="sm" className="h-8" onClick={() => setDeactivateTarget(scholarship)} disabled={scholarship.status === 'inactive' || deactivating}>
                            {deactivating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Power className="w-3.5 h-3.5 mr-1.5" />}Deactivate
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => toggleScholarshipAssignments(scholarship.id)}
                            aria-label={isExpanded ? 'Collapse assigned students' : 'Expand assigned students'}
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/30 py-4">
                          <div className="space-y-4 px-1">
                            <div className="flex flex-col md:flex-row gap-2">
                              <div className="relative flex-1">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                  value={assignmentSearchTerm}
                                  className="pl-10 h-10 rounded-xl bg-background"
                                  placeholder="Search assigned students by name, roll #, CNIC, or consumer #"
                                  onChange={(e) => setAssignmentSearchTerm(e.target.value)}
                                />
                              </div>
                              <div className="w-full md:w-56">
                                <Select value={assignmentClassFilter} onValueChange={setAssignmentClassFilter}>
                                  <SelectTrigger className="h-10 rounded-xl bg-background"><SelectValue placeholder="Filter class" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">All Classes</SelectItem>
                                    {expandedScholarshipClassOptions.map((className) => (
                                      <SelectItem key={className} value={className}>{className}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Student</TableHead>
                                  <TableHead>Class</TableHead>
                                  <TableHead>Roll #</TableHead>
                                  <TableHead>Effective From</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {filteredRows.length === 0 ? (
                                  <TableRow>
                                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                                      No assigned students match your filters.
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  filteredRows.map((row) => (
                                    <TableRow key={row.assignment.id}>
                                      <TableCell className="font-medium">{row.student.name}</TableCell>
                                      <TableCell>{row.student.class} {row.student.section}</TableCell>
                                      <TableCell>{row.student.rollNumber}</TableCell>
                                      <TableCell>{row.assignment.effectiveFrom}</TableCell>
                                      <TableCell><StatusBadge status={row.assignment.status} /></TableCell>
                                      <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" className="h-8 text-destructive" onClick={() => unassignScholarship(row.assignment.id)} disabled={unassigningId === row.assignment.id}>
                                          {unassigningId === row.assignment.id ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <X className="w-3.5 h-3.5 mr-1.5" />}Unassign
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))
                                )}
                              </TableBody>
                            </Table>
                            {studentDirectory.length > 10 && (
                              <p className="text-[11px] text-muted-foreground px-1">Showing 10 of {studentDirectory.length} students. Use the search to find more.</p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deactivateTarget} onOpenChange={(open) => { if (!open) setDeactivateTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Scholarship</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate <span className="font-semibold">{deactivateTarget?.name}</span>?
              All active assignments under this scholarship will stop applying from the next billing cycle.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deactivateScholarship} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Scholarships;
