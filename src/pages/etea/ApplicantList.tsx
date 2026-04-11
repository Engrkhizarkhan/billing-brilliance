import { useEffect, useMemo, useState } from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterBar } from '@/components/FilterBar';
import { ExportButton } from '@/components/ExportButton';
import { TablePagination } from '@/components/TablePagination';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, Loader2, MoreHorizontal, UserPlus, Wallet } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { resolvePostingById, setEteaFinanceCache } from '@/lib/eteaFinance';
import { useNavigate } from 'react-router-dom';
import { usePaymentStore } from '@/store/paymentStore';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { Applicant, EteaPosting } from '@/types';

type ReferenceStatus = 'submitted' | 'fee_pending' | 'fee_paid' | 'external';
type ReferenceStatusFilter = 'all' | ReferenceStatus;

const referenceStatusLabels: Record<ReferenceStatus, string> = {
  submitted: 'Submitted',
  fee_pending: 'Fee Pending',
  fee_paid: 'Fee Paid',
  external: 'External Stage',
};

const referenceStatusColors: Record<ReferenceStatus, string> = {
  submitted: 'bg-muted text-muted-foreground',
  fee_pending: 'bg-warning/10 text-warning',
  fee_paid: 'bg-success/10 text-success',
  external: 'bg-primary/10 text-primary',
};

const normalizeReferenceStatus = (status: string): ReferenceStatus => {
  if (status === 'submitted' || status === 'fee_pending' || status === 'fee_paid') {
    return status;
  }
  return 'external';
};

const ApplicantList = () => {
  const paymentVersion = usePaymentStore((state) => state.version);
  const { data: applicantsData, loading: loadingApplicants } = useApiQuery(() => api.fetchApplicants({}), [paymentVersion]);
  const { data: postingsData, loading: loadingPostings } = useApiQuery(() => api.fetchPostings(), []);
  const applicantList = useMemo(() => (applicantsData || []) as Applicant[], [applicantsData]);
  const postingsList = useMemo(() => (postingsData || []) as EteaPosting[], [postingsData]);
  const navigate = useNavigate();

  useEffect(() => {
    if (postingsData) setEteaFinanceCache(postingsData as EteaPosting[], []);
  }, [postingsData]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReferenceStatusFilter>('all');
  const [postingFilter, setPostingFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const postingFilterOptions = useMemo(() => {
    const optionMap = new Map<string, string>();
    applicantList.forEach((applicant) => {
      optionMap.set(applicant.serviceId, resolvePostingById(applicant.serviceId).title);
    });
    postingsList.forEach((posting) => {
      if (posting.status !== 'closed') {
        optionMap.set(posting.id, posting.title);
      }
    });
    return Array.from(optionMap.entries()).map(([value, label]) => ({ value, label }));
  }, [applicantList, postingsList]);

  const statusFilterOptions = useMemo(() => {
    const counts: Record<ReferenceStatus, number> = {
      submitted: 0,
      fee_pending: 0,
      fee_paid: 0,
      external: 0,
    };

    applicantList.forEach((applicant) => {
      const normalized = normalizeReferenceStatus(applicant.applicationStatus);
      counts[normalized] += 1;
    });

    return (Object.keys(referenceStatusLabels) as ReferenceStatus[]).map((status) => ({
      value: status,
      label: `${referenceStatusLabels[status]} (${counts[status]})`,
    }));
  }, [applicantList]);

  const filtered = applicantList.filter((applicant) => {
    const query = search.toLowerCase();
    const matchSearch =
      applicant.id.toLowerCase().includes(query) ||
      applicant.name.toLowerCase().includes(query) ||
      applicant.cnic.includes(search);
    const normalizedStatus = normalizeReferenceStatus(applicant.applicationStatus);
    const matchStatus = statusFilter === 'all' || normalizedStatus === statusFilter;
    const matchPosting = postingFilter === 'all' || applicant.serviceId === postingFilter;
    return matchSearch && matchStatus && matchPosting;
  });

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  if (loadingApplicants || loadingPostings) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Application References</h1>
          <p className="page-description">
            Read-only references synced from source system for payment processing. Local student or applicant ownership is not maintained here. ({applicantList.length} total)
          </p>
        </div>
        <div className="flex gap-2">
          <ExportButton
            data={filtered.map((applicant) => ({
              ReferenceId: applicant.id,
              ApplicationId: applicant.id,
              ApplicantId: applicant.id,
              Name: applicant.name,
              CNIC: applicant.cnic,
              PostingId: applicant.serviceId,
              Posting: resolvePostingById(applicant.serviceId).title,
              PaymentStatus: applicant.paymentStatus,
              ReferenceStatus: referenceStatusLabels[normalizeReferenceStatus(applicant.applicationStatus)],
            }))}
            filename="etea-application-references"
          />
          <Button variant="outline" size="sm" className="rounded-lg" onClick={() => navigate('/etea/payments')}>
            <Wallet className="w-4 h-4 mr-1.5" />Open Payment Controller
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
        Payment processor boundary: references are used for payment workflow only. Student or applicant master records are owned by the source authority. Any non-payment pipeline stage from source data is grouped as External Stage.
      </div>

      <FilterBar
        searchPlaceholder="Search by reference ID, name, or CNIC..."
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        filters={[
          {
            key: 'status',
            label: 'Filter by Reference Status',
            options: statusFilterOptions,
          },
          {
            key: 'posting',
            label: 'Filter by Posting',
            options: postingFilterOptions,
          },
        ]}
        onFilterChange={(key, value) => {
          if (key === 'status') {
            setStatusFilter(value as ReferenceStatusFilter);
          }
          if (key === 'posting') {
            setPostingFilter(value === 'all' ? 'all' : value);
          }
          setPage(1);
        }}
      />

      <div className="table-container">
        <div className="px-5 py-3 border-b border-border">
          <p className="text-sm font-semibold">
            Application References <span className="text-muted-foreground font-normal ml-2">({filtered.length})</span>
          </p>
        </div>

        {paginated.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="No application references"
            description="No source references are available yet. Sync references from the source system before creating payment requests."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold">Reference ID</TableHead>
                <TableHead className="text-xs font-semibold">Name</TableHead>
                <TableHead className="text-xs font-semibold">CNIC</TableHead>
                <TableHead className="text-xs font-semibold">District</TableHead>
                <TableHead className="text-xs font-semibold">Posting</TableHead>
                <TableHead className="text-xs font-semibold">Payment</TableHead>
                <TableHead className="text-xs font-semibold">Reference Status</TableHead>
                <TableHead className="text-xs font-semibold w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((applicant) => (
                <TableRow key={applicant.id} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-xs">{applicant.id}</TableCell>
                  <TableCell className="font-medium text-sm">{applicant.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{applicant.cnic}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{applicant.district}</TableCell>
                  <TableCell className="text-xs">
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md">{resolvePostingById(applicant.serviceId).title}</span>
                  </TableCell>
                  <TableCell><StatusBadge status={applicant.paymentStatus} /></TableCell>
                  <TableCell>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${referenceStatusColors[normalizeReferenceStatus(applicant.applicationStatus)]}`}>
                      {referenceStatusLabels[normalizeReferenceStatus(applicant.applicationStatus)]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="w-4 h-4 mr-2" />View Reference
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/etea/payments?application=${applicant.id}`)}>
                          Open Payment Request
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <TablePagination
          total={filtered.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
};

export default ApplicantList;
