import { useState, useRef, useMemo } from 'react';
import { students as initialStudents, generateConsumerNumber } from '@/data/mockData';
import { Student } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterBar } from '@/components/FilterBar';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Upload, Download, FileText, Users, ChevronRight, GraduationCap } from 'lucide-react';

const allClasses = ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];

const StudentList = () => {
  const [studentList, setStudentList] = useState<Student[]>(initialStudents);
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', rollNumber: '', class: 'Class 1', phone: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Group students by class
  const classSummary = useMemo(() => {
    const map: Record<string, number> = {};
    studentList.forEach((s) => {
      map[s.class] = (map[s.class] || 0) + 1;
    });
    return allClasses.map((c) => ({ name: c, count: map[c] || 0 }));
  }, [studentList]);

  const filtered = studentList.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.consumerNumber.includes(search);
    const matchClass = selectedClass === 'all' || s.class === selectedClass;
    return matchSearch && matchClass;
  });

  const handleAdd = () => {
    const num = String(studentList.length + 1);
    const newStudent: Student = {
      id: `s${studentList.length + 1}`,
      name: form.name,
      rollNumber: form.rollNumber,
      class: form.class,
      phone: form.phone,
      consumerNumber: generateConsumerNumber('1001', num),
      status: 'active',
      billerId: '1',
    };
    setStudentList([...studentList, newStudent]);
    setDialogOpen(false);
    setForm({ name: '', rollNumber: '', class: 'Class 1', phone: '' });
    toast.success(`Student added to ${form.class} — Consumer#: ${newStudent.consumerNumber}`);
  };

  const handleBulkUpload = () => {
    const classes = ['Class 5', 'Class 6', 'Class 7', 'Class 4', 'Class 8'];
    const newStudents: Student[] = [
      { id: `bulk-1`, name: 'Ali Hassan', rollNumber: 'R0100', class: classes[0], phone: '+92-300-0000001', consumerNumber: generateConsumerNumber('1001', String(studentList.length + 1)), status: 'active', billerId: '1' },
      { id: `bulk-2`, name: 'Ayesha Siddiqui', rollNumber: 'R0101', class: classes[1], phone: '+92-300-0000002', consumerNumber: generateConsumerNumber('1001', String(studentList.length + 2)), status: 'active', billerId: '1' },
      { id: `bulk-3`, name: 'Hamza Tariq', rollNumber: 'R0102', class: classes[2], phone: '+92-300-0000003', consumerNumber: generateConsumerNumber('1001', String(studentList.length + 3)), status: 'active', billerId: '1' },
      { id: `bulk-4`, name: 'Maryam Ahmed', rollNumber: 'R0103', class: classes[3], phone: '+92-300-0000004', consumerNumber: generateConsumerNumber('1001', String(studentList.length + 4)), status: 'active', billerId: '1' },
      { id: `bulk-5`, name: 'Usman Ghani', rollNumber: 'R0104', class: classes[4], phone: '+92-300-0000005', consumerNumber: generateConsumerNumber('1001', String(studentList.length + 5)), status: 'active', billerId: '1' },
    ];
    setStudentList([...studentList, ...newStudents]);
    setBulkDialogOpen(false);
    toast.success(`5 students imported and assigned to their classes`);
  };

  const downloadTemplate = () => {
    const csv = 'Name,Roll Number,Class,Phone\nJohn Doe,R0001,Class 5,+92-300-1234567\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Template downloaded');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Students</h1>
          <p className="page-description">Manage enrolled students organized by class • {studentList.length} total</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-lg">
                <Upload className="w-4 h-4 mr-1.5" />Bulk Import
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Import Students in Bulk</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="rounded-xl border-2 border-dashed border-border p-8 text-center">
                  <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-semibold">Upload CSV file</p>
                  <p className="text-xs text-muted-foreground mt-1">Columns: Name, Roll Number, Class, Phone</p>
                  <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={() => handleBulkUpload()} />
                  <Button variant="outline" size="sm" className="mt-4 rounded-lg" onClick={() => fileInputRef.current?.click()}>
                    Choose File
                  </Button>
                </div>
                <Button variant="ghost" size="sm" className="w-full" onClick={downloadTemplate}>
                  <Download className="w-4 h-4 mr-1.5" />Download CSV Template
                </Button>
                <div className="rounded-xl bg-muted/60 border p-3">
                  <p className="text-[11px] font-semibold mb-1">Simulation mode</p>
                  <p className="text-[11px] text-muted-foreground">Click below to simulate importing 5 students with class assignments.</p>
                </div>
                <Button onClick={handleBulkUpload} className="w-full rounded-lg">Simulate Bulk Import (5 Students)</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-lg"><Plus className="w-4 h-4 mr-1.5" />Add Student</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Student</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Full Name</Label>
                  <Input className="h-10 rounded-xl" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Roll Number</Label>
                    <Input className="h-10 rounded-xl" value={form.rollNumber} onChange={(e) => setForm({ ...form, rollNumber: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Class</Label>
                    <Select value={form.class} onValueChange={(v) => setForm({ ...form, class: v })}>
                      <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {allClasses.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Phone</Label>
                  <Input className="h-10 rounded-xl" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <Button onClick={handleAdd} className="w-full h-10 rounded-xl">Add Student</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Class cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
        <button
          onClick={() => setSelectedClass('all')}
          className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-center ${
            selectedClass === 'all' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/30 bg-card'
          }`}
        >
          <Users className={`w-4 h-4 ${selectedClass === 'all' ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className="text-[11px] font-semibold">All</span>
          <span className="text-[10px] text-muted-foreground font-mono">{studentList.length}</span>
        </button>
        {classSummary.map((c) => (
          <button
            key={c.name}
            onClick={() => setSelectedClass(c.name)}
            className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-center ${
              selectedClass === c.name ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/30 bg-card'
            }`}
          >
            <GraduationCap className={`w-4 h-4 ${selectedClass === c.name ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className="text-[11px] font-semibold">{c.name.replace('Class ', 'C')}</span>
            <span className="text-[10px] text-muted-foreground font-mono">{c.count}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <FilterBar searchPlaceholder="Search by name or consumer number…" onSearch={setSearch} />

      {/* Table */}
      <div className="table-container">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <p className="text-sm font-semibold">
            {selectedClass === 'all' ? 'All Students' : selectedClass}
            <span className="text-muted-foreground font-normal ml-2">({filtered.length} students)</span>
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-semibold">Name</TableHead>
              <TableHead className="text-xs font-semibold">Roll #</TableHead>
              <TableHead className="text-xs font-semibold">Class</TableHead>
              <TableHead className="text-xs font-semibold">Consumer Number</TableHead>
              <TableHead className="text-xs font-semibold">Phone</TableHead>
              <TableHead className="text-xs font-semibold">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((s) => (
              <TableRow key={s.id} className="hover:bg-muted/30">
                <TableCell className="font-medium text-sm">{s.name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{s.rollNumber}</TableCell>
                <TableCell>
                  <span className="text-xs font-medium bg-primary/8 text-primary px-2 py-0.5 rounded-md">{s.class}</span>
                </TableCell>
                <TableCell className="font-mono text-[11px] text-muted-foreground">{s.consumerNumber}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{s.phone}</TableCell>
                <TableCell><StatusBadge status={s.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default StudentList;
