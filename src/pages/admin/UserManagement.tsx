import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterBar } from '@/components/FilterBar';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Ban, Upload, Download, FileText, Plus, RefreshCcw, LogIn, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Biller, User } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { TablePagination } from '@/components/TablePagination';

const parseCsvLine = (line: string) => {
  const values: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      values.push(value.trim()); value = '';
    } else value += character;
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted field');
  values.push(value.trim());
  return values;
};

const UserManagement = () => {
  const navigate = useNavigate();
  const { startImpersonation } = useAuthStore();
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
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [billers, setBillers] = useState<Biller[]>([]);
  const schoolTenants = billers.filter((b) => b.type === 'school');
  const orgTenants = billers.filter((b) => b.type === 'org');

  useEffect(() => {
    const loadTenantOptions = async () => {
      const first = await api.fetchBillers({ page: 1, pageSize: 100 });
      const pages = Math.ceil(Number(first.meta?.total || first.data.length) / 100);
      const remaining = pages > 1
        ? await Promise.all(Array.from({ length: pages - 1 }, (_, index) => api.fetchBillers({ page: index + 2, pageSize: 100 })))
        : [];
      setBillers([...first.data, ...remaining.flatMap((response) => response.data)]);
    };
    void loadTenantOptions();
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const response = await api.fetchUsers({
        page,
        pageSize,
        search: search || undefined,
        role: roleFilter === 'all' ? undefined : roleFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setUsers(response.data);
      setTotal(Number(response.meta?.total || 0));
      setLoading(false);
    };
    void load();
  }, [page, pageSize, search, roleFilter, statusFilter]);

  const filtered = users;

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

  const deleteUser = async () => {
    if (!deleteTarget || deleteConfirmation !== deleteTarget.email) return;
    setLoading(true);
    try {
      await api.deleteUser(deleteTarget.id);
      setUsers((current) => current.filter((user) => user.id !== deleteTarget.id));
      setTotal((current) => Math.max(0, current - 1));
      toast.success(`User ${deleteTarget.email} deleted`);
      setDeleteTarget(null);
      setDeleteConfirmation('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete user');
    } finally {
      setLoading(false);
    }
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
    if (createForm.password && createForm.password.length < 12) {
      toast.error('Password must be at least 12 characters');
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
      setUsers((prev) => [response.data.user, ...prev].slice(0, pageSize));
      setTotal((current) => current + 1);
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

  const handleBulkUpload = async (file: File) => {
    setLoading(true);
    try {
      const lines = (await file.text()).replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
      if (lines.length < 2) throw new Error('CSV must contain a header and at least one user');
      if (lines.length > 101) throw new Error('Import is limited to 100 users per file');
      const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase().replace(/[^a-z]/g, ''));
      const requiredHeaders = ['name', 'email', 'role'];
      if (requiredHeaders.some((header) => !headers.includes(header))) {
        throw new Error('CSV headers must include Name, Email and Role');
      }
      const indexOf = (header: string) => headers.indexOf(header);
      const payloads = lines.slice(1).map((line, rowIndex) => {
        const row = parseCsvLine(line);
        const role = row[indexOf('role')]?.toLowerCase() as User['role'];
        const name = row[indexOf('name')]?.trim();
        const email = row[indexOf('email')]?.trim();
        const tenantId = indexOf('tenantid') >= 0 ? row[indexOf('tenantid')]?.trim() : '';
        const password = indexOf('password') >= 0 ? row[indexOf('password')] : '';
        if (!name || !email || !['admin', 'school', 'org'].includes(role)) {
          throw new Error(`Invalid Name, Email or Role on CSV row ${rowIndex + 2}`);
        }
        if (role !== 'admin' && !tenantId) throw new Error(`TenantId is required on CSV row ${rowIndex + 2}`);
        if (!password || password.length < 12) throw new Error(`Password must be 12+ characters on CSV row ${rowIndex + 2}`);
        return { name, email, role, tenantId: role === 'admin' ? undefined : tenantId, password };
      });
      const created: Awaited<ReturnType<typeof api.createUser>>[] = [];
      const failures: string[] = [];
      for (const payload of payloads) {
        try { created.push(await api.createUser(payload)); }
        catch (error) { failures.push(`${payload.email}: ${error instanceof Error ? error.message : 'failed'}`); }
      }
      setUsers((prev) => [...created.map((c) => c.data.user), ...prev].slice(0, pageSize));
      setTotal((current) => current + created.length);
      if (failures.length === 0) {
        setBulkDialogOpen(false);
        toast.success(`${created.length} users imported successfully`);
      } else {
        toast.error(`${created.length} imported, ${failures.length} failed. First error: ${failures[0]}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bulk import failed');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const csv = 'Name,Email,Role,TenantId,Password\nJohn Doe,john@example.com,school,REPLACE-TENANT-UUID,StrongTemporary!2026\n';
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
              <DialogHeader><DialogTitle>Create User</DialogTitle><DialogDescription>Create a tenant-scoped account with the appropriate portal role.</DialogDescription></DialogHeader>
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
                      <SelectItem value="org">Organization</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {createForm.role !== 'admin' && (
                  <div className="space-y-2">
                    <Label>Tenant</Label>
                    <Select value={createForm.tenantId} onValueChange={(v) => setCreateForm({ ...createForm, tenantId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
                      <SelectContent>
                        {(createForm.role === 'school' ? schoolTenants : orgTenants).map((tenant) => (
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
                    minLength={12}
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder="Leave empty to auto-generate, or use 12+ characters"
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
              <DialogHeader><DialogTitle>Import Users in Bulk</DialogTitle><DialogDescription>Upload a validated CSV file containing up to 100 user accounts.</DialogDescription></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="rounded-lg border-2 border-dashed border-border p-6 text-center">
                  <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium">Upload CSV file</p>
                  <p className="text-xs text-muted-foreground mt-1">Columns: Name, Email, Role, TenantId, Password (12+ characters)</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handleBulkUpload(file);
                      event.target.value = '';
                    }}
                  />
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => fileInputRef.current?.click()}>
                    Choose File
                  </Button>
                </div>
                <Button variant="ghost" size="sm" className="w-full" onClick={downloadTemplate}>
                  <Download className="w-3.5 h-3.5 mr-1.5" />Download CSV Template
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <FilterBar
        searchPlaceholder="Search users…"
        onSearch={(value) => { setSearch(value); setPage(1); }}
        filters={[
          { key: 'role', label: 'Role', options: [{ value: 'admin', label: 'Admin' }, { value: 'school', label: 'School' }, { value: 'org', label: 'Organization' }] },
          { key: 'status', label: 'Status', options: [{ value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }, { value: 'banned', label: 'Banned' }] },
        ]}
        onFilterChange={(key, value) => {
          if (key === 'role') setRoleFilter(value);
          if (key === 'status') setStatusFilter(value);
          setPage(1);
        }}
      />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !loading) { setDeleteTarget(null); setDeleteConfirmation(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete biller user?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes <strong>{deleteTarget?.name}</strong> from User Management and prevents future sign-in. Historical payment and audit records are retained.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-user-confirmation">Type <strong>{deleteTarget?.email}</strong> to confirm</Label>
            <Input id="delete-user-confirmation" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={loading || deleteConfirmation !== deleteTarget?.email} onClick={(event) => { event.preventDefault(); void deleteUser(); }}>
              {loading ? 'Deleting…' : 'Delete user'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <RefreshCcw className="w-3.5 h-3.5" /> Accounts are tenant-scoped; school and Org users must be linked to a tenant.
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
                <TableCell className="text-xs text-muted-foreground">
                  <div className="font-medium text-foreground">{u.schoolRef || (u.billerCode ? `BILLER-${u.billerCode}` : '-')}</div>
                  {u.tenantName && <div className="mt-0.5">{u.tenantName}</div>}
                </TableCell>
                <TableCell><StatusBadge status={u.status} /></TableCell>
                <TableCell>
                  {u.isProtected ? (
                    <span className="text-xs font-medium text-primary">Protected via env</span>
                  ) : (
                    <div className="flex items-center gap-1">
                      {u.role !== 'admin' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={loading}
                          onClick={async () => {
                            try {
                              await startImpersonation(u.id);
                              navigate(`/${u.role}`);
                            } catch {
                              toast.error('Failed to start maintenance session');
                            }
                          }}
                        >
                          <LogIn className="w-3 h-3 mr-1" /> Login As
                        </Button>
                      )}
                      {u.status !== 'banned' ? (
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => banUser(u.id)} disabled={loading}>
                          <Ban className="w-3 h-3 mr-1" /> Ban
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => unbanUser(u.id)} disabled={loading}>
                          <RefreshCcw className="w-3 h-3 mr-1" /> Unban
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:text-destructive"
                        onClick={() => { setDeleteTarget(u); setDeleteConfirmation(''); }}
                        disabled={loading}
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> Delete
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <TablePagination
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(value) => { setPageSize(value); setPage(1); }}
      />
    </div>
  );
};

export default UserManagement;
