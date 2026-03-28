import { useState, useRef } from 'react';
import { students as initialStudents, generateConsumerNumber } from '@/data/mockData';
import { Student } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterBar } from '@/components/FilterBar';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Upload, Download, FileText } from 'lucide-react';

const StudentList = () => {
  const [studentList, setStudentList] = useState<Student[]>(initialStudents.slice(0, 25));
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', rollNumber: '', class: '', phone: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = studentList.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) || s.consumerNumber.includes(search)
  );

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
    setForm({ name: '', rollNumber: '', class: '', phone: '' });
    toast.success(`Student added — Consumer#: ${newStudent.consumerNumber}`);
  };

  const handleBulkUpload = () => {
    // Simulate CSV parsing — add 5 mock students
    const newStudents: Student[] = [
      { id: `bulk-1`, name: 'Ali Hassan', rollNumber: 'R0100', class: 'Class 5', phone: '+92-300-0000001', consumerNumber: generateConsumerNumber('1001', String(studentList.length + 1)), status: 'active', billerId: '1' },
      { id: `bulk-2`, name: 'Ayesha Siddiqui', rollNumber: 'R0101', class: 'Class 6', phone: '+92-300-0000002', consumerNumber: generateConsumerNumber('1001', String(studentList.length + 2)), status: 'active', billerId: '1' },
      { id: `bulk-3`, name: 'Hamza Tariq', rollNumber: 'R0102', class: 'Class 7', phone: '+92-300-0000003', consumerNumber: generateConsumerNumber('1001', String(studentList.length + 3)), status: 'active', billerId: '1' },
      { id: `bulk-4`, name: 'Maryam Ahmed', rollNumber: 'R0103', class: 'Class 4', phone: '+92-300-0000004', consumerNumber: generateConsumerNumber('1001', String(studentList.length + 4)), status: 'active', billerId: '1' },
      { id: `bulk-5`, name: 'Usman Ghani', rollNumber: 'R0104', class: 'Class 8', phone: '+92-300-0000005', consumerNumber: generateConsumerNumber('1001', String(studentList.length + 5)), status: 'active', billerId: '1' },
    ];
    setStudentList([...studentList, ...newStudents]);
    setBulkDialogOpen(false);
    toast.success(`5 students imported successfully`);
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
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-header">Students</h1>
          <p className="page-description">Manage enrolled students and consumer numbers</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Upload className="w-3.5 h-3.5 mr-1.5" />Bulk Import
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Import Students in Bulk</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="rounded-lg border-2 border-dashed border-border p-6 text-center">
                  <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium">Upload CSV file</p>
                  <p className="text-xs text-muted-foreground mt-1">Columns: Name, Roll Number, Class, Phone</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={() => handleBulkUpload()}
                  />
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => fileInputRef.current?.click()}>
                    Choose File
                  </Button>
                </div>
                <Button variant="ghost" size="sm" className="w-full" onClick={downloadTemplate}>
                  <Download className="w-3.5 h-3.5 mr-1.5" />Download CSV Template
                </Button>
                <div className="rounded-md bg-muted/60 border p-3">
                  <p className="text-[11px] font-medium mb-1">Simulation mode</p>
                  <p className="text-[11px] text-muted-foreground">Click below to simulate importing 5 students from CSV.</p>
                </div>
                <Button onClick={handleBulkUpload} className="w-full">Simulate Bulk Import (5 Students)</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-3.5 h-3.5 mr-1.5" />Add Student</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Student</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Name</Label>
                  <Input className="h-9 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Roll Number</Label>
                  <Input className="h-9 text-sm" value={form.rollNumber} onChange={(e) => setForm({ ...form, rollNumber: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Class</Label>
                  <Input className="h-9 text-sm" value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Phone</Label>
                  <Input className="h-9 text-sm" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <Button onClick={handleAdd} className="w-full h-9 text-sm">Add Student</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <FilterBar searchPlaceholder="Search by name or consumer number…" onSearch={setSearch} />

      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Name</TableHead>
              <TableHead className="text-xs">Roll #</TableHead>
              <TableHead className="text-xs">Class</TableHead>
              <TableHead className="text-xs">Consumer Number</TableHead>
              <TableHead className="text-xs">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium text-sm">{s.name}</TableCell>
                <TableCell className="font-mono text-xs">{s.rollNumber}</TableCell>
                <TableCell className="text-sm">{s.class}</TableCell>
                <TableCell className="font-mono text-[11px] text-muted-foreground">{s.consumerNumber}</TableCell>
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
