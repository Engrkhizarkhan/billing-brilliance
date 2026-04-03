import { useEffect, useRef, useState } from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterBar } from '@/components/FilterBar';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Ban, Upload, Download, FileText, Plus, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { mockApi } from '@/lib/mockApi';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User } from '@/types';

const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    role: 'school' as User['role'],
    password: '',
    schoolRef: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const response = await mockApi.fetchUsers({});
      setUsers(response.data);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = users.filter((u) => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    const matchStatus = statusFilter === 'all' || u.status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  const banUser = async (id: string) => {
    setLoading(true);
    const updated = await mockApi.updateUserStatus(id, 'banned');
    if (updated.data) {
      setUsers((prev) => prev.map((u) => (u.id === id ? updated.data! : u)));
      toast.error('User has been banned');
    }
    setLoading(false);
  };

  const unbanUser = async (id: string) => {
    setLoading(true);
    const updated = await mockApi.updateUserStatus(id, 'active');
    if (updated.data) {
      setUsers((prev) => prev.map((u) => (u.id === id ? updated.data! : u)));
      toast.success('User reinstated');
    }
    setLoading(false);
  };

  const handleCreateUser = async () => {
    if (!createForm.name || !createForm.email) {
      toast.error('Name and email are required');
      return;
    }

    setLoading(true);
    try {
      const response = await mockApi.createUser({
        name: createForm.name,
        email: createForm.email,
        role: createForm.role,
        password: createForm.password || undefined,
        schoolRef: createForm.role === 'school' ? (createForm.schoolRef || undefined) : undefined,
      });
      setUsers((prev) => [...prev, response.data.user]);
      setCreateDialogOpen(false);
      setCreateForm({ name: '', email: '', role: 'school', password: '', schoolRef: '' });

      if (response.data.user.role === 'school') {
        toast.success(`School user created. Password: ${response.data.defaultPassword}. Ref: ${response.data.user.schoolRef}`);
      } else {
        toast.success(`User created. Password: ${response.data.defaultPassword}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpload = async () => {
    setLoading(true);
    const bulkPayload = [
      { name: 'Saad Qureshi', email: 'saad@school.com', role: 'school' as User['role'] },
      { name: 'Farah Naz', email: 'farah@agency.com', role: 'eta' as User['role'] },
      { name: 'Kashif Raza', email: 'kashif@school.com', role: 'school' as User['role'] },
    ];
    const created = await Promise.all(bulkPayload.map((u) => mockApi.createUser(u)));
    setUsers((prev) => [...prev, ...created.map((c) => c.data.user)]);
    setBulkDialogOpen(false);
    toast.success('3 users imported successfully (default passwords set)');
    setLoading(false);
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
          <p className="page-description">Manage platform users and permissions. New accounts get a default password and should reset on first login.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={loading}><Plus className="w-3.5 h-3.5 mr-1.5" />Add User</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create User</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={createForm.role} onValueChange={(v) => setCreateForm({ ...createForm, role: v as User['role'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="school">School</SelectItem>
                      <SelectItem value="eta">ETA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Password (optional)</Label>
                  <Input
                    type="password"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder="Leave empty to auto-generate"
                  />
                </div>
                {createForm.role === 'school' && (
                  <div className="space-y-2">
                    <Label>School Reference (optional)</Label>
                    <Input
                      value={createForm.schoolRef}
                      onChange={(e) => setCreateForm({ ...createForm, schoolRef: e.target.value })}
                      placeholder="e.g. SCH-1001 (leave empty for new)"
                    />
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Default password is generated per user and shown once on create.</p>
                <Button className="w-full" onClick={handleCreateUser} disabled={loading}>Create User</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={loading}>
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
                <Button onClick={handleBulkUpload} className="w-full" disabled={loading}>Simulate Bulk Import (3 Users)</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <FilterBar
        searchPlaceholder="Search users…"
        onSearch={setSearch}
        filters={[
          { key: 'role', label: 'Role', options: [{ value: 'admin', label: 'Admin' }, { value: 'school', label: 'School' }, { value: 'eta', label: 'ETA' }] },
          { key: 'status', label: 'Status', options: [{ value: 'active', label: 'Active' }, { value: 'banned', label: 'Banned' }] },
        ]}
        onFilterChange={(key, value) => {
          if (key === 'role') setRoleFilter(value);
          if (key === 'status') setStatusFilter(value);
        }}
      />

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <RefreshCcw className="w-3.5 h-3.5" /> Accounts are mock-only; ensure real flows enforce password reset on first login.
      </div>

      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Name</TableHead>
              <TableHead className="text-xs">Email</TableHead>
              <TableHead className="text-xs">Role</TableHead>
              <TableHead className="text-xs">Reference</TableHead>
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
                <TableCell className="font-mono text-xs text-muted-foreground">{u.schoolRef || '-'}</TableCell>
                <TableCell><StatusBadge status={u.status} /></TableCell>
                <TableCell>
                  {u.status !== 'banned' ? (
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => banUser(u.id)} disabled={loading}>
                      <Ban className="w-3 h-3 mr-1" /> Ban
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => unbanUser(u.id)} disabled={loading}>
                      <RefreshCcw className="w-3 h-3 mr-1" /> Unban
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
