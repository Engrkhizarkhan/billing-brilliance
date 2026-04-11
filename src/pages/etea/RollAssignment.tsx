import { useEffect, useMemo, useState } from 'react';
import { Applicant } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FilterBar } from '@/components/FilterBar';
import { StatusBadge } from '@/components/StatusBadge';
import { toast } from 'sonner';
import { CheckCircle2, ClipboardList, Hash, Loader2, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { EteaPosting } from '@/types';

const centers = ['Peshawar', 'Mardan', 'Abbottabad', 'Swat', 'Kohat', 'Bannu'];
const timeSlots = ['09:00 AM', '11:30 AM', '02:30 PM'];

type Assignment = Applicant & {
  slot?: string;
  center?: string;
  admitCardSent?: boolean;
};

const RollAssignment = () => {
  const [search, setSearch] = useState('');
  const [postingFilter, setPostingFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState<'all' | 'pending' | 'scheduled' | 'assigned'>('pending');
  const { data: applicantsData, loading: loadingApplicants } = useApiQuery(() => api.fetchApplicants({}), []);
  const { data: postingsData, loading: loadingPostings } = useApiQuery(() => api.fetchPostings(), []);
  const allApplicants = useMemo(() => (applicantsData || []) as Applicant[], [applicantsData]);
  const postingsList = (postingsData || []) as EteaPosting[];
  const [rows, setRows] = useState<Assignment[]>([]);

  useEffect(() => {
    if (allApplicants.length > 0 && rows.length === 0) {
      setRows(
        allApplicants.map((applicant, idx) => ({
          ...applicant,
          slot: applicant.rollNumber ? timeSlots[idx % timeSlots.length] : undefined,
          center: applicant.testCenter,
          admitCardSent: applicant.rollNumber ? true : false,
        }))
      );
    }
  }, [allApplicants, rows.length]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const matchSearch =
        row.name.toLowerCase().includes(search.toLowerCase()) ||
        row.cnic.includes(search) ||
        (row.rollNumber || '').toLowerCase().includes(search.toLowerCase());
      const matchPosting = postingFilter === 'all' || row.serviceId === postingFilter;
      const matchStage = (() => {
        if (stageFilter === 'all') return true;
        if (stageFilter === 'scheduled') return Boolean(row.testCenter && row.slot);
        if (stageFilter === 'assigned') return Boolean(row.rollNumber);
        return !row.rollNumber;
      })();
      return matchSearch && matchPosting && matchStage;
    });
  }, [rows, search, postingFilter, stageFilter]);

  const assignRoll = (id: string) => {
    setRows((prev) =>
      prev.map((row, idx) => {
        if (row.id !== id) return row;
        const rollNumber = row.rollNumber || `MDCAT-${String(300000 + idx).padStart(6, '0')}`;
        const center = row.center || centers[idx % centers.length];
        const slot = row.slot || timeSlots[idx % timeSlots.length];
        toast.success(`Roll ${rollNumber} assigned to ${row.name}`);
        return { ...row, rollNumber, center, slot };
      })
    );
  };

  const sendAdmitCard = (id: string) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, admitCardSent: true } : row)));
    const applicant = rows.find((r) => r.id === id);
    toast.success(applicant ? `${applicant.name} — admit card queued` : 'Admit card queued');
  };

  if (loadingApplicants || loadingPostings) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-header">Roll Assignment</h1>
          <p className="page-description">Assign roll numbers, slots, and centers before issuing admit cards.</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">{rows.filter((r) => r.rollNumber).length} assigned</Badge>
          <Badge variant="secondary">{rows.filter((r) => r.admitCardSent).length} admit cards sent</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle>Assignment queue</CardTitle>
            <CardDescription>Filter applicants by posting and stage to batch assign roll numbers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FilterBar
              searchPlaceholder="Search name, CNIC, or roll number…"
              onSearch={setSearch}
              filters={[{
                key: 'posting',
                label: 'Posting',
                options: postingsList.map((p) => ({ value: p.id, label: p.title }))
              }]}
              onFilterChange={(_, value) => setPostingFilter(value === 'all' ? 'all' : value)}
            />

            <div className="flex flex-wrap gap-2">
              {[
                { key: 'pending', label: 'Pending' },
                { key: 'assigned', label: 'Roll assigned' },
                { key: 'scheduled', label: 'Scheduled' },
                { key: 'all', label: 'All' },
              ].map((item) => (
                <Button
                  key={item.key}
                  size="sm"
                  variant={stageFilter === item.key ? 'default' : 'outline'}
                  className="rounded-full"
                  onClick={() => setStageFilter(item.key as typeof stageFilter)}
                >
                  {item.label}
                </Button>
              ))}
            </div>

            <div className="table-container">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Posting</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Roll / Center</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 12).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium">{row.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{row.cnic}</div>
                      </TableCell>
                      <TableCell className="space-y-1">
                        <p className="text-sm font-medium">{postingsList.find((p) => p.id === row.serviceId)?.title || '—'}</p>
                        <p className="text-xs text-muted-foreground">Bill #{row.billId}</p>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.applicationStatus} />
                        <div className="mt-1 text-xs text-muted-foreground">Payment: {row.paymentStatus}</div>
                      </TableCell>
                      <TableCell>
                        {row.rollNumber ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-sm font-semibold">
                              <Hash className="w-4 h-4 text-primary" />{row.rollNumber}
                            </div>
                            <p className="text-xs text-muted-foreground">{row.center || 'Center not set'} • {row.slot || 'Slot pending'}</p>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">Not assigned</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" className="rounded-lg" onClick={() => assignRoll(row.id)}>
                            <ClipboardList className="w-4 h-4 mr-1" />Assign
                          </Button>
                          <Button size="sm" className="rounded-lg" variant={row.admitCardSent ? 'secondary' : 'default'} onClick={() => sendAdmitCard(row.id)}>
                            <Send className="w-4 h-4 mr-1" />{row.admitCardSent ? 'Queued' : 'Send card'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Slot planner</CardTitle>
            <CardDescription>Set a default center and slot before bulk assigning.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Default center</Label>
              <Select onValueChange={(center) => setRows((prev) => prev.map((row) => ({ ...row, center })))}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Select center" /></SelectTrigger>
                <SelectContent>
                  {centers.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Default slot</Label>
              <Select onValueChange={(slot) => setRows((prev) => prev.map((row) => ({ ...row, slot })))}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Select slot" /></SelectTrigger>
                <SelectContent>
                  {timeSlots.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Manual roll prefix</Label>
              <Input placeholder="MDCAT-2025-" className="rounded-xl" />
              <p className="text-xs text-muted-foreground">Prefix applies to new assignments only.</p>
            </div>
            <Button className="w-full rounded-lg" onClick={() => toast.success('Defaults applied to visible rows (mock)')}>
              <CheckCircle2 className="w-4 h-4 mr-1" />Apply to queue
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RollAssignment;
