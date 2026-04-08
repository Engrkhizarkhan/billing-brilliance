import { useEffect, useRef, useState } from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterBar } from '@/components/FilterBar';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Ban, Upload, Download, FileText, Plus, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Biller, User } from '@/types';

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
    tenantId: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const { data: billersData } = useApiQuery(() => api.fetchBillers({ pageSize: 100 }), []);

  const billers = (billersData || []) as Biller[];
  const schoolTenants = billers.filter((b) => b.type === 'school');
  const eteaTenants = billers.filter((b) => b.type === 'etea');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const response = await api.fetchUsers({ pageSize: 100 });
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
    const updated = await api.updateUserStatus(id, 'banned');
    if (updated.data) {
      setUsers((prev) => prev.map((u) => (u.id === id ? updated.data! : u)));
      toast.error('User has been banned');
    }
    setLoading(false);
  };

  const unbanUser = async (id: string) => {
    setLoading(true);
    const updated = await api.updateUserStatus(id, 'active');
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

    if (createForm.role !== 'admin' && !createForm.tenantId) {
      toast.error('Please select a tenant for non-admin users');
      return;
    }

    setLoading(true);
    try {
      const response = await api.createUser({
        name: createForm.name,
        email: createForm.email,
        role: createForm.role,
        password: createForm.password || undefined,
        tenantId: createForm.role !== 'admin' ? createForm.tenantId : undefined,
      });
      setUsers((prev) => [...prev, response.data.user]);
      setCreateDialogOpen(false);
      setCreateForm({ name: '', email: '', role: 'school', password: '', tenantId: '' });

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
    if (!schoolTenants[0] || !eteaTenants[0]) {
      toast.error('Please create at least one school tenant and one ETEA tenant first');
      return;
    }

    setLoading(true);
    const bulkPayload = [
      { name: 'Saad Qureshi', email: 'saad@school.com', role: 'school' as User['role'], tenantId: schoolTenants[0].id },
      { name: 'Farah Naz', email: 'farah@agency.com', role: 'etea' as User['role'], tenantId: eteaTenants[0].id },
      { name: 'Kashif Raza', email: 'kashif@school.com', role: 'school' as User['role'], tenantId: schoolTenants[0].id },
    ];
    try {
      const created = await Promise.all(bulkPayload.map((u) => api.createUser(u)));
      setUsers((prev) => [...prev, ...created.map((c) => c.data.user)]);
      setBulkDialogOpen(false);
      toast.success('3 users imported successfully (default passwords set)');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bulk import failed');
    } finally {
      setLoading(false);
    }
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
                  <Select value={createForm.role} onValueChange={(v) => setCreateForm({ ...createForm, role: v as User['role'], tenantId: '' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="school">School</SelectItem>
                      <SelectItem value="etea">ETEA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {createForm.role !== 'admin' && (
                  <div className="space-y-2">
                    <Label>Tenant</Label>
                    <Select value={createForm.tenantId} onValueChange={(v) => setCreateForm({ ...createForm, tenantId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
                      <SelectContent>
                        {(createForm.role === 'school' ? schoolTenants : eteaTenants).map((tenant) => (
                          <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Password (optional)</Label>
                  <Input
                    type="password"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder="Leave empty to auto-generate"
                  />
                </div>
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
          { key: 'role', label: 'Role', options: [{ value: 'admin', label: 'Admin' }, { value: 'school', label: 'School' }, { value: 'etea', label: 'ETEA' }] },
          { key: 'status', label: 'Status', options: [{ value: 'active', label: 'Active' }, { value: 'banned', label: 'Banned' }] },
        ]}
        onFilterChange={(key, value) => {
          if (key === 'role') setRoleFilter(value);
          if (key === 'status') setStatusFilter(value);
        }}
      />

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <RefreshCcw className="w-3.5 h-3.5" /> Accounts are tenant-scoped; school and ETEA users must be linked to a tenant.
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
                  {u.isProtected ? (
                    <span className="text-xs font-medium text-primary">Protected via env</span>
                  ) : u.status !== 'banned' ? (
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
