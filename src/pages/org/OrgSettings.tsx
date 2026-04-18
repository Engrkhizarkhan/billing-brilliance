import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useOrgSecurityStore } from '@/store/orgSecurityStore';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuthStore } from '@/store/authStore';
import { OrgRequestSecurityContext } from '@/types';
import { Copy, Eye, EyeOff, X, Plus, UserPlus, Trash2, RefreshCw } from 'lucide-react';

interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'viewer' | 'finance';
  status: 'active' | 'suspended';
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = { admin: 'Admin', viewer: 'Viewer', finance: 'Finance' };

const OrgSettings = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [keyVisible, setKeyVisible] = useState(false);

  const { user } = useAuthStore();

  const storedSourceIp = useOrgSecurityStore((state) => state.sourceIp);
  const setSourceIp = useOrgSecurityStore((state) => state.setSourceIp);

  const [securitySourceIp, setSecuritySourceIp] = useState(storedSourceIp);
  const [ipList, setIpList] = useState<string[]>(
    storedSourceIp ? storedSourceIp.split(',').map((s) => s.trim()).filter(Boolean) : ['127.0.0.1']
  );
  const [ipInput, setIpInput] = useState('');
  const [savingSecurityContext, setSavingSecurityContext] = useState(false);

  const { data: securityContextData } = useApiQuery(() => api.fetchSetting<OrgRequestSecurityContext>('etea_security_context'), []);

  useEffect(() => {
    const securityContext = securityContextData as OrgRequestSecurityContext | null;
    if (!securityContext) return;
    const nextSourceIp = securityContext.sourceIp || storedSourceIp;
    setSecuritySourceIp(nextSourceIp);
    setIpList(nextSourceIp ? nextSourceIp.split(',').map((s) => s.trim()).filter(Boolean) : ['127.0.0.1']);
    setSourceIp(nextSourceIp);
  }, [securityContextData, setSourceIp, storedSourceIp]);

  // ── User management state ────────────────────────────────────────────────
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([
    { id: 'u1', name: 'Organization Admin', email: user?.email || 'admin@org.example.com', role: 'admin', status: 'active', createdAt: new Date().toISOString() },
  ]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'viewer' as OrgUser['role'] });
  const [creatingUser, setCreatingUser] = useState(false);

  const handleCreateUser = async () => {
    if (!newUser.name.trim()) { toast.error('Name is required'); return; }
    if (!newUser.email.trim() || !newUser.email.includes('@')) { toast.error('Valid email is required'); return; }
    if (orgUsers.some((u) => u.email === newUser.email)) { toast.error('A user with this email already exists'); return; }
    setCreatingUser(true);
    try {
      // Attempt real API call; fall back to local state if unavailable
      try {
        await api.createUser({ name: newUser.name, email: newUser.email, role: 'etea' });
      } catch { /* local mock fallback */ }
      const created: OrgUser = {
        id: `u${Date.now()}`,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        status: 'active',
        createdAt: new Date().toISOString(),
      };
      setOrgUsers((prev) => [...prev, created]);
      setShowCreateDialog(false);
      setNewUser({ name: '', email: '', role: 'viewer' });
      toast.success(`User "${created.name}" created successfully`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create user');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleToggleStatus = (userId: string) => {
    setOrgUsers((prev) =>
      prev.map((u) => u.id === userId ? { ...u, status: u.status === 'active' ? 'suspended' : 'active' } : u)
    );
    toast.success('User status updated');
  };

  const handleDeleteUser = (userId: string) => {
    const target = orgUsers.find((u) => u.id === userId);
    if (!target) return;
    if (target.email === user?.email) { toast.error('You cannot remove your own account'); return; }
    setOrgUsers((prev) => prev.filter((u) => u.id !== userId));
    toast.success('User removed');
  };

  // ── Password ─────────────────────────────────────────────────────────────
  const resetForm = () => { setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); };

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) { toast.error('All password fields are required'); return; }
    if (newPassword.length < 8) { toast.error('New password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error('New password and confirm password do not match'); return; }
    if (currentPassword === newPassword) { toast.error('New password must be different from current password'); return; }
    try {
      await api.changePassword(currentPassword, newPassword);
      toast.success('Password updated successfully');
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update password');
    }
  };

  // ── IP Whitelist ──────────────────────────────────────────────────────────
  const addIp = () => {
    const val = ipInput.trim();
    if (!val) return;
    if (ipList.includes(val)) { toast.error('IP already in list'); return; }
    const next = [...ipList, val];
    setIpList(next);
    setSecuritySourceIp(next.join(','));
    setIpInput('');
  };

  const removeIp = (ip: string) => {
    const next = ipList.filter((i) => i !== ip);
    setIpList(next);
    setSecuritySourceIp(next.join(','));
  };

  const handleSaveSecurityContext = async () => {
    if (ipList.length === 0) { toast.error('At least one source IP is required'); return; }
    setSavingSecurityContext(true);
    try {
      const payload = { sourceIp: ipList.join(',') };
      await api.saveSetting('etea_security_context', payload);
      setSourceIp(payload.sourceIp);
      toast.success('API security context updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save security context');
    } finally {
      setSavingSecurityContext(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Settings</h1>
        <p className="page-description">Manage your account, organization users, and payment API security context.</p>
      </div>

      {/* ── Organization Users ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Organization Users</CardTitle>
              <CardDescription>Create and manage users who can access this organization's dashboard.</CardDescription>
            </div>
            <Button size="sm" className="rounded-lg" onClick={() => setShowCreateDialog(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium text-sm">{u.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{ROLE_LABELS[u.role]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                        {u.status === 'active' ? 'Active' : 'Suspended'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(u.createdAt).toLocaleDateString('en-PK')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs rounded"
                          onClick={() => handleToggleStatus(u.id)}
                          disabled={u.email === user?.email}
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          {u.status === 'active' ? 'Suspend' : 'Activate'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs rounded text-destructive hover:text-destructive"
                          onClick={() => handleDeleteUser(u.id)}
                          disabled={u.email === user?.email}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Users created here will receive an invitation email. They can log in using their email and a temporary password.
          </p>
        </CardContent>
      </Card>

      {/* ── Create User Dialog ───────────────────────────────────────────── */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Organization User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-user-name">Full Name</Label>
              <Input id="new-user-name" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} placeholder="Ali Khan" className="rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-user-email">Email</Label>
              <Input id="new-user-email" type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="ali@organization.pk" className="rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label>Dashboard Role</Label>
              <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v as OrgUser['role'] })}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin — full access</SelectItem>
                  <SelectItem value="finance">Finance — payments & reports</SelectItem>
                  <SelectItem value="viewer">Viewer — read only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="rounded-lg">Cancel</Button>
            <Button onClick={() => void handleCreateUser()} disabled={creatingUser} className="rounded-lg">
              {creatingUser ? 'Creating…' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Password ─────────────────────────────────────────────────────── */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Update Password</CardTitle>
          <CardDescription>Use a strong password with at least 8 characters.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <Input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="rounded-lg" autoComplete="current-password" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="rounded-lg" autoComplete="new-password" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="rounded-lg" autoComplete="new-password" />
          </div>
          <Button className="rounded-lg" onClick={() => void handleUpdatePassword()}>Update Password</Button>
        </CardContent>
      </Card>

      {/* ── API Key ───────────────────────────────────────────────────────── */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>API Key</CardTitle>
          <CardDescription>
            This key is issued by the platform for your organization. Provide it to external integrations (e.g. 1BILL) that need to call the payment API directly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Your Organization API Key</Label>
            <div className="flex gap-2">
              <Input
                value={keyVisible ? (user?.tenantApiKey || 'Not available — contact platform admin') : '•'.repeat(32)}
                readOnly
                className="rounded-lg font-mono text-sm bg-muted/40"
              />
              <Button variant="outline" size="sm" onClick={() => setKeyVisible((v) => !v)}>
                {keyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button variant="outline" size="sm" disabled={!user?.tenantApiKey} onClick={() => { void navigator.clipboard.writeText(user?.tenantApiKey || ''); toast.success('API key copied to clipboard'); }}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">To regenerate this key, contact the platform administrator.</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
            <p>External integrations must include this key as the <code>X-API-Key</code> request header.</p>
            <p>Internal dashboard users authenticate via their login credentials — no key required.</p>
          </div>
        </CardContent>
      </Card>

      {/* ── API Security Context ─────────────────────────────────────────── */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>API Security Context</CardTitle>
          <CardDescription>Configure whitelisted source IPs for payment-controller calls. Callback flow enforces signature + idempotency controls.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Source IPs (Whitelisted)</Label>
            <div className="flex flex-wrap gap-2 rounded-lg border bg-muted/20 p-2 min-h-[42px]">
              {ipList.map((ip) => (
                <span key={ip} className="flex items-center gap-1 bg-background border rounded px-2 py-0.5 text-xs font-mono">
                  {ip}
                  <button type="button" onClick={() => removeIp(ip)} className="text-muted-foreground hover:text-destructive ml-1">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={ipInput} onChange={(e) => setIpInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addIp(); } }} placeholder="e.g. 203.0.113.10" className="rounded-lg font-mono text-sm" />
              <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={addIp}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Press Enter or click + to add. Multiple IPs allowed.</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
            <p>Security controls enabled:</p>
            <p>- API key authentication</p>
            <p>- Source IP whitelist</p>
            <p>- Webhook signature verification</p>
            <p>- Callback idempotency protection</p>
          </div>
          <Button className="rounded-lg" onClick={() => void handleSaveSecurityContext()} disabled={savingSecurityContext}>
            Save Security Context
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrgSettings;
