import { useMemo, useState } from 'react';
import { applicants, services } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterBar } from '@/components/FilterBar';
import { toast } from 'sonner';
import { Plus, Users, CheckCircle2, Search } from 'lucide-react';

interface ServiceAssignment {
  id: string;
  applicantName: string;
  cnic: string;
  consumerNumber: string;
  serviceName: string;
  amount: number;
  paymentType: string;
  status: 'active' | 'pending' | 'completed';
  assignedDate: string;
  nextDue: string;
}

const initialAssignments: ServiceAssignment[] = [
  { id: 'sa1', applicantName: 'Tariq Mehmood', cnic: '35201-1234567-1', consumerNumber: applicants[0].consumerNumber, serviceName: 'Visa Processing', amount: 50000, paymentType: 'one-time', status: 'active', assignedDate: '2025-01-15', nextDue: '2025-02-15' },
  { id: 'sa2', applicantName: 'Nazia Bibi', cnic: '35202-2345678-2', consumerNumber: applicants[1].consumerNumber, serviceName: 'Document Attestation', amount: 30000, paymentType: 'multiple', status: 'pending', assignedDate: '2025-02-01', nextDue: '2025-04-01' },
  { id: 'sa3', applicantName: 'Rafiq Ahmad', cnic: '35203-3456789-3', consumerNumber: applicants[2].consumerNumber, serviceName: 'Monthly Consultation', amount: 10000, paymentType: 'recurring', status: 'active', assignedDate: '2025-01-01', nextDue: '2025-04-01' },
  { id: 'sa4', applicantName: 'Saira Bano', cnic: '35204-4567890-4', consumerNumber: applicants[3].consumerNumber, serviceName: 'Immigration Filing', amount: 75000, paymentType: 'one-time', status: 'completed', assignedDate: '2025-01-10', nextDue: '-' },
];

