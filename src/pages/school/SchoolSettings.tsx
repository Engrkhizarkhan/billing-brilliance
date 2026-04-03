import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { toast } from 'sonner';
import { mockApi } from '@/lib/mockApi';
import { SchoolAccessRole, User } from '@/types';
import { useAuthStore } from '@/store/authStore';

type SchoolUser = User & { role: 'school' };

type EditUserForm = {
  id: string;
  name: string;
  email: string;
  schoolAccessRole: SchoolAccessRole;
  verified: boolean;
  nextPassword: string;
};

type NewUserForm = {
  name: string;
  email: string;
  password: string;
  schoolAccessRole: SchoolAccessRole;
  verified: boolean;
};

const emptyEditUserForm: EditUserForm = {
  id: '',
  name: '',
  email: '',
  schoolAccessRole: 'staff',
  verified: false,
  nextPassword: '',
};

const emptyNewUserForm: NewUserForm = {
  name: '',
  email: '',
  password: '',
  schoolAccessRole: 'staff',
  verified: false,
};

const schoolRoleOptions: SchoolAccessRole[] = ['admin', 'finance', 'staff', 'viewer'];

type FeeGenerationMode = 'auto' | 'manual' | 'hybrid';
type SchedulerHealth = 'healthy' | 'warning' | 'failed';

