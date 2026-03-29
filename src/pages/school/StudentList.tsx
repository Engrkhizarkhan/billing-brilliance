import { useState, useRef, useMemo } from 'react';
import { students as initialStudents, generateConsumerNumber } from '@/data/mockData';
import { Student } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterBar } from '@/components/FilterBar';
import { ExportButton } from '@/components/ExportButton';
import { TablePagination } from '@/components/TablePagination';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Upload, Download, FileText, Users, GraduationCap, Eye } from 'lucide-react';
import { formatCNIC, formatPhone, formatPKR } from '@/lib/formatters';
import { useNavigate } from 'react-router-dom';

const allClasses = ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];
const sections = ['A', 'B', 'C'];

const StudentList = () => {
  const [studentList, setStudentList] = useState<Student[]>(initialStudents);
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [form, setForm] = useState({ name: '', fatherName: '', rollNumber: '', class: 'Class 1', section: 'A', phone: '', cnic: '', gender: 'male' as 'male' | 'female', dateOfBirth: '', address: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const classSummary = useMemo(() => {
    const map: Record<string, number> = {};
    studentList.forEach((s) => { map[s.class] = (map[s.class] || 0) + 1; });
    return allClasses.map((c) => ({ name: c, count: map[c] || 0 }));
  }, [studentList]);

  const filtered = studentList.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.consumerNumber.includes(search) || s.cnic.includes(search) || s.rollNumber.toLowerCase().includes(search.toLowerCase());
    const matchClass = selectedClass === 'all' || s.class === selectedClass;
    return matchSearch && matchClass;
  });

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleAdd = () => {
    const num = String(studentList.length + 1);
    const newStudent: Student = {
      id: `s${studentList.length + 1}`,
      name: form.name,
      fatherName: form.fatherName,
      rollNumber: form.rollNumber,
      class: form.class,
      section: form.section,
      phone: form.phone,
      cnic: form.cnic,
      consumerNumber: generateConsumerNumber('1001', num),
      billId: `SCH-GHS-${num.padStart(5, '0')}`,
      status: 'active',
      billerId: '1',
      balance: 0,
      admissionDate: new Date().toISOString().split('T')[0],
      gender: form.gender,
      dateOfBirth: form.dateOfBirth,
      address: form.address,
    };
    setStudentList([...studentList, newStudent]);
    setDialogOpen(false);
    setForm({ name: '', fatherName: '', rollNumber: '', class: 'Class 1', section: 'A', phone: '', cnic: '', gender: 'male', dateOfBirth: '', address: '' });
    toast.success(`Student added to ${form.class} — Bill ID: ${newStudent.billId}`);
  };

  const handleBulkUpload = () => {
    const newStudents: Student[] = Array.from({ length: 5 }, (_, i) => {
      const idx = studentList.length + i + 1;
      return {
        id: `bulk-${idx}`,
        name: ['Ali Hassan', 'Ayesha Siddiqui', 'Hamza Tariq', 'Maryam Ahmed', 'Usman Ghani'][i],
        fatherName: ['Hassan Ali', 'Siddiqui Sahib', 'Tariq Khan', 'Ahmed Raza', 'Ghani Muhammad'][i],
        rollNumber: `R${String(idx).padStart(4, '0')}`,
        class: allClasses[(i + 4) % 10],
        section: sections[i % 3],
        phone: `0300-000000${i + 1}`,
        cnic: `35201-${String(9000000 + i)}-${i}`,
        consumerNumber: generateConsumerNumber('1001', String(idx)),
        billId: `SCH-GHS-${String(idx).padStart(5, '0')}`,
        status: 'active' as const,
        billerId: '1',
        balance: 0,
        admissionDate: '2025-03-01',
        gender: i % 2 === 0 ? 'male' as const : 'female' as const,
        dateOfBirth: `2012-0${i + 1}-15`,
        address: `House ${idx}, Street ${i + 1}, Peshawar`,
      };
    });
    setStudentList([...studentList, ...newStudents]);
    setBulkDialogOpen(false);
    toast.success('5 students imported and assigned to their classes');
  };

  const downloadTemplate = () => {
    const csv = 'Name,Father Name,Roll Number,Class,Section,Phone,CNIC,Gender,Date of Birth,Address\nAli Hassan,Hassan Ali,R0001,Class 5,A,0300-1234567,35201-1234567-1,male,2012-05-15,House 1 Peshawar\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'student_import_template.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('Template downloaded');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Students</h1>
          <p className="page-description">Manage enrolled students organized by class • {studentList.length} total</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ExportButton data={filtered.map(s => ({ Name: s.name, Father: s.fatherName, Class: s.class, Section: s.section, CNIC: s.cnic, Phone: s.phone, Balance: s.balance, Status: s.status }))} filename="students" />
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
                  <p className="text-xs text-muted-foreground mt-1">Name, Father Name, Roll #, Class, Section, Phone, CNIC</p>
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
                      <SelectContent>{sections.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
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
                <div className="space-y-2"><Label className="text-xs font-semibold">Address</Label><Input className="h-10 rounded-xl" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="House #, Street, City" /></div>
                <Button onClick={handleAdd} className="w-full h-10 rounded-xl" disabled={!form.name || !form.fatherName || !form.cnic}>Add Student</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-11 gap-2">
        <button onClick={() => { setSelectedClass('all'); setPage(1); }} className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all text-center ${selectedClass === 'all' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/30 bg-card'}`}>
          <Users className={`w-4 h-4 ${selectedClass === 'all' ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className="text-[11px] font-semibold">All</span>
          <span className="text-[10px] text-muted-foreground font-mono">{studentList.length}</span>
        </button>
        {classSummary.map((c) => (
          <button key={c.name} onClick={() => { setSelectedClass(c.name); setPage(1); }} className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all text-center ${selectedClass === c.name ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/30 bg-card'}`}>
            <GraduationCap className={`w-4 h-4 ${selectedClass === c.name ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className="text-[11px] font-semibold">{c.name.replace('Class ', 'C')}</span>
            <span className="text-[10px] text-muted-foreground font-mono">{c.count}</span>
          </button>
        ))}
      </div>

      <FilterBar searchPlaceholder="Search by name, CNIC, roll number…" onSearch={(v) => { setSearch(v); setPage(1); }} />

      <div className="table-container">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <p className="text-sm font-semibold">
            {selectedClass === 'all' ? 'All Students' : selectedClass}
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
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((s) => (
                <TableRow key={s.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/school/fee-ledger?student=${s.id}`)}>
                  <TableCell className="font-medium text-sm">{s.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.fatherName}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{s.rollNumber}</TableCell>
                  <TableCell><span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-md">{s.class} {s.section}</span></TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{s.cnic}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.phone}</TableCell>
                  <TableCell className={`font-mono text-sm ${s.balance > 0 ? 'text-destructive font-semibold' : 'text-success'}`}>{formatPKR(s.balance)}</TableCell>
                  <TableCell><StatusBadge status={s.status} /></TableCell>
                  <TableCell><Eye className="w-4 h-4 text-muted-foreground" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <TablePagination total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>
    </div>
  );
};

export default StudentList;
