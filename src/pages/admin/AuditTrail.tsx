import { useState } from 'react';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { FilterBar } from '@/components/FilterBar';
import { ExportButton } from '@/components/ExportButton';
import { TablePagination } from '@/components/TablePagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ClipboardList, Plus, Pencil, Trash2, CreditCard, Loader2 } from 'lucide-react';
import { usePaymentStore } from '@/store/paymentStore';

const actionIcons: Record<string, React.ElementType> = { create: Plus, update: Pencil, delete: Trash2, payment: CreditCard };
const actionColors: Record<string, string> = { create: 'bg-success/10 text-success', update: 'bg-primary/10 text-primary', delete: 'bg-destructive/10 text-destructive', payment: 'bg-warning/10 text-warning' };

const AuditTrail = () => {
  const paymentVersion = usePaymentStore((state) => state.version);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: auditLogs, loading } = useApiQuery(() => api.fetchAuditLogs({ search: search || undefined }), [paymentVersion, search]);

  const allLogs = (auditLogs || []) as Array<{ id: string; userId: string; userName: string; action: string; entity: string; entityId: string; details: string; createdAt: string; ipAddress: string }>;
  const paginated = allLogs.slice((page - 1) * pageSize, page * pageSize);

  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="page-header">Audit Trail</h1><p className="page-description">Track all system actions across all portals</p></div>
        <ExportButton data={allLogs.map(l => ({ User: l.userName, Action: l.action, Entity: l.entity, Details: l.details, IP: l.ipAddress, Timestamp: l.createdAt }))} filename="audit-trail" />
      </div>
      <FilterBar searchPlaceholder="Search audit logs…" onSearch={v => { setSearch(v); setPage(1); }} />
      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-semibold w-10"></TableHead>
              <TableHead className="text-xs font-semibold">User</TableHead>
              <TableHead className="text-xs font-semibold">Action</TableHead>
              <TableHead className="text-xs font-semibold">Entity</TableHead>
              <TableHead className="text-xs font-semibold">Details</TableHead>
              <TableHead className="text-xs font-semibold">IP Address</TableHead>
              <TableHead className="text-xs font-semibold">Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map(l => {
              const Icon = actionIcons[l.action] || ClipboardList;
              return (
                <TableRow key={l.id} className="hover:bg-muted/30">
                  <TableCell><div className={`w-7 h-7 rounded-lg flex items-center justify-center ${actionColors[l.action] || 'bg-muted text-muted-foreground'}`}><Icon className="w-3.5 h-3.5" /></div></TableCell>
                  <TableCell className="font-medium text-sm">{l.userName}</TableCell>
                  <TableCell><span className="capitalize text-xs font-medium">{l.action}</span></TableCell>
                  <TableCell><span className="capitalize text-xs bg-muted px-2 py-0.5 rounded-md">{l.entity}</span></TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{l.details}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{l.ipAddress}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.createdAt ? new Date(l.createdAt).toLocaleString() : '—'}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <TablePagination total={allLogs.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>
    </div>
  );
};

export default AuditTrail;
