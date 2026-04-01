import { useMemo, useState } from 'react';
import { applicants as initialApplicants, eteaPostings } from '@/data/mockData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Printer, Share2, ShieldCheck } from 'lucide-react';

const AdmitCards = () => {
  const [search, setSearch] = useState('');
  const [deliveryChannel, setDeliveryChannel] = useState<'email' | 'sms' | 'portal'>('portal');
  const admitted = useMemo(() => initialApplicants.filter((a) => a.rollNumber), []);

  const filtered = admitted.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()) || (a.rollNumber || '').includes(search));

  const handleSend = (name: string) => {
    toast.success(`${name} — admit card sent via ${deliveryChannel}`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-header">Admit Cards</h1>
          <p className="page-description">Issue admit cards to applicants with assigned roll numbers.</p>
        </div>
        <Badge variant="secondary">{admitted.length} ready</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle>Ready for delivery</CardTitle>
            <CardDescription>Search and resend admit cards with center/slot details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
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
                    <TableHead>Roll & Center</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 12).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium">{row.name}</div>
                        <div className="text-xs text-muted-foreground">{row.cnic}</div>
                      </TableCell>
                      <TableCell className="space-y-1">
                        <p className="text-sm font-medium">{eteaPostings.find((p) => p.id === row.serviceId)?.title}</p>
                        <p className="text-xs text-muted-foreground">Bill #{row.billId}</p>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold">{row.rollNumber}</div>
                        <p className="text-xs text-muted-foreground">{row.testCenter || 'Center pending'}</p>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" className="rounded-lg" onClick={() => handleSend(row.name)}>
                          <Share2 className="w-4 h-4 mr-1" />Send
                        </Button>
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
            <CardTitle>Delivery policy</CardTitle>
            <CardDescription>Choose where cards are published.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Preferred channel</Label>
              <div className="flex gap-2">
                {['portal', 'email', 'sms'].map((channel) => (
                  <Button
                    key={channel}
                    variant={deliveryChannel === channel ? 'default' : 'outline'}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setDeliveryChannel(channel as typeof deliveryChannel)}
                  >
                    {channel.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl border bg-muted/40">
              <ShieldCheck className="w-5 h-5 text-primary mt-0.5" />
              <p className="text-sm text-muted-foreground">Admit cards include QR + bill ID. Enable watermarking in Settings to stamp user and timestamp on downloads.</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Custom footer note</Label>
              <Input placeholder="Bring CNIC and this admit card on test day" className="rounded-xl" />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1 rounded-lg"><Share2 className="w-4 h-4 mr-1" />Send all</Button>
              <Button variant="outline" className="flex-1 rounded-lg"><Printer className="w-4 h-4 mr-1" />Print batch</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdmitCards;
