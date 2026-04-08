import { useState, useRef, useMemo, useEffect } from 'react';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { Student, StudentFinancialSnapshot, StudentScholarshipAssignment } from '@/types';
import { FilterBar } from '@/components/FilterBar';
import { ExportButton } from '@/components/ExportButton';
import { TablePagination } from '@/components/TablePagination';
import { EmptyState } from '@/components/EmptyState';
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
import { Plus, Upload, Download, FileText, Users, GraduationCap, Eye, Pencil, Trash2, Loader2 } from 'lucide-react';
import { formatCNIC, formatPhone, formatPKR } from '@/lib/formatters';
import { useNavigate } from 'react-router-dom';

const allClasses = ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];
const alphabetSections = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
const riskStyleMap: Record<StudentFinancialSnapshot['riskTier'], string> = {
  current: 'bg-success/10 text-success',
  watch: 'bg-warning/10 text-warning',
  'high-risk': 'bg-destructive/10 text-destructive',
  critical: 'bg-destructive text-destructive-foreground',
};

type StudentFormState = {
  name: string;
  fatherName: string;
  rollNumber: string;
  class: string;
  section: string;
  phone: string;
  cnic: string;
  gender: 'male' | 'female';
  dateOfBirth: string;
  address: string;
  usesBusService: boolean;
  busServiceStartMonth: string;
  busMonthlyFee: string;
};

const currentMonthKey = () => new Date().toISOString().slice(0, 7);

const emptyStudentForm: StudentFormState = {
  name: '',
  fatherName: '',
  rollNumber: '',
  class: 'Class 1',
  section: 'A',
  phone: '',
  cnic: '',
  gender: 'male',
  dateOfBirth: '',
  address: '',
  usesBusService: false,
  busServiceStartMonth: currentMonthKey(),
  busMonthlyFee: '1500',
};

const toStudentForm = (student: Student): StudentFormState => ({
  name: student.name,
  fatherName: student.fatherName,
  rollNumber: student.rollNumber,
  class: student.class,
  section: student.section,
  phone: student.phone,
  cnic: student.cnic,
  gender: student.gender,
  dateOfBirth: student.dateOfBirth,
  address: student.address,
  usesBusService: student.usesBusService,
  busServiceStartMonth: student.busServiceStartMonth || currentMonthKey(),
  busMonthlyFee: String(student.busMonthlyFee > 0 ? student.busMonthlyFee : 1500),
});

