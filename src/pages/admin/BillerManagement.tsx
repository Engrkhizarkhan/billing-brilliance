import { useEffect, useState } from 'react';
import { Biller } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterBar } from '@/components/FilterBar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Pencil, RefreshCcw, Copy, Eye, EyeOff, KeyRound, Ban, Rocket, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { TablePagination } from '@/components/TablePagination';
import { Checkbox } from '@/components/ui/checkbox';

const billerTypeLabels: Record<Biller['type'], string> = {
  school: 'School',
  org: 'Organization',
  private_agency: 'Private Agency',
};

const emptyBillerForm = {
  name: '',
  type: 'school' as Biller['type'],
  email: '',
  phone: '',
  consumerNumberLength: 24 as 14 | 24,
};

const activationCheckLabels = {
  profileComplete: 'Biller profile and ownership details verified',
  credentialsIssued: 'Production credentials issued through a secure channel',
  ipAllowlistConfigured: 'Source IP allowlist and network routing verified',
  uatPassed: 'Required UAT cases passed and evidence retained',
  supportContactsRecorded: 'Operational and escalation contacts recorded',
};
type ActivationCheckKey = keyof typeof activationCheckLabels;
const emptyActivationChecklist = (): Record<ActivationCheckKey, boolean> => ({
  profileComplete: false, credentialsIssued: false, ipAllowlistConfigured: false,
  uatPassed: false, supportContactsRecorded: false,
});

