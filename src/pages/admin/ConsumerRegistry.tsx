import { useState } from 'react';
import { AlertCircle, Check, Clipboard, GraduationCap, Hash, ReceiptText, Search, UserRoundCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { ConsumerRegistryMeta, ConsumerRegistryRecord } from '@/types';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { TablePagination } from '@/components/TablePagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const sourceLabels: Record<ConsumerRegistryRecord['sourceType'], string> = {
  school_student: 'School student',
  organization_applicant: 'Organization applicant',
  payment_request: 'Payment request',
};

const ConsumerRegistry = () => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [sourceType, setSourceType] = useState('all');
  const [tenantId, setTenantId] = useState('all');
  const [tenantType, setTenantType] = useState('all');
  const [tenantStatus, setTenantStatus] = useState('all');
  const [lifecycleStage, setLifecycleStage] = useState('all');
  const [recordStatus, setRecordStatus] = useState('all');
  const [consumerLength, setConsumerLength] = useState('all');
  const [archiveState, setArchiveState] = useState('all');
  const [copied, setCopied] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());

  const { data, meta, loading, error } = useApiQuery<ConsumerRegistryRecord[], ConsumerRegistryMeta>(
    () => api.fetchConsumerRegistry({
      page,
      pageSize,
      search: debouncedSearch || undefined,
      sourceType: sourceType === 'all' ? undefined : sourceType,
      tenantId: tenantId === 'all' ? undefined : tenantId,
      tenantType: tenantType === 'all' ? undefined : tenantType,
      tenantStatus: tenantStatus === 'all' ? undefined : tenantStatus,
      lifecycleStage: lifecycleStage === 'all' ? undefined : lifecycleStage,
      recordStatus: recordStatus === 'all' ? undefined : recordStatus,
      consumerLength: consumerLength === 'all' ? undefined : Number(consumerLength),
      archiveState: archiveState === 'all' ? undefined : archiveState,
    }),
    [page, pageSize, debouncedSearch, sourceType, tenantId, tenantType, tenantStatus, lifecycleStage, recordStatus, consumerLength, archiveState]
  );

  const updateFilter = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };
  const counts = meta?.bySource || { schoolStudent: 0, organizationApplicant: 0, paymentRequest: 0 };

  const copyConsumer = async (consumerNumber: string) => {
    await navigator.clipboard.writeText(consumerNumber);
    setCopied(consumerNumber);
    toast.success('Consumer number copied');
    window.setTimeout(() => setCopied(''), 1500);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Consumer Numbers</h1>
        <p className="page-description">Search and audit every issued consumer number across all tenants and identifier sources.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Matching numbers" value={meta?.total || 0} icon={Hash} />
        <StatCard title="School students" value={counts.schoolStudent} icon={GraduationCap} />
        <StatCard title="Org applicants" value={counts.organizationApplicant} icon={UserRoundCheck} />
        <StatCard title="Payment requests" value={counts.paymentRequest} icon={ReceiptText} />
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search consumer numbers"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Consumer number, owner, bill, reference, or biller..."
              className="pl-10"
            />
          </div>

          <Select value={tenantId} onValueChange={updateFilter(setTenantId)}>
            <SelectTrigger aria-label="Filter by biller"><SelectValue placeholder="All billers" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All billers</SelectItem>
              {(meta?.tenants || []).map((tenant) => (
                <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}{tenant.lifecycleStage === 'offboarding' ? ' (offboarded)' : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sourceType} onValueChange={updateFilter(setSourceType)}>
            <SelectTrigger aria-label="Filter by source"><SelectValue placeholder="All sources" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="school_student">School students</SelectItem>
              <SelectItem value="organization_applicant">Organization applicants</SelectItem>
              <SelectItem value="payment_request">Payment requests</SelectItem>
            </SelectContent>
          </Select>

          <Select value={tenantType} onValueChange={updateFilter(setTenantType)}>
            <SelectTrigger aria-label="Filter by tenant type"><SelectValue placeholder="All tenant types" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All tenant types</SelectItem><SelectItem value="school">Schools</SelectItem><SelectItem value="org">Organizations</SelectItem><SelectItem value="private_agency">Private agencies</SelectItem></SelectContent>
          </Select>

          <Select value={tenantStatus} onValueChange={updateFilter(setTenantStatus)}>
            <SelectTrigger aria-label="Filter by tenant status"><SelectValue placeholder="All account states" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All account states</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="suspended">Suspended</SelectItem><SelectItem value="banned">Banned</SelectItem></SelectContent>
          </Select>

          <Select value={lifecycleStage} onValueChange={updateFilter(setLifecycleStage)}>
            <SelectTrigger aria-label="Filter by lifecycle"><SelectValue placeholder="All lifecycles" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All lifecycles</SelectItem><SelectItem value="testing">Testing</SelectItem><SelectItem value="ready_for_live">Ready for live</SelectItem><SelectItem value="live">Live</SelectItem><SelectItem value="offboarding">Offboarding</SelectItem></SelectContent>
          </Select>

          <Select value={recordStatus} onValueChange={updateFilter(setRecordStatus)}>
            <SelectTrigger aria-label="Filter by record status"><SelectValue placeholder="All record states" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All record states</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem><SelectItem value="fee_pending">Fee pending</SelectItem><SelectItem value="fee_paid">Fee paid</SelectItem>
              <SelectItem value="pending">Pending</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="failed">Failed</SelectItem><SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>

          <Select value={consumerLength} onValueChange={updateFilter(setConsumerLength)}>
            <SelectTrigger aria-label="Filter by number length"><SelectValue placeholder="All lengths" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All lengths</SelectItem><SelectItem value="14">14 digits</SelectItem><SelectItem value="20">20 digits (legacy)</SelectItem><SelectItem value="24">24 digits</SelectItem></SelectContent>
          </Select>

          <Select value={archiveState} onValueChange={updateFilter(setArchiveState)}>
            <SelectTrigger aria-label="Filter by archive state"><SelectValue placeholder="Current and archived" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Current and archived</SelectItem><SelectItem value="current">Current only</SelectItem><SelectItem value="archived">Archived only</SelectItem></SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />{error}
        </div>
      )}

      <div className="table-container overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Consumer number</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Biller</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Record status</TableHead>
              <TableHead>Bill / reference</TableHead>
              <TableHead>Issued</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data || []).map((record) => (
              <TableRow key={`${record.sourceType}-${record.sourceId}`}>
                <TableCell>
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <span className="font-mono text-xs font-semibold">{record.consumerNumber}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Copy consumer number" aria-label={`Copy ${record.consumerNumber}`} onClick={() => void copyConsumer(record.consumerNumber)}>
                      {copied === record.consumerNumber ? <Check className="h-3.5 w-3.5 text-success" /> : <Clipboard className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{record.consumerNumber.length} digits</span>
                </TableCell>
                <TableCell><p className="font-medium">{record.ownerName}</p>{record.secondaryStatus && record.secondaryStatus !== record.recordStatus && <p className="text-xs capitalize text-muted-foreground">Payment: {record.secondaryStatus.replaceAll('_', ' ')}</p>}</TableCell>
                <TableCell><p className="font-medium">{record.tenantName}</p><p className="text-xs text-muted-foreground">{record.billerCode} · {record.tenantType.replace('_', ' ')}</p><div className="mt-1 flex gap-1"><StatusBadge status={record.tenantStatus} /><Badge variant="outline" className="capitalize">{record.lifecycleStage.replaceAll('_', ' ')}</Badge></div></TableCell>
                <TableCell><Badge variant="secondary">{sourceLabels[record.sourceType]}</Badge>{(record.recordArchived || record.tenantArchived) ? <Badge variant="outline" className="ml-1 border-amber-400 text-amber-700">Archived</Badge> : null}</TableCell>
                <TableCell><StatusBadge status={record.recordStatus} /></TableCell>
                <TableCell><p className="font-mono text-xs">{record.billId}</p>{record.externalReference && <p className="mt-1 max-w-[220px] truncate text-xs text-muted-foreground" title={record.externalReference}>{record.externalReference}</p>}{record.amount != null && <p className="mt-1 text-xs font-medium">PKR {Number(record.amount).toLocaleString('en-PK')}</p>}</TableCell>
                <TableCell className="whitespace-nowrap text-sm">{new Date(record.createdAt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!loading && !error && (data || []).length === 0 && <EmptyState icon={Hash} title="No consumer numbers found" description="Adjust the filters or search to view issued identifiers." />}
        {loading && <div className="py-16 text-center text-sm text-muted-foreground">Loading consumer numbers…</div>}
        <TablePagination total={meta?.total || 0} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>
    </div>
  );
};

export default ConsumerRegistry;
