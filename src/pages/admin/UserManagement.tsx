import { useState, useRef } from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterBar } from '@/components/FilterBar';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Ban, Upload, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface MockUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'banned';
}

const initialUsers: MockUser[] = [
  { id: '1', name: 'Admin User', email: 'admin@example.com', role: 'admin', status: 'active' },
  { id: '2', name: 'School Admin', email: 'school@example.com', role: 'school', status: 'active' },
  { id: '3', name: 'ETA Manager', email: 'eta@example.com', role: 'eta', status: 'active' },
  { id: '4', name: 'John Doe', email: 'john@school.com', role: 'school', status: 'active' },
  { id: '5', name: 'Jane Smith', email: 'jane@agency.com', role: 'eta', status: 'banned' },
];

const UserManagement = () => {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState('');
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = users.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  const banUser = (id: string) => {
    setUsers(users.map((u) => (u.id === id ? { ...u, status: 'banned' as const } : u)));
    toast.error('User has been banned');
  };

  const handleBulkUpload = () => {
    const newUsers: MockUser[] = [
      { id: `bulk-u1`, name: 'Saad Qureshi', email: 'saad@school.com', role: 'school', status: 'active' },
      { id: `bulk-u2`, name: 'Farah Naz', email: 'farah@agency.com', role: 'eta', status: 'active' },
      { id: `bulk-u3`, name: 'Kashif Raza', email: 'kashif@school.com', role: 'school', status: 'active' },
    ];
    setUsers([...users, ...newUsers]);
    setBulkDialogOpen(false);
    toast.success('3 users imported successfully');
  };

  const downloadTemplate = () => {
    const csv = 'Name,Email,Role\nJohn Doe,john@example.com,school\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'user_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Template downloaded');
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-header">User Management</h1>
          <p className="page-description">Manage platform users and permissions</p>
        </div>
        <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Upload className="w-3.5 h-3.5 mr-1.5" />Bulk Import
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Import Users in Bulk</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="rounded-lg border-2 border-dashed border-border p-6 text-center">
                <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium">Upload CSV file</p>
                <p className="text-xs text-muted-foreground mt-1">Columns: Name, Email, Role</p>
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
              <Button onClick={handleBulkUpload} className="w-full">Simulate Bulk Import (3 Users)</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <FilterBar searchPlaceholder="Search users…" onSearch={setSearch} />

      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Name</TableHead>
              <TableHead className="text-xs">Email</TableHead>
              <TableHead className="text-xs">Role</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium text-sm">{u.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                <TableCell className="capitalize text-sm">{u.role}</TableCell>
                <TableCell><StatusBadge status={u.status} /></TableCell>
                <TableCell>
                  {u.status !== 'banned' && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => banUser(u.id)}>
                      <Ban className="w-3 h-3 mr-1" /> Ban
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default UserManagement;