const BillerManagement = () => {
  const [billerList, setBillerList] = useState<Biller[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyBillerForm);
  const [editBiller, setEditBiller] = useState<Biller | null>(null);
  const [editForm, setEditForm] = useState(emptyBillerForm);
  const [loading, setLoading] = useState(false);
  const [visibleKeyId, setVisibleKeyId] = useState<string | null>(null);
  const [regenerateTarget, setRegenerateTarget] = useState<Biller | null>(null);
  const [regenerateConfirmation, setRegenerateConfirmation] = useState('');
  const [statusTarget, setStatusTarget] = useState<Biller | null>(null);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [activationTarget, setActivationTarget] = useState<Biller | null>(null);
  const [activationConfirmation, setActivationConfirmation] = useState('');
  const [activationChecklist, setActivationChecklist] = useState(emptyActivationChecklist);
  const [offboardTarget, setOffboardTarget] = useState<Biller | null>(null);
  const [offboardConfirmation, setOffboardConfirmation] = useState('');
  const [offboardReason, setOffboardReason] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);

  const copyApiKey = (key: string) => {
    void navigator.clipboard.writeText(key);
    toast.success('API key copied to clipboard');
  };

  const handleRegenerateKey = async () => {
    if (!regenerateTarget || regenerateConfirmation !== regenerateTarget.name) return;
    const id = regenerateTarget.id;
    setLoading(true);
    try {
      const res = await api.regenerateBillerApiKey(id, `REGENERATE ${id}`);
      if (res.data) {
        setBillerList((prev) => prev.map((b) => (b.id === id ? res.data : b)));
        if (editBiller?.id === id) setEditBiller(res.data);
        setVisibleKeyId(id);
        toast.success('API key regenerated. Copy and distribute the new key now.');
      }
      setRegenerateTarget(null);
      setRegenerateConfirmation('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to regenerate API key');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const response = await api.fetchBillers({
        page,
        pageSize,
        search: search || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        type: typeFilter === 'all' ? undefined : typeFilter,
      });
      setBillerList(response.data);
      setTotal(Number(response.meta?.total || 0));
      setLoading(false);
    };
    void load();
  }, [page, pageSize, search, statusFilter, typeFilter]);

  const filtered = billerList;

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.phone) {
      toast.error('Name, email, and phone are required');
      return;
    }
    setLoading(true);
    const response = await api.createBiller({ name: form.name, email: form.email, phone: form.phone, type: form.type, consumerNumberLength: form.consumerNumberLength });
    setBillerList((prev) => [response.data, ...prev].slice(0, pageSize));
    setTotal((current) => current + 1);
    setDialogOpen(false);
    setForm(emptyBillerForm);
    toast.success(`Biller "${response.data.name}" created with code ${response.data.billerCode}`);
    setLoading(false);
  };

  const openEditBiller = (biller: Biller) => {
    setEditBiller(biller);
    setEditForm({
      name: biller.name,
      type: biller.type,
      email: biller.email,
      phone: biller.phone,
      consumerNumberLength: biller.consumerNumberLength === 14 ? 14 : 24,
    });
  };

  const saveBillerEdit = async () => {
    if (!editBiller) return;

    if (!editForm.name || !editForm.email || !editForm.phone) {
      toast.error('Name, email, and phone are required');
      return;
    }

    setLoading(true);
    const updated = await api.updateBiller(editBiller.id, {
      name: editForm.name,
      type: editForm.type,
      email: editForm.email,
      phone: editForm.phone,
    });

    if (updated.data) {
      setBillerList((prev) => prev.map((b) => (b.id === editBiller.id ? updated.data : b)));
      setEditBiller(null);
      setEditForm(emptyBillerForm);
      toast.success(`Biller "${updated.data.name}" updated`);
    } else {
      toast.error('Unable to update biller');
    }
    setLoading(false);
  };

  const updateStatus = async (id: string, status: Biller['status'], reason?: string) => {
    setLoading(true);
    const updated = await api.updateBillerStatus(id, status, reason);
    if (updated.data) {
      setBillerList((prev) => prev.map((b) => (b.id === id ? updated.data : b)));
      if (editBiller?.id === id) {
        setEditBiller(updated.data);
      }
      toast.success(`Biller status updated to ${status}`);
    }
    setLoading(false);
  };

  const activateBiller = async () => {
    if (!activationTarget || activationConfirmation !== activationTarget.name) return;
    setLoading(true);
    try {
      const updated = await api.updateBillerLifecycle(activationTarget.id, 'live', activationChecklist, `ACTIVATE ${activationTarget.id}`, 'Production activation confirmed by platform administrator');
      setBillerList((current) => current.map((biller) => biller.id === activationTarget.id ? updated.data : biller));
      toast.success(`${activationTarget.name} is now live`);
      setActivationTarget(null);
      setActivationConfirmation('');
      setActivationChecklist(emptyActivationChecklist());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to activate biller');
    } finally { setLoading(false); }
  };

  const offboardBiller = async () => {
    if (!offboardTarget || offboardConfirmation !== offboardTarget.name || offboardReason.trim().length < 5) return;
    setLoading(true);
    try {
      await api.offboardBiller(offboardTarget.id, offboardConfirmation, offboardReason.trim());
      setBillerList((current) => current.filter((biller) => biller.id !== offboardTarget.id));
      setTotal((current) => Math.max(0, current - 1));
      toast.success(`${offboardTarget.name} was offboarded. Financial history was retained.`);
      setOffboardTarget(null); setOffboardConfirmation(''); setOffboardReason('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to offboard biller');
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Biller Management</h1>
          <p className="page-description">Manage billers and organizations. New billers get auto-generated biller codes.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={loading}><Plus className="w-4 h-4 mr-2" />Create New Biller</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create New Biller</DialogTitle><DialogDescription>Create a tenant profile and choose the permanent consumer-number format.</DialogDescription></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>Organization Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as Biller['type'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="school">School</SelectItem>
                    <SelectItem value="org">Organization</SelectItem>
                    <SelectItem value="private_agency">Private Agency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Consumer number length</Label>
                <Select value={String(form.consumerNumberLength)} onValueChange={(value) => setForm({ ...form, consumerNumberLength: Number(value) as 14 | 24 })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">24 digits (recommended)</SelectItem>
                    <SelectItem value="14">14 digits (maximum 9,999 for a 4-digit biller code)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">This becomes immutable after the first consumer is issued. Existing identifiers are never reformatted.</p>
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={loading}>Create Biller</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(editBiller)}
          onOpenChange={(open) => {
            if (!open) {
              setEditBiller(null);
              setEditForm(emptyBillerForm);
            }
          }}
        >
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Biller</DialogTitle><DialogDescription>Update the biller profile. Its assigned biller code cannot be changed.</DialogDescription></DialogHeader>
            {editBiller && (
              <div className="space-y-4 pt-2">
                <div><Label>Organization Name</Label><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
                <div>
                  <Label>Type</Label>
                  <Select value={editForm.type} onValueChange={(v) => setEditForm({ ...editForm, type: v as Biller['type'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="school">School</SelectItem>
                      <SelectItem value="org">Organization</SelectItem>
                      <SelectItem value="private_agency">Private Agency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Biller Code</Label><Input value={editBiller.billerCode} disabled /></div>
                <div><Label>Email</Label><Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></div>
                <div><Label>Phone</Label><Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></div>
                {editBiller.apiKey && (
                  <div>
                    <Label>API Key <span className="text-xs text-muted-foreground">(for external integrations)</span></Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        value={visibleKeyId === editBiller.id ? editBiller.apiKey : '•'.repeat(24)}
                        readOnly
                        className="font-mono text-xs"
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => setVisibleKeyId(visibleKeyId === editBiller.id ? null : editBiller.id)}>
                        {visibleKeyId === editBiller.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => copyApiKey(editBiller.apiKey!)}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="mt-1 text-xs text-destructive" onClick={() => { setRegenerateTarget(editBiller); setRegenerateConfirmation(''); }} disabled={loading}>
                      <KeyRound className="w-3.5 h-3.5 mr-1" /> Regenerate Key
                    </Button>
                  </div>
                )}
                <Button onClick={saveBillerEdit} className="w-full" disabled={loading}>Save Changes</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={Boolean(regenerateTarget)} onOpenChange={(open) => { if (!open && !loading) { setRegenerateTarget(null); setRegenerateConfirmation(''); } }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Regenerate API key?</AlertDialogTitle>
              <AlertDialogDescription>
                The existing key for <strong>{regenerateTarget?.name}</strong> will stop working immediately. Every connected system must be updated with the new key.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label htmlFor="biller-key-confirmation">Type the organization name to continue</Label>
              <Input id="biller-key-confirmation" value={regenerateConfirmation} onChange={(event) => setRegenerateConfirmation(event.target.value)} autoComplete="off" />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={loading || regenerateConfirmation !== regenerateTarget?.name} onClick={(event) => { event.preventDefault(); void handleRegenerateKey(); }}>
                {loading ? 'Regenerating…' : 'Regenerate and revoke old key'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={Boolean(statusTarget)} onOpenChange={(open) => { if (!open && !loading) { setStatusTarget(null); setSuspensionReason(''); } }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{statusTarget?.status === 'active' ? 'Suspend biller?' : 'Restore biller?'}</AlertDialogTitle>
              <AlertDialogDescription>
                {statusTarget?.status === 'active'
                  ? 'All payment and API writes will stop immediately. 1BILL will see its consumer numbers as unavailable, while identifiers and history remain intact.'
                  : 'The existing users, consumers, invoices and history will become available again under the biller’s lifecycle policy.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {statusTarget?.status === 'active' && (
              <div className="space-y-2"><Label>Reason (required)</Label><Input value={suspensionReason} onChange={(event) => setSuspensionReason(event.target.value)} placeholder="Operational or compliance reason" /></div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
              <AlertDialogAction disabled={loading || (statusTarget?.status === 'active' && suspensionReason.trim().length < 5)} onClick={(event) => {
                event.preventDefault();
                if (!statusTarget) return;
                void updateStatus(statusTarget.id, statusTarget.status === 'active' ? 'suspended' : 'active', suspensionReason).then(() => { setStatusTarget(null); setSuspensionReason(''); });
              }}>{statusTarget?.status === 'active' ? 'Suspend biller' : 'Restore biller'}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={Boolean(activationTarget)} onOpenChange={(open) => { if (!open && !loading) { setActivationTarget(null); setActivationConfirmation(''); setActivationChecklist(emptyActivationChecklist()); } }}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Activate production access?</AlertDialogTitle><AlertDialogDescription>
              Confirm that profile, credentials, IP allowlist, UAT, and support contacts are complete. This enables real production payment traffic.
            </AlertDialogDescription></AlertDialogHeader>
            <div className="space-y-3">
              {Object.entries(activationCheckLabels).map(([key, label]) => (
                <label key={key} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                  <Checkbox checked={activationChecklist[key as ActivationCheckKey]} onCheckedChange={(checked) => setActivationChecklist((current) => ({ ...current, [key]: checked === true }))} />
                  <span>{label}</span>
                </label>
              ))}
              <div className="space-y-2"><Label>Type <strong>{activationTarget?.name}</strong> to confirm all checks</Label><Input value={activationConfirmation} onChange={(event) => setActivationConfirmation(event.target.value)} /></div>
            </div>
            <AlertDialogFooter><AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel><AlertDialogAction disabled={loading || activationConfirmation !== activationTarget?.name || !Object.values(activationChecklist).every(Boolean)} onClick={(event) => { event.preventDefault(); void activateBiller(); }}><Rocket className="w-4 h-4 mr-2" />Activate live</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={Boolean(offboardTarget)} onOpenChange={(open) => { if (!open && !loading) { setOffboardTarget(null); setOffboardConfirmation(''); setOffboardReason(''); } }}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Offboard this biller?</AlertDialogTitle><AlertDialogDescription>
              Access and API credentials will be revoked. Consumers, invoices, payments, ledgers, and audit records will be retained for reconciliation. This option is available only after suspension.
            </AlertDialogDescription></AlertDialogHeader>
            <div className="space-y-3"><div className="space-y-2"><Label>Reason (required)</Label><Input value={offboardReason} onChange={(event) => setOffboardReason(event.target.value)} /></div><div className="space-y-2"><Label>Type <strong>{offboardTarget?.name}</strong> to confirm</Label><Input value={offboardConfirmation} onChange={(event) => setOffboardConfirmation(event.target.value)} /></div></div>
            <AlertDialogFooter><AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={loading || offboardConfirmation !== offboardTarget?.name || offboardReason.trim().length < 5} onClick={(event) => { event.preventDefault(); void offboardBiller(); }}><Trash2 className="mr-2 h-4 w-4" />Offboard and revoke access</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <FilterBar
        searchPlaceholder="Search billers..."
        onSearch={(value) => { setSearch(value); setPage(1); }}
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: [
              { value: 'active', label: 'Active' },
              { value: 'suspended', label: 'Suspended' },
              { value: 'banned', label: 'Banned' },
            ],
          },
          {
            key: 'type',
            label: 'Type',
            options: [
              { value: 'school', label: 'School' },
              { value: 'org', label: 'Organization' },
              { value: 'private_agency', label: 'Private Agency' },
            ],
          },
        ]}
        onFilterChange={(key, v) => {
          if (key === 'status') setStatusFilter(v);
          if (key === 'type') setTypeFilter(v);
          setPage(1);
        }}
      />

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <RefreshCcw className="w-3.5 h-3.5" /> Changes are stored in the live backend. Status changes apply immediately across the platform.
      </div>

      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Biller Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Consumer IDs</TableHead>
              <TableHead>Lifecycle</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>API Key</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.name}</TableCell>
                <TableCell>{billerTypeLabels[b.type]}</TableCell>
                <TableCell className="font-mono">{b.billerCode}</TableCell>
                <TableCell>{b.consumerNumberLength} digits</TableCell>
                <TableCell><Badge variant={b.lifecycleStage === 'live' ? 'default' : 'secondary'}>{(b.lifecycleStage || 'testing').replaceAll('_', ' ')}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{b.email}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{b.phone}</TableCell>
                <TableCell>
                  {b.apiKey ? (
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs text-muted-foreground">
                        {visibleKeyId === b.id ? b.apiKey : `${b.apiKey.slice(0, 8)}••••`}
                      </span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setVisibleKeyId(visibleKeyId === b.id ? null : b.id)}>
                        {visibleKeyId === b.id ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyApiKey(b.apiKey!)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <span className="font-mono text-xs text-muted-foreground">{b.apiKeyPrefix ? `${b.apiKeyPrefix}… (hidden)` : '—'}</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{b.createdAt}</TableCell>
                <TableCell><StatusBadge status={b.status} /></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEditBiller(b)} disabled={loading} aria-label={`Edit ${b.name}`}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    {b.status !== 'active' && (
                      <Button variant="ghost" size="sm" onClick={() => setStatusTarget(b)} disabled={loading} title="Restore biller">
                        <RefreshCcw className="w-4 h-4" />
                      </Button>
                    )}
                    {b.status === 'active' && <Button variant="ghost" size="sm" onClick={() => setStatusTarget(b)} disabled={loading} title="Suspend biller"><Ban className="w-4 h-4 text-destructive" /></Button>}
                    {b.lifecycleStage !== 'live' && <Button variant="ghost" size="sm" onClick={() => { setActivationChecklist(emptyActivationChecklist()); setActivationTarget(b); }} disabled={loading} title="Activate production"><Rocket className="w-4 h-4" /></Button>}
                    {b.status !== 'active' && <Button variant="ghost" size="sm" onClick={() => setOffboardTarget(b)} disabled={loading} title="Offboard biller"><Trash2 className="w-4 h-4 text-destructive" /></Button>}
                  </div>
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

export default BillerManagement;