const ETAPaymentPrograms = () => {
  const [assignments, setAssignments] = useState<ServiceAssignment[]>(initialAssignments);
  const [search, setSearch] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [selectedService, setSelectedService] = useState('');
  const [selectedApplicants, setSelectedApplicants] = useState<string[]>([]);
  const [bulkApplicantSearch, setBulkApplicantSearch] = useState('');
  const [singleApplicantSearch, setSingleApplicantSearch] = useState('');

  const filtered = assignments.filter((a) =>
    a.applicantName.toLowerCase().includes(search.toLowerCase()) || a.serviceName.toLowerCase().includes(search.toLowerCase())
  );

  const filteredBulkApplicants = useMemo(() => {
    const query = bulkApplicantSearch.trim().toLowerCase();
    const source = !query
      ? applicants
      : applicants.filter((applicant) =>
          applicant.name.toLowerCase().includes(query) ||
          applicant.cnic.includes(bulkApplicantSearch) ||
          applicant.consumerNumber.includes(bulkApplicantSearch)
        );
    return source.slice(0, 150);
  }, [bulkApplicantSearch]);

  const filteredSingleApplicants = useMemo(() => {
    const query = singleApplicantSearch.trim().toLowerCase();
    const source = !query
      ? applicants
      : applicants.filter((applicant) =>
          applicant.name.toLowerCase().includes(query) ||
          applicant.cnic.includes(singleApplicantSearch) ||
          applicant.consumerNumber.includes(singleApplicantSearch)
        );
    return source.slice(0, 150);
  }, [singleApplicantSearch]);

  const handleAssign = () => {
    if (!selectedService || selectedApplicants.length === 0) {
      toast.error('Select a service and at least one applicant');
      return;
    }
    const service = services.find((s) => s.id === selectedService);
    if (!service) return;

    const newAssignments: ServiceAssignment[] = selectedApplicants.map((aid, i) => {
      const applicant = applicants.find((a) => a.id === aid);
      return {
        id: `sa-new-${Date.now()}-${i}`,
        applicantName: applicant?.name || 'Unknown',
        cnic: applicant?.cnic || '',
        consumerNumber: applicant?.consumerNumber || '',
        serviceName: service.name,
        amount: service.amount,
        paymentType: service.paymentType,
        status: 'active' as const,
        assignedDate: new Date().toISOString().split('T')[0],
        nextDue: '2025-04-15',
      };
    });

    setAssignments([...assignments, ...newAssignments]);
    setAssignOpen(false);
    setBulkAssignOpen(false);
    setSelectedService('');
    setSelectedApplicants([]);
    setBulkApplicantSearch('');
    setSingleApplicantSearch('');
    toast.success(`${service.name} assigned to ${newAssignments.length} applicant(s)`);
  };

  const toggleApplicant = (id: string) => {
    setSelectedApplicants((prev) => prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]);
  };

  const selectAllApplicants = (candidateApplicantIds: string[]) => {
    const allSelected = candidateApplicantIds.length > 0 && candidateApplicantIds.every((id) => selectedApplicants.includes(id));
    if (allSelected) {
      setSelectedApplicants((prev) => prev.filter((id) => !candidateApplicantIds.includes(id)));
      return;
    }

    setSelectedApplicants((prev) => Array.from(new Set([...prev, ...candidateApplicantIds])));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Payment Programs</h1>
          <p className="page-description">Assign services to applicants and manage payment schedules</p>
        </div>
        <div className="flex gap-2">
          <Dialog
            open={bulkAssignOpen}
            onOpenChange={(open) => {
              setBulkAssignOpen(open);
              if (!open) {
                setBulkApplicantSearch('');
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-lg">
                <Users className="w-4 h-4 mr-1.5" />Bulk Assign
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Bulk Assign Service</DialogTitle></DialogHeader>
              <p className="text-xs text-muted-foreground -mt-1">Assign a service to multiple applicants at once.</p>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Select Service</Label>
                  <Select value={selectedService} onValueChange={setSelectedService}>
                    <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Choose a service" /></SelectTrigger>
                    <SelectContent>
                      {services.filter(s => s.status === 'active').map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} — ₨ {s.amount.toLocaleString()} ({s.paymentType})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Select Applicants ({selectedApplicants.length})</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[11px]"
                      onClick={() => selectAllApplicants(filteredBulkApplicants.map((applicant) => applicant.id))}
                    >
                      {filteredBulkApplicants.length > 0 && filteredBulkApplicants.every((applicant) => selectedApplicants.includes(applicant.id)) ? 'Deselect filtered' : 'Select filtered'}
                    </Button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={bulkApplicantSearch}
                      className="pl-10 h-10 rounded-xl"
                      placeholder="Search applicants by name, CNIC, or consumer #"
                      onChange={(e) => setBulkApplicantSearch(e.target.value)}
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto border rounded-xl p-2 space-y-0.5">
                    {filteredBulkApplicants.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-3">No applicants match your search.</p>
                    ) : filteredBulkApplicants.map((a) => (
                      <label key={a.id} className={`flex items-center gap-2.5 py-2.5 px-3 rounded-lg cursor-pointer transition-colors ${selectedApplicants.includes(a.id) ? 'bg-primary/5' : 'hover:bg-muted'}`}>
                        <Checkbox
                          checked={selectedApplicants.includes(a.id)}
                          onCheckedChange={() => toggleApplicant(a.id)}
                        />
                        <span className="text-sm flex-1">{a.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{a.cnic}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Showing up to 150 applicants. Use search to narrow down large lists.</p>
                </div>

                {selectedApplicants.length > 0 && selectedService && (
                  <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-primary">Ready to assign</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {services.find(s => s.id === selectedService)?.name} will be assigned to {selectedApplicants.length} applicant(s)
                      </p>
                    </div>
                  </div>
                )}

                <Button onClick={handleAssign} className="w-full h-10 rounded-xl">
                  Assign to {selectedApplicants.length} Applicant(s)
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog
            open={assignOpen}
            onOpenChange={(open) => {
              setAssignOpen(open);
              if (!open) {
                setSingleApplicantSearch('');
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-lg">
                <Plus className="w-4 h-4 mr-1.5" />Assign Service
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Assign Service to Applicant</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Service</Label>
                  <Select value={selectedService} onValueChange={setSelectedService}>
                    <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Choose a service" /></SelectTrigger>
                    <SelectContent>
                      {services.filter(s => s.status === 'active').map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} — ₨ {s.amount.toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Applicant</Label>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={singleApplicantSearch}
                      className="pl-10 h-10 rounded-xl"
                      placeholder="Search applicants by name, CNIC, or consumer #"
                      onChange={(e) => setSingleApplicantSearch(e.target.value)}
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto border rounded-xl p-2 space-y-0.5">
                    {filteredSingleApplicants.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-3">No applicants match your search.</p>
                    ) : filteredSingleApplicants.map((a) => (
                      <label key={a.id} className="flex items-center gap-2.5 py-2 px-2.5 rounded-lg hover:bg-muted cursor-pointer">
                        <Checkbox
                          checked={selectedApplicants.includes(a.id)}
                          onCheckedChange={() => toggleApplicant(a.id)}
                        />
                        <span className="text-sm">{a.name}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Showing up to 150 applicants. Use search to narrow down large lists.</p>
                </div>

                <Button onClick={handleAssign} className="w-full h-10 rounded-xl">Assign Service</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <FilterBar searchPlaceholder="Search by applicant or service…" onSearch={setSearch} />

      <div className="table-container">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <p className="text-sm font-semibold">
            Service Assignments
            <span className="text-muted-foreground font-normal ml-2">({filtered.length})</span>
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-semibold">Applicant</TableHead>
              <TableHead className="text-xs font-semibold">CNIC</TableHead>
              <TableHead className="text-xs font-semibold">Consumer #</TableHead>
              <TableHead className="text-xs font-semibold">Service</TableHead>
              <TableHead className="text-xs font-semibold">Amount</TableHead>
              <TableHead className="text-xs font-semibold">Type</TableHead>
              <TableHead className="text-xs font-semibold">Status</TableHead>
              <TableHead className="text-xs font-semibold">Next Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((a) => (
              <TableRow key={a.id} className="hover:bg-muted/30">
                <TableCell className="font-medium text-sm">{a.applicantName}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{a.cnic}</TableCell>
                <TableCell className="font-mono text-[11px] text-muted-foreground">{a.consumerNumber}</TableCell>
                <TableCell className="text-sm">{a.serviceName}</TableCell>
                <TableCell className="text-sm font-mono">₨ {a.amount.toLocaleString()}</TableCell>
                <TableCell>
                  <span className="text-xs font-medium bg-info/8 text-info px-2 py-0.5 rounded-md capitalize">{a.paymentType}</span>
                </TableCell>
                <TableCell><StatusBadge status={a.status} /></TableCell>
                <TableCell className="text-sm text-muted-foreground">{a.nextDue}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ETAPaymentPrograms;