const SchoolSettings = () => {
  const authUser = useAuthStore((state) => state.user);
  const schoolRef = authUser?.schoolRef;
  const mainSchoolUserId = authUser?.mainSchoolUserId || authUser?.id || '';

  const [users, setUsers] = useState<SchoolUser[]>([]);
  const [newUser, setNewUser] = useState<NewUserForm>(emptyNewUserForm);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<EditUserForm>(emptyEditUserForm);
  const [userBeingDeleted, setUserBeingDeleted] = useState<SchoolUser | null>(null);
  const [adminPassword, setAdminPassword] = useState({ previous: '', next: '' });
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [feeGenerationMode, setFeeGenerationMode] = useState<FeeGenerationMode>('hybrid');
  const [schedulerHealth] = useState<SchedulerHealth>('healthy');
  const [schedulerLastRun, setSchedulerLastRun] = useState('2026-04-02 02:00');
  const [alertOnSchedulerFailure, setAlertOnSchedulerFailure] = useState(true);
  const [autoApplyLateFee, setAutoApplyLateFee] = useState(true);
  const [lastManualRunAt, setLastManualRunAt] = useState<string | null>(null);

  const loadSchoolUsers = useCallback(async () => {
    if (!schoolRef) {
      setUsers([]);
      return;
    }

    setLoadingUsers(true);
    try {
      const response = await mockApi.fetchSchoolUsers(schoolRef);
      setUsers(response.data.filter((u): u is SchoolUser => u.role === 'school'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load school users');
    } finally {
      setLoadingUsers(false);
    }
  }, [schoolRef]);

  useEffect(() => {
    void loadSchoolUsers();
  }, [loadSchoolUsers]);

  const handleAddUser = async () => {
    if (!schoolRef || !mainSchoolUserId) {
      toast.error('School reference is missing. Ask platform admin to create your main school account first.');
      return;
    }

    if (!newUser.name || !newUser.email || !newUser.password) {
      toast.error('Name, email, and password are required');
      return;
    }

    try {
      const response = await mockApi.createSchoolSubUser({
        name: newUser.name.trim(),
        email: newUser.email.trim(),
        password: newUser.password,
        schoolRef,
        mainSchoolUserId,
        schoolAccessRole: newUser.schoolAccessRole,
        verified: newUser.verified,
      });
      if (response.data.role === 'school') {
        setUsers((prev) => [...prev, response.data]);
      }
      toast.success('Sub-user linked to school reference');
      setNewUser(emptyNewUserForm);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to add user');
    }
  };

  const handleVerify = async (id: string) => {
    try {
      const updated = await mockApi.setUserVerified(id, true);
      if (updated.data && updated.data.role === 'school') {
        setUsers((prev) => prev.map((u) => (u.id === id ? updated.data : u)));
      }
      toast.success('Email marked verified (mock)');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to verify user');
    }
  };

  const handleEditUser = (user: SchoolUser) => {
    setEditUser({
      id: user.id,
      name: user.name,
      email: user.email,
      schoolAccessRole: user.schoolAccessRole || 'staff',
      verified: user.verified === true,
      nextPassword: '',
    });
    setEditDialogOpen(true);
  };

  const handleSaveEditUser = async () => {
    if (!editUser.id || !editUser.name.trim() || !editUser.email.trim()) {
      toast.error('Name and email are required');
      return;
    }

    try {
      const updated = await mockApi.updateSchoolUser(editUser.id, {
        name: editUser.name.trim(),
        email: editUser.email.trim(),
        schoolAccessRole: editUser.schoolAccessRole,
        verified: editUser.verified,
      });

      if (!updated.data || updated.data.role !== 'school') {
        toast.error('User not found');
        return;
      }

      if (editUser.nextPassword.trim()) {
        await mockApi.resetUserPassword(editUser.id, editUser.nextPassword.trim());
      }

      setUsers((prev) => prev.map((u) => (u.id === editUser.id ? updated.data : u)));
      toast.success('User updated (mock)');
      setEditDialogOpen(false);
      setEditUser(emptyEditUserForm);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update user');
    }
  };

  const handleAskDeleteUser = (user: SchoolUser) => {
    setUserBeingDeleted(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userBeingDeleted) {
      return;
    }

    if (!schoolRef) {
      toast.error('School reference is missing');
      return;
    }

    try {
      const deleted = await mockApi.deleteSchoolUser(userBeingDeleted.id, schoolRef);
      if (!deleted.data) {
        toast.error('User not found');
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== userBeingDeleted.id));
      toast.success('User deleted (mock)');
      setDeleteDialogOpen(false);
      setUserBeingDeleted(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete user');
    }
  };

  const handleUpdateAdminPassword = async () => {
    if (!mainSchoolUserId) {
      toast.error('Main school admin reference is missing');
      return;
    }
    if (!adminPassword.previous || !adminPassword.next) {
      toast.error('Previous and new admin password are required');
      return;
    }

    try {
      await mockApi.updateUserPassword(mainSchoolUserId, adminPassword.previous, adminPassword.next);
      toast.success('Main school admin password updated (mock)');
      setAdminPassword({ previous: '', next: '' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update admin password');
    }
  };

  const handleRunManualGeneration = () => {
    const now = new Date();
    const formatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setLastManualRunAt(formatted);
    setSchedulerLastRun(formatted);

    if (feeGenerationMode === 'auto') {
      toast.info('Manual generation executed as an emergency override while policy is Auto');
      return;
    }

    toast.success('Fee generation completed (mock)');
  };

  const handleSaveBillingPolicy = () => {
    const modeMessage: Record<FeeGenerationMode, string> = {
      auto: 'Auto mode scales best, but requires scheduler monitoring and alerts.',
      manual: 'Manual mode is simple, but relies on operator discipline.',
      hybrid: 'Hybrid mode combines scheduled generation with manual override and is recommended.',
    };

    toast.success(`Billing policy saved (mock). ${modeMessage[feeGenerationMode]}`);
  };

  const schedulerHealthLabel: Record<SchedulerHealth, string> = {
    healthy: 'Healthy',
    warning: 'Warning',
    failed: 'Failed',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">School Settings</h1>
          <p className="text-sm text-muted-foreground">Manage staff accounts linked to your main school reference, verify emails, and control passwords.</p>
          <p className="text-xs text-muted-foreground mt-1">School reference: {schoolRef || 'Not linked by platform admin yet'}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Fee Generation Policy</CardTitle>
          <CardDescription>
            Choose how invoices are generated for each student&apos;s lifelong consumer number. Hybrid is recommended for production.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border p-3">
              <p className="text-sm font-medium">Auto only</p>
              <p className="mt-1 text-xs text-muted-foreground">Best for scale, but risky if scheduler failures are not detected.</p>
            </div>
            <div className="rounded-xl border p-3">
              <p className="text-sm font-medium">Manual only</p>
              <p className="mt-1 text-xs text-muted-foreground">Simple control, but depends on staff discipline and can cause missed due cycles.</p>
            </div>
            <div className="rounded-xl border p-3">
              <p className="text-sm font-medium">Hybrid</p>
              <p className="mt-1 text-xs text-muted-foreground">Scheduled automation plus manual button for safe operational fallback.</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Default generation mode</Label>
              <Select value={feeGenerationMode} onValueChange={(value) => setFeeGenerationMode(value as FeeGenerationMode)}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto only</SelectItem>
                  <SelectItem value="manual">Manual only</SelectItem>
                  <SelectItem value="hybrid">Hybrid (recommended)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Scheduler health</Label>
              <div className="h-10 rounded-xl border px-3 flex items-center text-sm bg-muted/20">
                {schedulerHealthLabel[schedulerHealth]}
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="alert-scheduler"
                checked={alertOnSchedulerFailure}
                onCheckedChange={(checked) => setAlertOnSchedulerFailure(checked === true)}
              />
              <Label htmlFor="alert-scheduler">Alert when scheduler fails or misses a run</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="auto-late-fee"
                checked={autoApplyLateFee}
                onCheckedChange={(checked) => setAutoApplyLateFee(checked === true)}
              />
              <Label htmlFor="auto-late-fee">Auto-apply late fee after due date</Label>
            </div>
          </div>

          <div className="rounded-xl border bg-muted/30 p-3 text-sm">
            <p><span className="font-medium">Last scheduler run:</span> {schedulerLastRun}</p>
            <p><span className="font-medium">Current status:</span> {schedulerHealthLabel[schedulerHealth]}</p>
            <p><span className="font-medium">Last manual run:</span> {lastManualRunAt ?? 'Not run yet'}</p>
            <p className="mt-1 text-xs text-muted-foreground">A single consumer number remains fixed per student; invoices are generated per billing cycle and mapped to that account.</p>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" className="rounded-lg" onClick={handleRunManualGeneration}>Generate fees now</Button>
            <Button className="rounded-lg" onClick={handleSaveBillingPolicy}>Save billing policy</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle>Add user</CardTitle>
            <CardDescription>
              Create a sub-user under the same school reference so access stays scoped to this school dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} placeholder="Full name" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="user@school.edu" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="••••••••" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={newUser.schoolAccessRole} onValueChange={(value) => setNewUser({ ...newUser, schoolAccessRole: value as SchoolAccessRole })}>
                  <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {schoolRoleOptions.map((roleOption) => (
                      <SelectItem key={roleOption} value={roleOption}>
                        {roleOption.charAt(0).toUpperCase() + roleOption.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Checkbox id="verified" checked={newUser.verified} onCheckedChange={(checked) => setNewUser({ ...newUser, verified: checked === true })} />
                <Label htmlFor="verified">Mark email as verified</Label>
              </div>
            </div>
            {!schoolRef && (
              <p className="text-xs text-destructive">No school reference found. Ask platform admin to create your main school account first.</p>
            )}
            <div className="flex justify-end">
              <Button onClick={handleAddUser} className="rounded-lg" disabled={!schoolRef || loadingUsers}>Add user</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Update main admin password</CardTitle>
            <CardDescription>Set a new password for the main school account linked to this reference.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Previous admin password</Label>
              <Input type="password" value={adminPassword.previous} onChange={(e) => setAdminPassword({ ...adminPassword, previous: e.target.value })} placeholder="Previous admin password" />
            </div>
            <div className="space-y-2">
              <Label>New admin password</Label>
              <Input type="password" value={adminPassword.next} onChange={(e) => setAdminPassword({ ...adminPassword, next: e.target.value })} placeholder="New admin password" />
            </div>
            <Button onClick={handleUpdateAdminPassword} className="w-full rounded-lg" disabled={!mainSchoolUserId}>Update admin password</Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Users</CardTitle>
          <CardDescription>Manage verification, roles, profile details, and access.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingUsers ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">Loading users...</TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">No users linked to this school reference yet.</TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell className="capitalize">{user.schoolAccessRole || 'staff'}</TableCell>
                    <TableCell>{user.verified ? 'Verified' : 'Pending verification'}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" className="rounded-lg" onClick={() => handleEditUser(user)}>
                        Edit user
                      </Button>
                      {!user.verified && (
                        <Button size="sm" variant="outline" className="rounded-lg" onClick={() => handleVerify(user.id)}>
                          Mark verified
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" className="rounded-lg" onClick={() => handleAskDeleteUser(user)}>
                        Delete user
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setEditUser(emptyEditUserForm);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>Update user details and optionally set a new password.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={editUser.name} onChange={(e) => setEditUser({ ...editUser, name: e.target.value })} placeholder="Full name" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={editUser.email} onChange={(e) => setEditUser({ ...editUser, email: e.target.value })} placeholder="user@school.edu" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={editUser.schoolAccessRole} onValueChange={(value) => setEditUser({ ...editUser, schoolAccessRole: value as SchoolAccessRole })}>
                  <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {schoolRoleOptions.map((roleOption) => (
                      <SelectItem key={roleOption} value={roleOption}>
                        {roleOption.charAt(0).toUpperCase() + roleOption.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Checkbox
                  id="edit-user-verified"
                  checked={editUser.verified}
                  onCheckedChange={(checked) => setEditUser({ ...editUser, verified: checked === true })}
                />
                <Label htmlFor="edit-user-verified">Email verified</Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>New password (optional)</Label>
              <Input
                type="password"
                value={editUser.nextPassword}
                onChange={(e) => setEditUser({ ...editUser, nextPassword: e.target.value })}
                placeholder="Leave blank to keep current password"
              />
            </div>
            <Button onClick={handleSaveEditUser} className="w-full rounded-lg">Save changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setUserBeingDeleted(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              {userBeingDeleted
                ? `This will permanently remove ${userBeingDeleted.name} from the school portal users.`
                : 'This will permanently remove the selected user from the school portal users.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDeleteUser}>
              Delete user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SchoolSettings;
