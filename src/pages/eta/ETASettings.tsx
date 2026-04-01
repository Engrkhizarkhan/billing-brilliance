import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

const ETASettings = () => {
  const [paymentPrefs, setPaymentPrefs] = useState({
    allowPartial: false,
    autoVerifyBank: true,
    smsReminders: true,
    autoReconcile: true,
  });

  const [admitPolicy, setAdmitPolicy] = useState({
    requireCNICMatch: true,
    blockUnpaid: true,
    showCenterQR: true,
    downloadWatermark: true,
  });

  const [resultPrefs, setResultPrefs] = useState({
    cutoffMarks: '750',
    waitlistCount: '500',
    sendSMS: false,
  });

  const handleSave = () => {
    toast.success('ETA settings updated (mock)');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">ETA Settings</h1>
          <p className="text-sm text-muted-foreground">Guard payment, admit card, and result publication policies.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">Draft</Badge>
          <Button onClick={handleSave}>Save changes</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle>Payment & reconciliation</CardTitle>
            <CardDescription>How applicants pay and how payments get cleared.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Allow partial fee</p>
                <p className="text-sm text-muted-foreground">Accept part payment while keeping balance due.</p>
              </div>
              <Switch checked={paymentPrefs.allowPartial} onCheckedChange={(checked) => setPaymentPrefs((p) => ({ ...p, allowPartial: checked }))} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Auto verify with bank</p>
                <p className="text-sm text-muted-foreground">Mark payments paid after bank webhook (mock).</p>
              </div>
              <Switch checked={paymentPrefs.autoVerifyBank} onCheckedChange={(checked) => setPaymentPrefs((p) => ({ ...p, autoVerifyBank: checked }))} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Send SMS reminders</p>
                <p className="text-sm text-muted-foreground">Nudge applicants before fee due date.</p>
              </div>
              <Switch checked={paymentPrefs.smsReminders} onCheckedChange={(checked) => setPaymentPrefs((p) => ({ ...p, smsReminders: checked }))} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Auto reconcile retries</p>
                <p className="text-sm text-muted-foreground">Retry matching late bank files every 30 minutes.</p>
              </div>
              <Switch checked={paymentPrefs.autoReconcile} onCheckedChange={(checked) => setPaymentPrefs((p) => ({ ...p, autoReconcile: checked }))} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Admit cards</CardTitle>
            <CardDescription>Access and security rules for admit downloads.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Match CNIC with roll</p>
                <p className="text-sm text-muted-foreground">Block downloads if CNIC mismatch is detected.</p>
              </div>
              <Switch checked={admitPolicy.requireCNICMatch} onCheckedChange={(checked) => setAdmitPolicy((p) => ({ ...p, requireCNICMatch: checked }))} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Block unpaid applicants</p>
                <p className="text-sm text-muted-foreground">Only paid applicants can fetch admit cards.</p>
              </div>
              <Switch checked={admitPolicy.blockUnpaid} onCheckedChange={(checked) => setAdmitPolicy((p) => ({ ...p, blockUnpaid: checked }))} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Show center QR</p>
                <p className="text-sm text-muted-foreground">Include QR with center and slot info.</p>
              </div>
              <Switch checked={admitPolicy.showCenterQR} onCheckedChange={(checked) => setAdmitPolicy((p) => ({ ...p, showCenterQR: checked }))} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Watermark downloads</p>
                <p className="text-sm text-muted-foreground">Stamp admit PDFs with user and timestamp.</p>
              </div>
              <Switch checked={admitPolicy.downloadWatermark} onCheckedChange={(checked) => setAdmitPolicy((p) => ({ ...p, downloadWatermark: checked }))} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle>Result publication</CardTitle>
            <CardDescription>Guard cutoffs and applicant communication.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cutoff">Minimum cutoff (marks)</Label>
                <Input
                  id="cutoff"
                  type="number"
                  min={0}
                  max={1200}
                  value={resultPrefs.cutoffMarks}
                  onChange={(e) => setResultPrefs((p) => ({ ...p, cutoffMarks: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="waitlist">Waitlist size</Label>
                <Input
                  id="waitlist"
                  type="number"
                  min={0}
                  max={5000}
                  value={resultPrefs.waitlistCount}
                  onChange={(e) => setResultPrefs((p) => ({ ...p, waitlistCount: e.target.value }))}
                />
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Send SMS on publish</p>
                <p className="text-sm text-muted-foreground">Notify applicants with marks and status.</p>
              </div>
              <Switch checked={resultPrefs.sendSMS} onCheckedChange={(checked) => setResultPrefs((p) => ({ ...p, sendSMS: checked }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="result-note">Footer note for merit list</Label>
              <Textarea id="result-note" rows={3} placeholder="Objections can be filed within 48 hours at support@etea.pk" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Audit & compliance</CardTitle>
            <CardDescription>Capture who changed high-risk settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 rounded-xl bg-muted/50 border">
              <p className="text-sm font-semibold">Immutable log (mock)</p>
              <p className="text-xs text-muted-foreground">Setting changes are stamped with user + IP. Connect to Audit Trail later.</p>
            </div>
            <Button variant="outline" className="w-full rounded-lg" onClick={() => toast.info('Audit export is stubbed in mock mode')}>
              Export audit trail
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ETASettings;
