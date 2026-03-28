import { useState } from 'react';
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
import { Plus } from 'lucide-react';

const StudentList = () => {
  const [studentList, setStudentList] = useState<Student[]>(initialStudents.slice(0, 25));
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', rollNumber: '', class: '', phone: '' });

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
    toast.success(`Student added. Consumer#: ${newStudent.consumerNumber}`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Students</h1>
          <p className="page-description">Manage enrolled students</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Add Student</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Student</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Roll Number</Label><Input value={form.rollNumber} onChange={(e) => setForm({ ...form, rollNumber: e.target.value })} /></div>
              <div><Label>Class</Label><Input value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <Button onClick={handleAdd} className="w-full">Add Student</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <FilterBar searchPlaceholder="Search by name or consumer number..." onSearch={setSearch} />

      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Roll #</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Consumer Number</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="font-mono">{s.rollNumber}</TableCell>
                <TableCell>{s.class}</TableCell>
                <TableCell className="font-mono text-xs">{s.consumerNumber}</TableCell>
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
