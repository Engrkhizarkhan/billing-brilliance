import { useMemo, useState } from 'react';
import { applicants, eteaPostings } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterBar } from '@/components/FilterBar';
import { ExportButton } from '@/components/ExportButton';
import { TablePagination } from '@/components/TablePagination';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, MoreHorizontal, UserPlus, Wallet } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { resolvePostingById } from '@/lib/etaFinance';
import { useNavigate } from 'react-router-dom';
import { usePaymentStore } from '@/store/paymentStore';

const statusLabels: Record<string, string> = {
  submitted: 'Submitted',
  fee_pending: 'Fee Pending',
  fee_paid: 'Fee Paid',
  roll_assigned: 'Roll Assigned',
  test_scheduled: 'Test Scheduled',
  appeared: 'Appeared',
  result_pending: 'Result Pending',
  selected: 'Selected',
  rejected: 'Rejected',
};

const statusColors: Record<string, string> = {
  submitted: 'bg-muted text-muted-foreground',
  fee_pending: 'bg-warning/10 text-warning',
  fee_paid: 'bg-success/10 text-success',
  roll_assigned: 'bg-primary/10 text-primary',
  test_scheduled: 'bg-info/10 text-info',
  appeared: 'bg-primary/10 text-primary',
  result_pending: 'bg-warning/10 text-warning',
  selected: 'bg-success/10 text-success',
  rejected: 'bg-destructive/10 text-destructive',
};

const ApplicantList = () => {
  const paymentVersion = usePaymentStore((state) => state.version);
  const applicantList = useMemo(() => [...applicants], [paymentVersion]);
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [postingFilter, setPostingFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const postingFilterOptions = useMemo(() => {
    const optionMap = new Map<string, string>();
    applicantList.forEach((applicant) => {
      optionMap.set(applicant.serviceId, resolvePostingById(applicant.serviceId).title);
    });
    eteaPostings.forEach((posting) => {
      if (posting.status !== 'closed') {
        optionMap.set(posting.id, posting.title);
      }
    });
    return Array.from(optionMap.entries()).map(([value, label]) => ({ value, label }));
  }, [applicantList]);

  const filtered = applicantList.filter((applicant) => {
    const query = search.toLowerCase();
    const matchSearch =
      applicant.id.toLowerCase().includes(query) ||
      applicant.name.toLowerCase().includes(query) ||
      applicant.cnic.includes(search) ||
      (applicant.rollNumber || '').toLowerCase().includes(query);
    const matchStatus = statusFilter === 'all' || applicant.applicationStatus === statusFilter;
    const matchPosting = postingFilter === 'all' || applicant.serviceId === postingFilter;
    return matchSearch && matchStatus && matchPosting;
  });

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

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
              Name: applicant.name,
              Father: applicant.fatherName,
              CNIC: applicant.cnic,
              District: applicant.district,
              Posting: resolvePostingById(applicant.serviceId).title,
              PaymentStatus: applicant.paymentStatus,
              ApplicationStatus: applicant.applicationStatus,
            }))}
            filename="eta-application-references"
          />
          <Button variant="outline" size="sm" className="rounded-lg" onClick={() => navigate('/eta/payments')}>
            <Wallet className="w-4 h-4 mr-1.5" />Open Payment Controller
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
        Payment processor boundary: references are used for payment workflow only. Student or applicant master records are owned by the source ETA or ETEA system.
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(statusLabels).map(([key, label]) => {
          const count = applicantList.filter((applicant) => applicant.applicationStatus === key).length;
          return (
            <button
              key={key}
              onClick={() => {
                setStatusFilter(key === statusFilter ? 'all' : key);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                statusFilter === key
                  ? `${statusColors[key]} border-current`
                  : 'border-border text-muted-foreground hover:border-foreground/20'
              }`}
            >
              {label} <span className="ml-1 font-mono">{count}</span>
            </button>
          );
        })}
      </div>

      <FilterBar
        searchPlaceholder="Search by reference ID, name, CNIC, or roll number..."
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        filters={[
          {
            key: 'posting',
            label: 'Filter by Posting',
            options: postingFilterOptions,
          },
        ]}
        onFilterChange={(_, value) => {
          setPostingFilter(value === 'all' ? 'all' : value);
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
            description="No source references are available yet. Sync references from ETA or ETEA source before creating payment requests."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold">Reference ID</TableHead>
                <TableHead className="text-xs font-semibold">Name</TableHead>
                <TableHead className="text-xs font-semibold">Father Name</TableHead>
                <TableHead className="text-xs font-semibold">CNIC</TableHead>
                <TableHead className="text-xs font-semibold">District</TableHead>
                <TableHead className="text-xs font-semibold">Posting</TableHead>
                <TableHead className="text-xs font-semibold">Payment</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold">Roll #</TableHead>
                <TableHead className="text-xs font-semibold w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((applicant) => (
                <TableRow key={applicant.id} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-xs">{applicant.id}</TableCell>
                  <TableCell className="font-medium text-sm">{applicant.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{applicant.fatherName}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{applicant.cnic}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{applicant.district}</TableCell>
                  <TableCell className="text-xs">
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md">{resolvePostingById(applicant.serviceId).title}</span>
                  </TableCell>
                  <TableCell><StatusBadge status={applicant.paymentStatus} /></TableCell>
                  <TableCell>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusColors[applicant.applicationStatus]}`}>
                      {statusLabels[applicant.applicationStatus]}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{applicant.rollNumber || '-'}</TableCell>
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
                        <DropdownMenuItem onClick={() => navigate(`/eta/payments?application=${applicant.id}`)}>
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