const StudentList = () => {
  const { data: studentsData, loading: studentsLoading, refetch } = useApiQuery(() => api.fetchStudents({ pageSize: 9999 }), []);
  const { data: scholarshipAssignmentsData } = useApiQuery(() => api.fetchAllScholarshipAssignments(), []);
  const [studentList, setStudentList] = useState<Student[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (studentsData) setStudentList(studentsData as Student[]);
  }, [studentsData]);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [defaulterFilter, setDefaulterFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [scholarshipFilter, setScholarshipFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [form, setForm] = useState<StudentFormState>(emptyStudentForm);
  const [editForm, setEditForm] = useState<StudentFormState>(emptyStudentForm);
  const [studentBeingEdited, setStudentBeingEdited] = useState<Student | null>(null);
  const [studentBeingDeleted, setStudentBeingDeleted] = useState<Student | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const refreshStudents = () => {
    refetch();
  };

  const classSummary = useMemo(() => {
    const map: Record<string, number> = {};
    studentList.forEach((s) => { map[s.class] = (map[s.class] || 0) + 1; });
    return allClasses.map((c) => ({ name: c, count: map[c] || 0 }));
  }, [studentList]);

  const classSectionSummary = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    studentList.forEach((s) => {
      if (!map[s.class]) map[s.class] = {};
      map[s.class][s.section] = (map[s.class][s.section] || 0) + 1;
    });
    return map;
  }, [studentList]);

  const classSections = useMemo(() => {
    if (selectedClass === 'all') return [];
    const sectionMap = classSectionSummary[selectedClass] || {};
    return Object.entries(sectionMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, count }));
  }, [classSectionSummary, selectedClass]);

  const { data: financialSummaryData } = useApiQuery(() => api.fetchStudentFinancialSummary(), []);

  const scholarshipCountByStudentId = useMemo(() => {
    const assignments = (scholarshipAssignmentsData || []) as StudentScholarshipAssignment[];
    const map: Record<string, number> = {};
    assignments.forEach((a) => {
      if (a.status === 'active') {
        map[a.studentId] = (map[a.studentId] || 0) + 1;
      }
    });
    return map;
  }, [scholarshipAssignmentsData]);

  const financialByStudentId = useMemo(() => {
    const summaries = (financialSummaryData || []) as import('@/types').StudentFinancialSummary[];
    const summaryMap: Record<string, import('@/types').StudentFinancialSummary> = {};
    summaries.forEach((s) => { summaryMap[s.studentId] = s; });

    const map: Record<string, StudentFinancialSnapshot> = {};
    studentList.forEach((student) => {
      const s = summaryMap[student.id];
      const overdueMonths = s ? (Number(s.overdueMonths) || 0) : 0;
      const totalDue = s ? (parseFloat(String(s.totalDue)) || 0) : 0;
      map[student.id] = {
        studentId: student.id,
        overdueMonths,
        totalDue,
        lastPaymentDate: null,
        scholarshipCount: scholarshipCountByStudentId[student.id] || 0,
        riskTier: overdueMonths >= 3 ? 'critical' : overdueMonths >= 2 ? 'high-risk' : overdueMonths >= 1 ? 'watch' : 'current',
      };
    });
    return map;
  }, [studentList, financialSummaryData, scholarshipCountByStudentId]);

  const filtered = studentList.filter((s) => {
    const financial = financialByStudentId[s.id] || {
      studentId: s.id,
      overdueMonths: 0,
      totalDue: 0,
      lastPaymentDate: null,
      scholarshipCount: 0,
      riskTier: 'current' as const,
    };
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.consumerNumber.includes(search) || s.cnic.includes(search) || s.rollNumber.toLowerCase().includes(search.toLowerCase());
    const matchClass = selectedClass === 'all' || s.class === selectedClass;
    const matchSection = selectedSection === 'all' || s.section === selectedSection;
    const matchDefaulter = defaulterFilter === 'all' || (defaulterFilter === 'with_due' ? financial.totalDue > 0 : financial.overdueMonths >= 3);
    const matchRisk = riskFilter === 'all' || financial.riskTier === riskFilter;
    const matchScholarship = scholarshipFilter === 'all' || (scholarshipFilter === 'with' ? financial.scholarshipCount > 0 : financial.scholarshipCount === 0);
    return matchSearch && matchClass && matchSection && matchDefaulter && matchRisk && matchScholarship;
  });

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleAdd = async () => {
    if (form.usesBusService && (!form.busServiceStartMonth || Number(form.busMonthlyFee) <= 0)) {
      toast.error('Set bus start month and valid monthly bus fee');
      return;
    }

    try {
      const result = await api.createStudent({
        name: form.name,
        fatherName: form.fatherName,
        rollNumber: form.rollNumber,
        class: form.class,
        section: form.section,
        phone: form.phone,
        cnic: form.cnic,
        status: 'active',
        billerId: '1',
        balance: 0,
        admissionDate: new Date().toISOString().split('T')[0],
        gender: form.gender,
        dateOfBirth: form.dateOfBirth,
        address: form.address,
        usesBusService: form.usesBusService,
        busServiceStartMonth: form.usesBusService ? form.busServiceStartMonth : null,
        busServiceEndMonth: null,
        busMonthlyFee: form.usesBusService ? Number(form.busMonthlyFee) : 0,
      });
      if (result.data) {
        setStudentList((prev) => [result.data as Student, ...prev]);
      }
      void refreshStudents();
      setDialogOpen(false);
      setForm(emptyStudentForm);
      toast.success(`Student added to ${form.class}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to add student');
    }
  };

  const openEditStudent = (student: Student) => {
    setStudentBeingEdited(student);
    setEditForm(toStudentForm(student));
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!studentBeingEdited) return;

    if (!editForm.name || !editForm.fatherName || !editForm.cnic) {
      toast.error('Name, father name, and CNIC are required');
      return;
    }

    if (editForm.usesBusService && (!editForm.busServiceStartMonth || Number(editForm.busMonthlyFee) <= 0)) {
      toast.error('Set bus start month and valid monthly bus fee');
      return;
    }

    const nowUsesBus = editForm.usesBusService;
    const wasUsingBus = studentBeingEdited.usesBusService;

    try {
      const updateResult = await api.updateStudent(studentBeingEdited.id, {
        name: editForm.name,
        fatherName: editForm.fatherName,
        rollNumber: editForm.rollNumber,
        class: editForm.class,
        section: editForm.section,
        phone: editForm.phone,
        cnic: editForm.cnic,
        gender: editForm.gender,
        dateOfBirth: editForm.dateOfBirth,
        address: editForm.address,
        usesBusService: nowUsesBus,
        busServiceStartMonth: nowUsesBus ? editForm.busServiceStartMonth : studentBeingEdited.busServiceStartMonth,
        busServiceEndMonth: nowUsesBus ? null : (wasUsingBus ? (studentBeingEdited.busServiceEndMonth || currentMonthKey()) : studentBeingEdited.busServiceEndMonth),
        busMonthlyFee: nowUsesBus ? Number(editForm.busMonthlyFee) : studentBeingEdited.busMonthlyFee,
      });
      if (updateResult.data) {
        setStudentList((prev) => prev.map((s) => s.id === studentBeingEdited.id ? updateResult.data as Student : s));
      }
      void refreshStudents();
      setEditDialogOpen(false);
      setStudentBeingEdited(null);
      setEditForm(emptyStudentForm);
      toast.success('Student profile updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update student');
    }
  };

  const openDeleteStudent = (student: Student) => {
    setStudentBeingDeleted(student);
    setDeleteDialogOpen(true);
  };

  const handleDeleteStudent = async () => {
    if (!studentBeingDeleted) return;

    try {
      await api.deleteStudent(studentBeingDeleted.id);
      setStudentList((prev) => {
        const next = prev.filter((s) => s.id !== studentBeingDeleted.id);
        const maxPage = Math.max(1, Math.ceil(next.length / pageSize));
        setPage((currentPage) => Math.min(currentPage, maxPage));
        return next;
      });
      void refreshStudents();
      toast.success(`${studentBeingDeleted.name} deleted`);
      setStudentBeingDeleted(null);
      setDeleteDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete student');
    }
  };

  const handleBulkUpload = async () => {
    const sampleStudents = [
      { name: 'Ali Hassan', fatherName: 'Hassan Ali', class: 'Class 5', section: 'E', gender: 'male' as const, dateOfBirth: '2012-01-15', phone: '0300-0000001', cnic: '35201-9000000-0' },
      { name: 'Ayesha Siddiqui', fatherName: 'Siddiqui Sahib', class: 'Class 6', section: 'A', gender: 'female' as const, dateOfBirth: '2012-02-15', phone: '0300-0000002', cnic: '35201-9000001-1' },
      { name: 'Hamza Tariq', fatherName: 'Tariq Khan', class: 'Class 7', section: 'B', gender: 'male' as const, dateOfBirth: '2012-03-15', phone: '0300-0000003', cnic: '35201-9000002-2' },
      { name: 'Maryam Ahmed', fatherName: 'Ahmed Raza', class: 'Class 8', section: 'C', gender: 'female' as const, dateOfBirth: '2012-04-15', phone: '0300-0000004', cnic: '35201-9000003-3' },
      { name: 'Usman Ghani', fatherName: 'Ghani Muhammad', class: 'Class 9', section: 'D', gender: 'male' as const, dateOfBirth: '2012-05-15', phone: '0300-0000005', cnic: '35201-9000004-4' },
    ];

    try {
      for (const s of sampleStudents) {
        const usesBus = sampleStudents.indexOf(s) % 2 === 0;
        await api.createStudent({
          ...s,
          rollNumber: `R${String(studentList.length + sampleStudents.indexOf(s) + 1).padStart(4, '0')}`,
          status: 'active',
          billerId: '1',
          balance: 0,
          admissionDate: '2025-03-01',
          address: `House ${sampleStudents.indexOf(s) + 1}, Peshawar`,
          usesBusService: usesBus,
          busServiceStartMonth: usesBus ? '2025-01' : null,
          busServiceEndMonth: null,
          busMonthlyFee: usesBus ? 1500 : 0,
        });
      }
      refreshStudents();
      setBulkDialogOpen(false);
      toast.success('5 students imported and assigned to their classes');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bulk import failed');
    }
  };

  const downloadTemplate = () => {
    const csv = 'Name,Father Name,Roll Number,Class,Section,Phone,CNIC,Gender,Date of Birth,Address,Bus Service,Bus Start Month,Bus Monthly Fee\nAli Hassan,Hassan Ali,R0001,Class 5,A,0300-1234567,35201-1234567-1,male,2012-05-15,House 1 Peshawar,yes,2025-01,1500\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'student_import_template.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('Template downloaded');
  };

  if (studentsLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Students</h1>
          <p className="page-description">Manage enrolled students organized by class • {studentList.length} total</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ExportButton data={filtered.map((s) => {
            const financial = financialByStudentId[s.id];
            return {
              Name: s.name,
              Father: s.fatherName,
              Class: s.class,
              Section: s.section,
              CNIC: s.cnic,
              Phone: s.phone,
              Balance: financial?.totalDue || 0,
              OverdueMonths: financial?.overdueMonths || 0,
              Risk: financial?.riskTier || 'current',
              Scholarships: financial?.scholarshipCount || 0,
              LastPayment: financial?.lastPaymentDate || '-',
            };
          })} filename="students" />
          <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-lg"><Upload className="w-4 h-4 mr-1.5" />Bulk Import</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Import Students in Bulk</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="rounded-xl border-2 border-dashed border-border p-8 text-center">
                  <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-semibold">Upload CSV file</p>
                  <p className="text-xs text-muted-foreground mt-1">Name, Father Name, Roll #, Class, Section, Phone, CNIC, Bus Service, Bus Start Month, Bus Monthly Fee</p>
                  <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={() => handleBulkUpload()} />
                  <Button variant="outline" size="sm" className="mt-4 rounded-lg" onClick={() => fileInputRef.current?.click()}>Choose File</Button>
                </div>
                <Button variant="ghost" size="sm" className="w-full" onClick={downloadTemplate}><Download className="w-4 h-4 mr-1.5" />Download CSV Template</Button>
                <Button onClick={handleBulkUpload} className="w-full rounded-lg">Simulate Bulk Import (5 Students)</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-lg"><Plus className="w-4 h-4 mr-1.5" />Add Student</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Add Student</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label className="text-xs font-semibold">Full Name *</Label><Input className="h-10 rounded-xl" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ahmed Khan" /></div>
                  <div className="space-y-2"><Label className="text-xs font-semibold">Father Name *</Label><Input className="h-10 rounded-xl" value={form.fatherName} onChange={(e) => setForm({ ...form, fatherName: e.target.value })} placeholder="Muhammad Khan" /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2"><Label className="text-xs font-semibold">Roll Number</Label><Input className="h-10 rounded-xl" value={form.rollNumber} onChange={(e) => setForm({ ...form, rollNumber: e.target.value })} placeholder="R0001" /></div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Class *</Label>
                    <Select value={form.class} onValueChange={(v) => setForm({ ...form, class: v })}>
                      <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>{allClasses.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Section</Label>
                    <Select value={form.section} onValueChange={(v) => setForm({ ...form, section: v })}>
                      <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>{alphabetSections.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label className="text-xs font-semibold">CNIC / B-Form *</Label><Input className="h-10 rounded-xl font-mono" value={form.cnic} onChange={(e) => setForm({ ...form, cnic: formatCNIC(e.target.value) })} placeholder="35201-1234567-1" maxLength={15} /></div>
                  <div className="space-y-2"><Label className="text-xs font-semibold">Phone *</Label><Input className="h-10 rounded-xl font-mono" value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })} placeholder="0300-1234567" maxLength={12} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Gender</Label>
                    <Select value={form.gender} onValueChange={(v: 'male' | 'female') => setForm({ ...form, gender: v })}>
                      <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label className="text-xs font-semibold">Date of Birth</Label><Input type="date" className="h-10 rounded-xl" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} /></div>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border p-3">
                  <Checkbox
                    id="bus-service"
                    checked={form.usesBusService}
                    onCheckedChange={(checked) => setForm({ ...form, usesBusService: checked === true })}
                  />
                  <Label htmlFor="bus-service" className="text-sm">Bus service required for this student</Label>
                </div>
                {form.usesBusService && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Bus Start Month</Label>
                      <Input
                        type="month"
                        className="h-10 rounded-xl"
                        value={form.busServiceStartMonth}
                        onChange={(e) => setForm({ ...form, busServiceStartMonth: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Bus Monthly Fee (Rs)</Label>
                      <Input
                        type="number"
                        min={0}
                        className="h-10 rounded-xl"
                        value={form.busMonthlyFee}
                        onChange={(e) => setForm({ ...form, busMonthlyFee: e.target.value })}
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-2"><Label className="text-xs font-semibold">Address</Label><Input className="h-10 rounded-xl" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="House #, Street, City" /></div>
                <Button onClick={handleAdd} className="w-full h-10 rounded-xl" disabled={!form.name || !form.fatherName || !form.cnic}>Add Student</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog
            open={editDialogOpen}
            onOpenChange={(open) => {
              setEditDialogOpen(open);
              if (!open) {
                setStudentBeingEdited(null);
              }
            }}
          >
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Edit Student</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label className="text-xs font-semibold">Full Name *</Label><Input className="h-10 rounded-xl" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Ahmed Khan" /></div>
                  <div className="space-y-2"><Label className="text-xs font-semibold">Father Name *</Label><Input className="h-10 rounded-xl" value={editForm.fatherName} onChange={(e) => setEditForm({ ...editForm, fatherName: e.target.value })} placeholder="Muhammad Khan" /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2"><Label className="text-xs font-semibold">Roll Number</Label><Input className="h-10 rounded-xl" value={editForm.rollNumber} onChange={(e) => setEditForm({ ...editForm, rollNumber: e.target.value })} placeholder="R0001" /></div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Class *</Label>
                    <Select value={editForm.class} onValueChange={(v) => setEditForm({ ...editForm, class: v })}>
                      <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>{allClasses.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Section</Label>
                    <Select value={editForm.section} onValueChange={(v) => setEditForm({ ...editForm, section: v })}>
                      <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>{alphabetSections.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label className="text-xs font-semibold">CNIC / B-Form *</Label><Input className="h-10 rounded-xl font-mono" value={editForm.cnic} onChange={(e) => setEditForm({ ...editForm, cnic: formatCNIC(e.target.value) })} placeholder="35201-1234567-1" maxLength={15} /></div>
                  <div className="space-y-2"><Label className="text-xs font-semibold">Phone *</Label><Input className="h-10 rounded-xl font-mono" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: formatPhone(e.target.value) })} placeholder="0300-1234567" maxLength={12} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Gender</Label>
                    <Select value={editForm.gender} onValueChange={(v: 'male' | 'female') => setEditForm({ ...editForm, gender: v })}>
                      <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label className="text-xs font-semibold">Date of Birth</Label><Input type="date" className="h-10 rounded-xl" value={editForm.dateOfBirth} onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })} /></div>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border p-3">
                  <Checkbox
                    id="edit-bus-service"
                    checked={editForm.usesBusService}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, usesBusService: checked === true })}
                  />
                  <Label htmlFor="edit-bus-service" className="text-sm">Bus service required for this student</Label>
                </div>
                {editForm.usesBusService && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Bus Start Month</Label>
                      <Input
                        type="month"
                        className="h-10 rounded-xl"
                        value={editForm.busServiceStartMonth}
                        onChange={(e) => setEditForm({ ...editForm, busServiceStartMonth: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Bus Monthly Fee (Rs)</Label>
                      <Input
                        type="number"
                        min={0}
                        className="h-10 rounded-xl"
                        value={editForm.busMonthlyFee}
                        onChange={(e) => setEditForm({ ...editForm, busMonthlyFee: e.target.value })}
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-2"><Label className="text-xs font-semibold">Address</Label><Input className="h-10 rounded-xl" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} placeholder="House #, Street, City" /></div>
                <Button onClick={handleSaveEdit} className="w-full h-10 rounded-xl" disabled={!studentBeingEdited || !editForm.name || !editForm.fatherName || !editForm.cnic}>Save Changes</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-11 gap-2">
        <button onClick={() => { setSelectedClass('all'); setSelectedSection('all'); setPage(1); }} className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all text-center ${selectedClass === 'all' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/30 bg-card'}`}>
          <Users className={`w-4 h-4 ${selectedClass === 'all' ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className="text-[11px] font-semibold">All</span>
          <span className="text-[10px] text-muted-foreground font-mono">{studentList.length}</span>
        </button>
        {classSummary.map((c) => (
          <button key={c.name} onClick={() => { setSelectedClass(c.name); setSelectedSection('all'); setPage(1); }} className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all text-center ${selectedClass === c.name ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/30 bg-card'}`}>
            <GraduationCap className={`w-4 h-4 ${selectedClass === c.name ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className="text-[11px] font-semibold">{c.name.replace('Class ', 'C')}</span>
            <span className="text-[10px] text-muted-foreground font-mono">{c.count}</span>
          </button>
        ))}
      </div>

      {selectedClass !== 'all' && (
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-10 gap-2">
          <button
            onClick={() => { setSelectedSection('all'); setPage(1); }}
            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border transition-all text-sm ${selectedSection === 'all' ? 'border-primary bg-primary/5 text-primary shadow-sm' : 'border-border hover:border-primary/30 bg-card text-muted-foreground'}`}
          >
            <span className="font-semibold">All Sections</span>
            <span className="font-mono text-xs">{classSummary.find((c) => c.name === selectedClass)?.count || 0}</span>
          </button>
          {classSections.map((section) => (
            <button
              key={section.name}
              onClick={() => { setSelectedSection(section.name); setPage(1); }}
              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border transition-all text-sm ${selectedSection === section.name ? 'border-primary bg-primary/5 text-primary shadow-sm' : 'border-border hover:border-primary/30 bg-card text-muted-foreground'}`}
            >
              <span className="font-semibold">{section.name}</span>
              <span className="font-mono text-xs">{section.count}</span>
            </button>
          ))}
        </div>
      )}

      <FilterBar
        searchPlaceholder="Search by name, CNIC, roll number..."
        onSearch={(v) => { setSearch(v); setPage(1); }}
        filters={[
          {
            key: 'defaulters',
            label: 'Defaulters',
            options: [
              { value: 'with_due', label: 'With Due' },
              { value: 'due_3plus', label: '3+ Months Due' },
            ],
          },
          {
            key: 'risk',
            label: 'Risk Tier',
            options: [
              { value: 'current', label: 'Current' },
              { value: 'watch', label: 'Watch' },
              { value: 'high-risk', label: 'High Risk' },
              { value: 'critical', label: 'Critical' },
            ],
          },
          {
            key: 'scholarship',
            label: 'Scholarship',
            options: [
              { value: 'with', label: 'Has Scholarship' },
              { value: 'without', label: 'No Scholarship' },
            ],
          },
        ]}
        onFilterChange={(key, value) => {
          if (key === 'defaulters') setDefaulterFilter(value);
          if (key === 'risk') setRiskFilter(value);
          if (key === 'scholarship') setScholarshipFilter(value);
          setPage(1);
        }}
      />

      <div className="table-container">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <p className="text-sm font-semibold">
            {selectedClass === 'all'
              ? 'All Students'
              : selectedSection === 'all'
                ? `${selectedClass} • All Sections`
                : `${selectedClass} • Section ${selectedSection}`}
            <span className="text-muted-foreground font-normal ml-2">({filtered.length})</span>
          </p>
        </div>
        {paginated.length === 0 ? (
          <EmptyState icon={GraduationCap} title="No students found" description="No students match your search criteria. Try adjusting your filters." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold">Name</TableHead>
                <TableHead className="text-xs font-semibold">Father Name</TableHead>
                <TableHead className="text-xs font-semibold">Roll #</TableHead>
                <TableHead className="text-xs font-semibold">Class</TableHead>
                <TableHead className="text-xs font-semibold">CNIC</TableHead>
                <TableHead className="text-xs font-semibold">Phone</TableHead>
                <TableHead className="text-xs font-semibold">Balance</TableHead>
                <TableHead className="text-xs font-semibold">Overdue</TableHead>
                <TableHead className="text-xs font-semibold">Scholarships</TableHead>
                <TableHead className="text-xs font-semibold">Risk</TableHead>
                <TableHead className="text-xs font-semibold">Last Payment</TableHead>
                <TableHead className="text-xs font-semibold w-[140px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((s) => {
                const financial = financialByStudentId[s.id] || {
                  studentId: s.id,
                  overdueMonths: 0,
                  totalDue: 0,
                  lastPaymentDate: null,
                  scholarshipCount: 0,
                  riskTier: 'current' as const,
                };

                return (
                  <TableRow key={s.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/school/fee-ledger?student=${s.id}`)}>
                    <TableCell className="font-medium text-sm">{s.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.fatherName}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{s.rollNumber}</TableCell>
                    <TableCell><span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-md">{s.class} {s.section}</span></TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{s.cnic}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.phone}</TableCell>
                    <TableCell className={`font-mono text-sm ${financial.totalDue > 0 ? 'text-destructive font-semibold' : 'text-success'}`}>{formatPKR(financial.totalDue)}</TableCell>
                    <TableCell className={`font-mono text-xs ${financial.overdueMonths >= 3 ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                      {financial.overdueMonths} mo
                    </TableCell>
                    <TableCell className="font-mono text-xs">{financial.scholarshipCount}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold capitalize ${riskStyleMap[financial.riskTier]}`}>
                        {financial.riskTier}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{financial.lastPaymentDate || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/school/fee-ledger?student=${s.id}`);
                          }}
                        >
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditStudent(s);
                          }}
                        >
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteStudent(s);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <AlertDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) {
              setStudentBeingDeleted(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Student?</AlertDialogTitle>
              <AlertDialogDescription>
                {studentBeingDeleted
                  ? `This will permanently remove ${studentBeingDeleted.name} from the student directory and related views.`
                  : 'This will permanently remove this student from the student directory and related views.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDeleteStudent}
              >
                Delete Student
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <TablePagination total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>
    </div>
  );
};

export default StudentList;
