import { useMemo, useState } from 'react';
import { applicants as initialApplicants, eteaPostings } from '@/data/mockData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { TrendingUp, UploadCloud } from 'lucide-react';

const Results = () => {
  const [search, setSearch] = useState('');
  const [publishOnline, setPublishOnline] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [published, setPublished] = useState(false);

  const appeared = useMemo(() => initialApplicants.filter((a) => a.applicationStatus === 'appeared' || a.marks !== undefined), []);
  const filtered = appeared.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()) || (a.rollNumber || '').includes(search));

  const handlePublish = () => {
    setPublished(true);
    toast.success('Results published (mock) — candidates can now view online');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-header">Results</h1>
          <p className="page-description">Upload merit lists and push outcomes to applicants.</p>
        </div>
        <Badge variant={published ? 'secondary' : 'outline'}>{published ? 'Published' : 'Draft'}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle>Merit summary</CardTitle>
            <CardDescription>Applicants with marks recorded. Upload final merit to override mock data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Search by name or roll number"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm rounded-xl"
            />

            <div className="table-container">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Posting</TableHead>
                    <TableHead>Marks</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 12).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium">{row.name}</div>
                        <div className="text-xs text-muted-foreground">{row.rollNumber || 'Roll pending'}</div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{eteaPostings.find((p) => p.id === row.serviceId)?.title}</p>
                        <p className="text-xs text-muted-foreground">Bill #{row.billId}</p>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold">{row.marks ?? '—'}</div>
                        <p className="text-xs text-muted-foreground">Application: {row.applicationStatus}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.marks && row.marks > 750 ? 'default' : 'outline'}>
                          {row.marks && row.marks > 750 ? 'Above cutoff' : 'Pending review'}
                        </Badge>
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
            <CardTitle>Publish controls</CardTitle>
            <CardDescription>Release results and notify applicants.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Publish to portal</p>
                <p className="text-xs text-muted-foreground">Enable viewing via candidate login.</p>
              </div>
              <Switch checked={publishOnline} onCheckedChange={setPublishOnline} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Send SMS outcomes</p>
                <p className="text-xs text-muted-foreground">Share roll, marks, and status via SMS.</p>
              </div>
              <Switch checked={smsEnabled} onCheckedChange={setSmsEnabled} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Upload merit list</Label>
              <Button variant="outline" className="w-full rounded-lg" onClick={() => toast.info('Upload stub - not wired to backend')}>
                <UploadCloud className="w-4 h-4 mr-1" />Upload PDF/CSV
              </Button>
              <p className="text-xs text-muted-foreground">Uploading replaces mock marks for displayed candidates.</p>
            </div>
            <Button className="w-full rounded-lg" onClick={handlePublish} disabled={!publishOnline && !smsEnabled}>
              <TrendingUp className="w-4 h-4 mr-1" />Publish results
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Results;
