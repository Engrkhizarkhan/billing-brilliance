import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { FilterBar } from '@/components/FilterBar';
import { ExportButton } from '@/components/ExportButton';
import { TablePagination } from '@/components/TablePagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ClipboardList, Plus, Pencil, Trash2, CreditCard, Loader2, LogIn, LogOut, Key, ShieldCheck } from 'lucide-react';
import { AuditLog } from '@/types';

const actionIcons: Record<string, React.ElementType> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
  payment: CreditCard,
  login: LogIn,
  logout: LogOut,
  impersonate: ShieldCheck,
  verify_hash: Key,
  change_password: Key,
};
const actionColors: Record<string, string> = {
  create: 'bg-success/10 text-success',
  update: 'bg-primary/10 text-primary',
  delete: 'bg-destructive/10 text-destructive',
  payment: 'bg-warning/10 text-warning',
  login: 'bg-blue-500/10 text-blue-600',
  logout: 'bg-muted text-muted-foreground',
  impersonate: 'bg-orange-500/10 text-orange-600',
  verify_hash: 'bg-purple-500/10 text-purple-600',
  change_password: 'bg-purple-500/10 text-purple-600',
};

const ACTION_OPTIONS = [
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'payment', label: 'Payment' },
  { value: 'impersonate', label: 'Impersonate' },
  { value: 'change_password', label: 'Change Password' },
  { value: 'verify_hash', label: 'Verify Hash' },
];

const ENTITY_OPTIONS = [
  { value: 'user', label: 'User' },
  { value: 'student', label: 'Student' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'payment', label: 'Payment' },
  { value: 'tenant', label: 'Tenant' },
  { value: 'bundle', label: 'Bundle' },
  { value: 'fee_plan', label: 'Fee Plan' },
  { value: 'applicant', label: 'Applicant' },
  { value: 'settings', label: 'Settings' },
  { value: 'admin_tool', label: 'Admin Tool' },
];

const AuditTrail = () => {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.fetchAuditLogs({
        page,
        pageSize,
        search: search || undefined,
        action: actionFilter !== 'all' ? actionFilter : undefined,
        entity: entityFilter !== 'all' ? entityFilter : undefined,
      });
      setLogs((res.data as AuditLog[]) || []);
      setTotal(res.meta?.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, actionFilter, entityFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const resetPage = () => setPage(1);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Audit Trail</h1>
          <p className="page-description">Track all system actions across all portals</p>
        </div>
        <ExportButton
          data={logs.map(l => ({ User: l.userName, Action: l.action, Entity: l.entity, Details: l.details, IP: l.ipAddress, Timestamp: l.createdAt }))}
          filename="audit-trail"
        />
      </div>

      <FilterBar
        searchPlaceholder="Search by user, details, entity ID…"
        onSearch={v => { setSearch(v); resetPage(); }}
        filters={[
          { key: 'action', label: 'Action', options: ACTION_OPTIONS },
          { key: 'entity', label: 'Entity', options: ENTITY_OPTIONS },
        ]}
        onFilterChange={(key, value) => {
          if (key === 'action') setActionFilter(value);
          if (key === 'entity') setEntityFilter(value);
          resetPage();
        }}
      />

      <div className="table-container">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-semibold w-10" />
                  <TableHead className="text-xs font-semibold">User</TableHead>
                  <TableHead className="text-xs font-semibold">Action</TableHead>
                  <TableHead className="text-xs font-semibold">Entity</TableHead>
                  <TableHead className="text-xs font-semibold">Details</TableHead>
                  <TableHead className="text-xs font-semibold">IP Address</TableHead>
                  <TableHead className="text-xs font-semibold">Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                      No audit entries match the current filters.
                    </TableCell>
                  </TableRow>
                ) : logs.map(l => {
                  const Icon = actionIcons[l.action] || ClipboardList;
                  return (
                    <TableRow key={l.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${actionColors[l.action] || 'bg-muted text-muted-foreground'}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-sm">{l.userName}</TableCell>
                      <TableCell><span className="capitalize text-xs font-medium">{l.action.replace(/_/g, ' ')}</span></TableCell>
                      <TableCell><span className="capitalize text-xs bg-muted px-2 py-0.5 rounded-md">{l.entity}</span></TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate" title={l.details}>{l.details}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{l.ipAddress}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {l.createdAt ? new Date(l.createdAt).toLocaleString() : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <TablePagination
              total={total}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={s => { setPageSize(s); resetPage(); }}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default AuditTrail;
