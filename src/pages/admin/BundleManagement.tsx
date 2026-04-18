import { useEffect, useState, useMemo } from 'react';
import { Bundle, PcidKey, Biller } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterBar } from '@/components/FilterBar';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Package, Plus, Pencil, Trash2, ChevronDown, ChevronRight,
  Eye, EyeOff, Copy, CheckCheck, KeyRound, Link2,
} from 'lucide-react';
import { api } from '@/lib/api';

const TAG_MAX = 2000;

const emptyForm = {
  pcid: '',
  billerName: '',
  bundleId: '',
  bundleName: '',
  description: '',
  expiryDate: '',
  amount: '',
  tag: '',
  status: 'active' as Bundle['status'],
};
type BundleForm = typeof emptyForm;

type PcidGroup = {
  pcid: string;
  billerName: string;
  bundles: Bundle[];
  pcidKey?: PcidKey;
};

const BundleManagement = () => {
  const [allBundles, setAllBundles] = useState<Bundle[]>([]);
  const [pcidKeys, setPcidKeys] = useState<PcidKey[]>([]);
  const [billers, setBillers] = useState<Biller[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<BundleForm>(emptyForm);
  const [prefillPcid, setPrefillPcid] = useState('');

  const [editBundle, setEditBundle] = useState<Bundle | null>(null);
  const [editForm, setEditForm] = useState<BundleForm>(emptyForm);

  const [deleteTarget, setDeleteTarget] = useState<Bundle | null>(null);

  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [linkTarget, setLinkTarget] = useState<PcidKey | null>(null);
  const [linkBillerId, setLinkBillerId] = useState('');

  const loadAll = async () => {
    setLoading(true);
    const [bundlesRes, keysRes, billersRes] = await Promise.all([
      api.fetchAdminBundles({ pageSize: 1000 }),
      api.fetchPcidKeys(),
      api.fetchBillers({ pageSize: 200, status: 'active' }),
    ]);
    setAllBundles(bundlesRes.data ?? []);
    setPcidKeys(keysRes.data ?? []);
    setBillers(billersRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { void loadAll(); }, []);

  const pcidGroups = useMemo<PcidGroup[]>(() => {
    const keyMap = new Map<string, PcidKey>(pcidKeys.map((k) => [k.pcid, k]));
    const filtered = allBundles.filter((b) => {
      const matchSearch =
        !search ||
        b.bundleName.toLowerCase().includes(search.toLowerCase()) ||
        b.bundleId.toLowerCase().includes(search.toLowerCase()) ||
        b.billerName.toLowerCase().includes(search.toLowerCase()) ||
        b.pcid.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || b.status === statusFilter;
      return matchSearch && matchStatus;
    });
    const map = new Map<string, PcidGroup>();
    for (const b of filtered) {
      if (!map.has(b.pcid)) {
        map.set(b.pcid, { pcid: b.pcid, billerName: b.billerName, bundles: [], pcidKey: keyMap.get(b.pcid) });
      }
      map.get(b.pcid)!.bundles.push(b);
    }
    return Array.from(map.values()).sort((a, b) => a.pcid.localeCompare(b.pcid));
  }, [allBundles, pcidKeys, search, statusFilter]);

  const toggleExpand = (pcid: string) =>
    setExpanded((prev) => { const n = new Set(prev); n.has(pcid) ? n.delete(pcid) : n.add(pcid); return n; });

  const expandAll = () => setExpanded(new Set(pcidGroups.map((g) => g.pcid)));
  const collapseAll = () => setExpanded(new Set());

  const toggleKeyVisible = (pcid: string) =>
    setVisibleKeys((prev) => { const n = new Set(prev); n.has(pcid) ? n.delete(pcid) : n.add(pcid); return n; });

  const copyKey = (key: string, pcid: string) => {
    void navigator.clipboard.writeText(key);
    setCopiedKey(pcid);
    toast.success('API key copied');
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleRegenerateKey = async (pcid: string) => {
    if (!window.confirm(`Regenerate API key for PCID "${pcid}"? The old key will stop working immediately.`)) return;
    setLoading(true);
    const res = await api.regeneratePcidKey(pcid);
    if (res.data) {
      setPcidKeys((prev) => prev.map((k) => (k.pcid === pcid ? res.data! : k)));
      toast.success('API key regenerated');
    }
    setLoading(false);
  };

  const openLinkBiller = (pk: PcidKey) => {
    setLinkTarget(pk);
    setLinkBillerId(pk.billerId ?? '__unlink__');
  };

  const saveLinkBiller = async () => {
    if (!linkTarget) return;
    setLoading(true);
    const res = await api.linkPcidBiller(linkTarget.pcid, linkBillerId === '__unlink__' || !linkBillerId ? null : linkBillerId);
    if (res.data) {
      setPcidKeys((prev) => prev.map((k) => (k.pcid === linkTarget.pcid ? { ...k, ...res.data } : k)));
      toast.success(`PCID "${linkTarget.pcid}" linked to biller`);
    }
    setLinkTarget(null);
    setLoading(false);
  };

  const openCreate = (pcid = '') => {
    setPrefillPcid(pcid);
    setCreateForm({ ...emptyForm, pcid: pcid.toUpperCase() });
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    const { pcid, billerName, bundleId, bundleName, amount } = createForm;
    if (!pcid || !billerName || !bundleId || !bundleName || !amount) {
      toast.error('PCID, biller name, bundle ID, bundle name, and amount are required');
      return;
    }
    if (createForm.tag.length > TAG_MAX) { toast.error(`Tag must be ${TAG_MAX} chars or fewer`); return; }
    setLoading(true);
    try {
      await api.createBundle({
        pcid: createForm.pcid.toUpperCase(),
        billerName: createForm.billerName,
        bundleId: createForm.bundleId,
        bundleName: createForm.bundleName,
        description: createForm.description || undefined,
        expiryDate: createForm.expiryDate || undefined,
        amount: createForm.amount,
        tag: createForm.tag || undefined,
        status: createForm.status,
      });
      toast.success('Bundle created');
      setCreateOpen(false);
      setCreateForm(emptyForm);
      const newPcid = createForm.pcid.toUpperCase();
      await loadAll();
      setExpanded((prev) => new Set([...prev, newPcid]));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create bundle';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (bundle: Bundle) => {
    setEditBundle(bundle);
    setEditForm({
      pcid: bundle.pcid,
      billerName: bundle.billerName,
      bundleId: bundle.bundleId,
      bundleName: bundle.bundleName,
      description: bundle.description ?? '',
      expiryDate: bundle.expiryDate ?? '',
      amount: bundle.amount,
      tag: bundle.tag ?? '',
      status: bundle.status,
    });
  };

  const handleEdit = async () => {
    if (!editBundle) return;
    if (editForm.tag.length > TAG_MAX) { toast.error(`Tag must be ${TAG_MAX} characters or fewer`); return; }
    setLoading(true);
    const res = await api.updateBundle(editBundle.id, {
      billerName: editForm.billerName,
      bundleName: editForm.bundleName,
      description: editForm.description || undefined,
      expiryDate: editForm.expiryDate || undefined,
      amount: editForm.amount,
      tag: editForm.tag || undefined,
      status: editForm.status,
    });
    if (res.data) {
      setAllBundles((prev) => prev.map((b) => (b.id === editBundle.id ? res.data! : b)));
      toast.success('Bundle updated');
    }
    setEditBundle(null);
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    await api.deleteBundle(deleteTarget.id);
    setAllBundles((prev) => prev.filter((b) => b.id !== deleteTarget.id));
    toast.success(`Bundle "${deleteTarget.bundleName}" deleted`);
    setDeleteTarget(null);
    setLoading(false);
  };

  const setCreate = (field: keyof BundleForm, value: string) =>
    setCreateForm((f) => ({ ...f, [field]: value }));
  const setEdit = (field: keyof BundleForm, value: string) =>
    setEditForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header flex items-center gap-2">
            <Package className="w-5 h-5" /> Bundle Management
          </h1>
          <p className="page-description">
            Manage 1LINK fee bundles. Bundles are grouped by PCID — each PCID gets its own API key for the SaaS gateway.
          </p>
        </div>
        <Button disabled={loading} onClick={() => openCreate()}>
          <Plus className="w-4 h-4 mr-2" /> Add Bundle
        </Button>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Bundle</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <Label>PCID <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. MBLINK01" maxLength={8} value={createForm.pcid}
                disabled={!!prefillPcid} className={prefillPcid ? 'bg-muted' : ''}
                onChange={(e) => setCreate('pcid', e.target.value.toUpperCase())} />
              {prefillPcid && <p className="text-xs text-muted-foreground mt-0.5">Adding to existing PCID</p>}
            </div>
            <div>
              <Label>Biller Name <span className="text-destructive">*</span></Label>
              <Input maxLength={30} value={createForm.billerName} onChange={(e) => setCreate('billerName', e.target.value)} />
            </div>
            <div>
              <Label>Bundle ID <span className="text-destructive">*</span></Label>
              <Input maxLength={20} placeholder="e.g. PKG001" value={createForm.bundleId} onChange={(e) => setCreate('bundleId', e.target.value)} />
            </div>
            <div>
              <Label>Bundle Name <span className="text-destructive">*</span></Label>
              <Input maxLength={100} value={createForm.bundleName} onChange={(e) => setCreate('bundleName', e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <Input maxLength={500} value={createForm.description} onChange={(e) => setCreate('description', e.target.value)} />
            </div>
            <div>
              <Label>Amount <span className="text-destructive">*</span></Label>
              <Input value={createForm.amount} onChange={(e) => setCreate('amount', e.target.value)} />
            </div>
            <div>
              <Label>Expiry Date</Label>
              <Input maxLength={20} placeholder="e.g. 31-DEC-26" value={createForm.expiryDate} onChange={(e) => setCreate('expiryDate', e.target.value)} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={createForm.status} onValueChange={(v) => setCreate('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="flex justify-between">
                Tag
                <span className={createForm.tag.length > TAG_MAX ? 'text-destructive' : 'text-muted-foreground'}>
                  {createForm.tag.length}/{TAG_MAX}
                </span>
              </Label>
              <Textarea rows={3} value={createForm.tag} onChange={(e) => setCreate('tag', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={loading}>Create Bundle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={Boolean(editBundle)} onOpenChange={(open) => { if (!open) setEditBundle(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Bundle</DialogTitle></DialogHeader>
          {editBundle && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div><Label>PCID</Label><Input value={editForm.pcid} disabled className="bg-muted" /></div>
              <div><Label>Bundle ID</Label><Input value={editForm.bundleId} disabled className="bg-muted" /></div>
              <div><Label>Biller Name</Label><Input maxLength={30} value={editForm.billerName} onChange={(e) => setEdit('billerName', e.target.value)} /></div>
              <div><Label>Bundle Name</Label><Input maxLength={100} value={editForm.bundleName} onChange={(e) => setEdit('bundleName', e.target.value)} /></div>
              <div className="col-span-2"><Label>Description</Label><Input maxLength={500} value={editForm.description} onChange={(e) => setEdit('description', e.target.value)} /></div>
              <div><Label>Amount</Label><Input value={editForm.amount} onChange={(e) => setEdit('amount', e.target.value)} /></div>
              <div><Label>Expiry Date</Label><Input maxLength={20} value={editForm.expiryDate} onChange={(e) => setEdit('expiryDate', e.target.value)} /></div>
              <div>
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEdit('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="flex justify-between">
                  Tag
                  <span className={editForm.tag.length > TAG_MAX ? 'text-destructive' : 'text-muted-foreground'}>
                    {editForm.tag.length}/{TAG_MAX}
                  </span>
                </Label>
                <Textarea rows={3} value={editForm.tag} onChange={(e) => setEdit('tag', e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBundle(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={loading}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Bundle</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete <strong>{deleteTarget?.bundleName}</strong> ({deleteTarget?.bundleId})? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link biller dialog */}
      <Dialog open={Boolean(linkTarget)} onOpenChange={(open) => { if (!open) setLinkTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Link Biller to PCID &quot;{linkTarget?.pcid}&quot;</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">
            Linking a biller scopes the SaaS gateway APIs to that biller&apos;s students when this PCID&apos;s API key is used.
          </p>
          <div className="space-y-2 pt-2">
            <Label>Biller</Label>
            <Select value={linkBillerId} onValueChange={setLinkBillerId}>
              <SelectTrigger><SelectValue placeholder="Select biller…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__unlink__">— Unlink —</SelectItem>
                {billers.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name} ({b.billerCode})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkTarget(null)}>Cancel</Button>
            <Button onClick={saveLinkBiller} disabled={loading}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <FilterBar
        searchPlaceholder="Search bundles…"
        onSearch={setSearch}
        filters={[{
          key: 'status',
          label: 'Status',
          options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }],
        }]}
        onFilterChange={(key, v) => { if (key === 'status') setStatusFilter(v); }}
      />

      {pcidGroups.length > 1 && (
        <div className="flex items-center gap-2 text-xs">
          <button className="text-muted-foreground hover:text-foreground underline" onClick={expandAll}>Expand all</button>
          <span className="text-muted-foreground">·</span>
          <button className="text-muted-foreground hover:text-foreground underline" onClick={collapseAll}>Collapse all</button>
          <span className="text-muted-foreground ml-1">— {pcidGroups.length} PCIDs, {allBundles.length} bundles total</span>
        </div>
      )}

      {loading && <p className="text-center text-muted-foreground py-10">Loading…</p>}
      {!loading && pcidGroups.length === 0 && (
        <div className="text-center text-muted-foreground py-16">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No bundles found. Click &quot;Add Bundle&quot; to get started.</p>
        </div>
      )}

      {/* PCID accordion groups */}
      <div className="space-y-3">
        {pcidGroups.map((group) => {
          const isOpen = expanded.has(group.pcid);
          const pk = group.pcidKey;
          const keyVisible = visibleKeys.has(group.pcid);

          return (
            <Card key={group.pcid} className="overflow-hidden">
              <CardHeader className="py-3 px-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
                  <button
                    className="flex items-center gap-2 font-semibold text-sm min-w-0 hover:text-primary"
                    onClick={() => toggleExpand(group.pcid)}
                  >
                    {isOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                    <span className="font-mono">{group.pcid}</span>
                    <span className="text-muted-foreground font-normal truncate">{group.billerName}</span>
                    <Badge variant="secondary" className="text-xs">
                      {group.bundles.length} bundle{group.bundles.length !== 1 ? 's' : ''}
                    </Badge>
                  </button>

                  <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                    {pk?.billerId ? (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-400/40 bg-green-500/5">
                        <Link2 className="w-2.5 h-2.5 mr-1" />
                        {pk.billerName ?? 'Linked'}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-400/40 bg-yellow-500/5">
                        Not linked to biller
                      </Badge>
                    )}

                    {pk ? (
                      <>
                        <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded border">
                          {keyVisible ? pk.apiKey : '••••••••••••••••••••••••'}
                        </span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleKeyVisible(group.pcid)}>
                          {keyVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyKey(pk.apiKey, group.pcid)}>
                          {copiedKey === group.pcid ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                          title="Regenerate API key"
                          onClick={() => void handleRegenerateKey(group.pcid)}
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Link biller" onClick={() => openLinkBiller(pk)}>
                          <Link2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">No API key yet</span>
                    )}

                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openCreate(group.pcid)}>
                      <Plus className="w-3 h-3 mr-1" /> Add Bundle
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {isOpen && (
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Bundle ID</TableHead>
                        <TableHead>Bundle Name</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Expiry</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.bundles.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell className="font-mono text-xs">{b.bundleId}</TableCell>
                          <TableCell className="font-medium">{b.bundleName}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {isNaN(Number(b.amount)) ? b.amount : new Intl.NumberFormat('en-PK').format(Number(b.amount))}
                          </TableCell>
                          <TableCell>{b.expiryDate || '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">{b.description || '—'}</TableCell>
                          <TableCell><StatusBadge status={b.status} /></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(b)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget(b)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default BundleManagement;
