import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Eye, EyeOff, Send, ChevronDown, CheckCircle2, XCircle, AlertTriangle, Webhook,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';

interface TestResult {
  status: number;
  ok: boolean;
  error?: string;
}

const OrgWebhookConfig = () => {
  const [notificationUrl, setNotificationUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [secretHint, setSecretHint] = useState<string | null>(null);
  const [secretVisible, setSecretVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [instructionsOpen, setInstructionsOpen] = useState(true);

  const { data } = useApiQuery(() => api.fetchWebhookConfig(), []);

  useEffect(() => {
    if (!data) return;
    if (data.notificationUrl) setNotificationUrl(data.notificationUrl);
    if (data.webhookSecretHint) setSecretHint(data.webhookSecretHint);
  }, [data]);

  const isUnconfigured = !notificationUrl && !secretHint;

  const handleSave = async () => {
    if (!notificationUrl) {
      toast.error('Notification URL is required');
      return;
    }
    if (!/^https:\/\/.+/.test(notificationUrl)) {
      toast.error('Notification URL must start with https://');
      return;
    }
    setSaving(true);
    try {
      await api.saveWebhookConfig({
        notificationUrl,
        webhookSecret: webhookSecret || undefined,
      });
      if (webhookSecret) {
        setSecretHint('••••••' + webhookSecret.slice(-6));
        setWebhookSecret('');
      }
      toast.success('Webhook configuration saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save webhook configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.testWebhookConfig();
      setTestResult(result.data);
    } catch (error) {
      setTestResult({ status: 0, ok: false, error: error instanceof Error ? error.message : 'Request failed' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Webhook Configuration</h1>
        <p className="page-description">
          Configure the URL and secret your system uses to receive payment confirmation notifications from this platform.
        </p>
      </div>

      {/* ── Section 1: Configuration Form ───────────────────────────────── */}
      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Webhook className="w-5 h-5 text-muted-foreground" />
            <CardTitle>Configuration</CardTitle>
          </div>
          <CardDescription>
            Set the HTTPS endpoint this platform will call when a payment is confirmed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isUnconfigured && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Webhook is not configured. Your system will not receive payment confirmations until a URL and secret are saved.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="notification-url">Notification URL</Label>
            <Input
              id="notification-url"
              type="url"
              value={notificationUrl}
              onChange={(e) => setNotificationUrl(e.target.value)}
              placeholder="https://your-org.gov.pk/api/payment-webhook"
              className="rounded-lg font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Must be a valid <code>https://</code> URL reachable from the internet.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook-secret">Webhook Secret</Label>
            <div className="flex gap-2">
              <Input
                id="webhook-secret"
                type={secretVisible ? 'text' : 'password'}
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder={secretHint ?? 'Enter a strong random secret'}
                className="rounded-lg font-mono text-sm"
                autoComplete="new-password"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={() => setSecretVisible((v) => !v)}
              >
                {secretVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {secretHint
                ? `Current secret ends in: ${secretHint}. Leave blank to keep existing secret.`
                : 'Used to sign outbound notifications. Share with your technical team.'}
            </p>
          </div>

          <Button className="rounded-lg" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving…' : 'Save Configuration'}
          </Button>
        </CardContent>
      </Card>

      {/* ── Section 2: Test Webhook ──────────────────────────────────────── */}
      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-muted-foreground" />
            <CardTitle>Test Webhook</CardTitle>
          </div>
          <CardDescription>
            Send a dummy notification to your configured URL to verify it is reachable and responding correctly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            This sends a dummy{' '}
            <code className="bg-muted rounded px-1 py-0.5">
              {'{ status: "test", application_id: "TEST-0000" }'}
            </code>{' '}
            payload to your configured URL to verify it's reachable. The{' '}
            <code className="bg-muted rounded px-1 py-0.5">X-Webhook-Signature</code> header will be included.
          </p>

          <Button
            variant="outline"
            className="rounded-lg"
            onClick={() => void handleTest()}
            disabled={testing || !notificationUrl}
          >
            <Send className="w-4 h-4 mr-2" />
            {testing ? 'Sending…' : 'Send Test Notification'}
          </Button>

          {testResult && (
            <div className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
              {testResult.ok ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  <span className="text-green-700 dark:text-green-400">
                    ✓ Your endpoint responded with {testResult.status}
                  </span>
                  <Badge variant="outline" className="ml-auto text-xs text-green-700 border-green-300">
                    {testResult.status}
                  </Badge>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-destructive shrink-0" />
                  <span className="text-destructive">
                    ✗ Failed:{' '}
                    {testResult.error
                      ? testResult.error
                      : testResult.status
                      ? `HTTP ${testResult.status}`
                      : 'connection refused / timeout'}
                  </span>
                  {testResult.status > 0 && (
                    <Badge variant="destructive" className="ml-auto text-xs">
                      {testResult.status}
                    </Badge>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 3: How It Works ──────────────────────────────────────── */}
      <Card className="max-w-2xl">
        <Collapsible open={instructionsOpen} onOpenChange={setInstructionsOpen}>
          <CardHeader className="pb-2">
            <CollapsibleTrigger className="flex items-center justify-between w-full group">
              <CardTitle className="text-base">How It Works</CardTitle>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                  instructionsOpen ? 'rotate-180' : ''
                }`}
              />
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-5 pt-0">

              <div className="space-y-1">
                <p className="text-sm font-medium">What is this?</p>
                <p className="text-sm text-muted-foreground">
                  When an applicant pays their fee through 1BILL (ATM / mobile banking), this platform
                  immediately notifies your system at the URL above so you can mark the application as
                  paid in your own database.
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium">Webhook Secret</p>
                <p className="text-sm text-muted-foreground">
                  Share this secret with your technical team. Your server must recompute the signature
                  from the payload and compare it to the{' '}
                  <code className="bg-muted rounded px-1 py-0.5 text-xs">X-Webhook-Signature</code>{' '}
                  header to verify the notification is genuine.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Signature Verification</p>
                <pre className="rounded-lg bg-muted p-4 text-xs font-mono overflow-x-auto leading-relaxed">
{`const crypto = require('crypto');
const sig = crypto.createHmac('sha256', YOUR_WEBHOOK_SECRET)
  .update(JSON.stringify(req.body)).digest('hex');
if (sig !== req.headers['x-webhook-signature']) {
  return res.status(401).send('Invalid signature');
}`}
                </pre>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Payload Shape</p>
                <p className="text-sm text-muted-foreground">Your endpoint will receive a POST request with this JSON body:</p>
                <pre className="rounded-lg bg-muted p-4 text-xs font-mono overflow-x-auto leading-relaxed">
{`{
  "application_id": "APP-44521",
  "status": "paid",
  "transaction_id": "TXN-XXXXXXXX",
  "paid_at": "2026-04-18T10:32:00.000Z"
}`}
                </pre>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium">Your server must respond</p>
                <p className="text-sm text-muted-foreground">
                  with HTTP <strong>200</strong> within <strong>8 seconds</strong> or the delivery is logged as failed.
                  Non-200 responses and timeouts are recorded in the notification log.
                </p>
              </div>

            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
};

export default OrgWebhookConfig;
