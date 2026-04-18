import { useState, useCallback, useEffect } from 'react';
import { PcidKey } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { FlaskConical, Send, Copy, CheckCheck, RefreshCw, Eye, EyeOff, KeyRound, UserPlus, CheckCircle2, Circle, CreditCard } from 'lucide-react';
import { api } from '@/lib/api';

const fmt = (v: unknown) => JSON.stringify(v, null, 2);

const RC_LABELS: Record<string, { label: string; color: string }> = {
  '00': { label: 'Success',        color: 'bg-green-500/10 text-green-600 border-green-400/30' },
  '01': { label: 'PCID Not Found', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-400/30' },
  '03': { label: 'Server Error',   color: 'bg-red-500/10 text-red-600 border-red-400/30' },
  '04': { label: 'Invalid PCID',   color: 'bg-red-500/10 text-red-600 border-red-400/30' },
};

const RcBadge = ({ code }: { code?: string }) => {
  if (!code) return null;
  const info = RC_LABELS[code] ?? { label: 'Unknown', color: 'bg-muted text-muted-foreground' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono font-semibold ${info.color}`}>
      {code} — {info.label}
    </span>
  );
};

type SaasResult = { reqText: string; resText: string; httpStatus?: number };

const emptyResult: SaasResult = { reqText: '', resText: '' };

// ── 1LINK channel types ───────────────────────────────────────────────────────

type OneLinkBundle = {
  bundleId: string;
  bundleName: string;
  description?: string;
  expiryDate?: string;
  amount: string;
  tag?: string;
};

type OneLinkInquiryResult = {
  response_Code: string;
  consumer_detail: string;
  bill_status: string;
  due_date: string;
  amount_within_dueDate: string;
  amount_after_dueDate: string;
  billing_month: string;
  tran_auth_Id: string;
};

type OneLinkPaymentResult = {
  response_Code: string;
  Identification_parameter?: string;
};

// Build reserved field for BillInquiry:
//   CNIC(13) + AccountId(28) + BundleID(100, padded) + Info1(100) + Info2(144)
const buildInquiryReserved = (bundleId: string) =>
  ' '.repeat(13) + ' '.repeat(28) + bundleId.slice(0, 100).padEnd(100, ' ');

// Build reserved field for BillPayment:
//   CNIC(13)+City(30)+Province(20)+AccountId(28)+fromAccountType(2)+fromAccountTitle(30)+BundleID(100,padded)
const buildPaymentReserved = (bundleId: string) =>
  ' '.repeat(13) + ' '.repeat(30) + ' '.repeat(20) + ' '.repeat(28) +
  ' '.repeat(2) + ' '.repeat(30) + bundleId.slice(0, 100).padEnd(100, ' ');

// Parse AN14 response amount (+0000000189000 → 1890.00)
const parseAN14 = (str: string) => parseInt((str || '0').replace(/^[+-]/, ''), 10) / 100;
// Encode amount as AN12 (1890.00 → "000000189000")
const toAN12 = (amount: number) => String(Math.round(amount * 100)).padStart(12, '0');

/* ── PCID Key selector panel (shared by SaaS tabs) ── */
const PcidCredPanel = ({
  pcidKeys,
  selectedPcid,
  setSelectedPcid,
  showKey,
  setShowKey,
  consumerNumber,
  setConsumerNumber,
}: {
  pcidKeys: PcidKey[];
  selectedPcid: string;
  setSelectedPcid: (v: string) => void;
  showKey: boolean;
  setShowKey: (v: boolean) => void;
  consumerNumber: string;
  setConsumerNumber: (v: string) => void;
}) => {
  const pk = pcidKeys.find((k) => k.pcid === selectedPcid);
  return (
    <Card className="max-w-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <KeyRound className="w-4 h-4" /> SaaS Gateway Credentials
        </CardTitle>
        <CardDescription className="text-xs">
          Select a PCID to auto-fill its API key. The PCID must be linked to a biller in{' '}
          <a href="/admin/bundles" className="underline">Bundle Management</a>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">PCID</Label>
            <Select value={selectedPcid} onValueChange={setSelectedPcid}>
              <SelectTrigger className="font-mono text-xs"><SelectValue placeholder="Select PCID…" /></SelectTrigger>
              <SelectContent>
                {pcidKeys.map((k) => (
                  <SelectItem key={k.pcid} value={k.pcid}>
                    {k.pcid} {k.billerId ? `— ${k.billerName ?? 'linked'}` : '(not linked)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">X-API-Key</Label>
            <div className="flex gap-1">
              <Input
                value={pk?.apiKey ?? ''}
                readOnly
                type={showKey ? 'text' : 'password'}
                className="font-mono text-xs bg-muted/40"
                placeholder="Select a PCID above"
              />
              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setShowKey(!showKey)}>
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Consumer Number</Label>
          <Input
            value={consumerNumber}
            onChange={(e) => setConsumerNumber(e.target.value)}
            placeholder="e.g. 1234567890"
            className="font-mono text-xs max-w-xs"
          />
          <p className="text-xs text-muted-foreground">Shared across Check Payment, Bill Status, Payment History, and Make Payment tabs.</p>
        </div>
        {pk && !pk.billerId && (
          <p className="text-xs text-yellow-600 bg-yellow-500/5 border border-yellow-400/30 rounded px-2 py-1">
            ⚠ This PCID is not linked to a biller. Requests will return 403 PCID_NOT_LINKED.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

/* ── Generic SaaS API tester ── */
const SaasTester = ({
  title,
  method,
  endpointTemplate,
  pcidKey,
  consumerNumber,
  extraBody,
}: {
  title: string;
  method: 'GET' | 'POST';
  endpointTemplate: string; // may contain :consumerNumber
  pcidKey?: PcidKey;
  consumerNumber: string;
  extraBody?: Record<string, unknown>;
}) => {
  const [result, setResult] = useState<SaasResult>(emptyResult);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const endpoint = endpointTemplate.replace(':consumerNumber', encodeURIComponent(consumerNumber));

  const copyText = (text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const run = useCallback(async () => {
    if (!pcidKey?.apiKey) { toast.error('Select a PCID with an API key first'); return; }
    if (!consumerNumber.trim()) { toast.error('Consumer number is required'); return; }

    const headers: Record<string, string> = {
      'X-API-Key': pcidKey.apiKey,
    };
    const body = method === 'POST'
      ? JSON.stringify({ consumerNumber: consumerNumber.trim(), ...extraBody })
      : undefined;

    if (method === 'POST') headers['Content-Type'] = 'application/json';

    const reqInfo = method === 'GET'
      ? `GET ${endpoint}\nX-API-Key: ${pcidKey.apiKey}`
      : `POST ${endpoint}\nX-API-Key: ${pcidKey.apiKey}\n\n${fmt({ consumerNumber: consumerNumber.trim(), ...extraBody })}`;

    setResult({ reqText: reqInfo, resText: '' });
    setLoading(true);

    try {
      const res = await fetch(endpoint, { method, headers, body });
      const text = await res.text();
      let formatted = text;
      try { formatted = fmt(JSON.parse(text)); } catch { /* leave as-is */ }
      setResult({ reqText: reqInfo, resText: formatted, httpStatus: res.status });
      if (res.ok) {
        toast.success(`${title} — HTTP ${res.status}`);
      } else {
        toast.error(`${title} — HTTP ${res.status}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setResult((prev) => ({ ...prev, resText: `Error: ${msg}` }));
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [pcidKey, consumerNumber, endpoint, method, title, extraBody]);

  const curlBody = method === 'POST'
    ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify({ consumerNumber: consumerNumber || '<consumerNumber>', ...extraBody })}'`
    : '';

  const curlSnippet = `curl -X ${method} ${window.location.origin}${endpoint} \\\n  -H "X-API-Key: ${pcidKey?.apiKey ?? '<api-key>'}"${curlBody}`;

  const httpStatusClass = result.httpStatus
    ? result.httpStatus < 300 ? 'text-green-600' : 'text-red-500'
    : '';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-5xl">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Request</CardTitle>
            <Badge variant="outline" className="font-mono text-xs">
              {method} {endpointTemplate}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button size="sm" className="gap-2" onClick={() => void run()} disabled={loading}>
            <Send className="w-3 h-3" />
            {loading ? 'Running…' : `Send ${title}`}
          </Button>

          <Separator />

          {result.reqText && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Request</Label>
                <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  onClick={() => copyText(result.reqText, 'req')}>
                  {copied === 'req' ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />} copy
                </button>
              </div>
              <Textarea value={result.reqText} readOnly rows={4} className="font-mono text-xs bg-muted/30" />
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">cURL</Label>
              <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                onClick={() => copyText(curlSnippet, 'curl')}>
                {copied === 'curl' ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />} copy
              </button>
            </div>
            <Textarea value={curlSnippet} readOnly rows={4} className="font-mono text-xs bg-muted/30" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-base">Response</CardTitle>
            {result.httpStatus !== undefined && (
              <Badge variant="outline" className={`font-mono text-xs ${httpStatusClass}`}>
                HTTP {result.httpStatus}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Raw JSON</Label>
              {result.resText && (
                <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  onClick={() => copyText(result.resText, 'res')}>
                  {copied === 'res' ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />} copy
                </button>
              )}
            </div>
            <Textarea
              value={result.resText}
              readOnly
              rows={14}
              className="font-mono text-xs bg-muted/30"
              placeholder="Response will appear here after you run a request…"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/* ── Make Payment tester ── */
const MakePaymentTester = ({
  pcidKey,
  consumerNumber,
}: {
  pcidKey?: PcidKey;
  consumerNumber: string;
}) => {
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [channel, setChannel] = useState('online');
  const [result, setResult] = useState<SaasResult>(emptyResult);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copyText = (text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const run = useCallback(async () => {
    if (!pcidKey?.apiKey) { toast.error('Select a PCID with an API key first'); return; }
    if (!consumerNumber.trim()) { toast.error('Consumer number is required'); return; }
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) { toast.error('Enter a valid amount'); return; }

    const body: Record<string, unknown> = {
      consumerNumber: consumerNumber.trim(),
      amount: parsedAmount,
      channel,
    };
    if (reference.trim()) body.reference = reference.trim();

    const reqInfo = `POST /api/saas/v1/make-payment\nX-API-Key: ${pcidKey.apiKey}\n\n${fmt(body)}`;
    setResult({ reqText: reqInfo, resText: '' });
    setLoading(true);
    try {
      const res = await fetch('/api/saas/v1/make-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': pcidKey.apiKey },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let formatted = text;
      try { formatted = fmt(JSON.parse(text)); } catch { /* leave as-is */ }
      setResult({ reqText: reqInfo, resText: formatted, httpStatus: res.status });
      if (res.ok) {
        const parsed = JSON.parse(text) as { receiptNumber?: string };
        toast.success(`Payment posted \u2014 ${parsed.receiptNumber ?? ''}`);
      } else {
        toast.error(`Make Payment \u2014 HTTP ${res.status}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setResult((prev) => ({ ...prev, resText: `Error: ${msg}` }));
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [pcidKey, consumerNumber, amount, reference, channel]);

  const bodyForCurl = JSON.stringify({
    consumerNumber: consumerNumber || '<consumerNumber>',
    amount: parseFloat(amount) || 0,
    channel,
    ...(reference.trim() ? { reference: reference.trim() } : {}),
  });
  const curlSnippet = `curl -X POST ${window.location.origin}/api/saas/v1/make-payment \\\n  -H "X-API-Key: ${pcidKey?.apiKey ?? '<api-key>'}" \\\n  -H "Content-Type: application/json" \\\n  -d '${bodyForCurl}'`;
  const httpStatusClass = result.httpStatus
    ? result.httpStatus < 300 ? 'text-green-600' : 'text-red-500'
    : '';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-5xl">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Request</CardTitle>
            <Badge variant="outline" className="font-mono text-xs">POST /api/saas/v1/make-payment</Badge>
          </div>
          <CardDescription className="text-xs">
            Post a payment for the consumer number entered in the credentials panel above.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Amount (PKR) <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 5000"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Channel</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">online</SelectItem>
                  <SelectItem value="bank_transfer">bank_transfer</SelectItem>
                  <SelectItem value="atm">atm</SelectItem>
                  <SelectItem value="cash">cash</SelectItem>
                  <SelectItem value="pos">pos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Reference <span className="text-muted-foreground">(your transaction ID, optional)</span></Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. TXN-20260413-001" className="font-mono text-xs" />
            </div>
          </div>

          <Button size="sm" className="gap-2 mt-1" onClick={() => void run()} disabled={loading}>
            <Send className="w-3 h-3" />
            {loading ? 'Processing\u2026' : 'Post Payment'}
          </Button>

          <Separator />

          {result.reqText && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Request</Label>
                <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  onClick={() => copyText(result.reqText, 'req')}>
                  {copied === 'req' ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />} copy
                </button>
              </div>
              <Textarea value={result.reqText} readOnly rows={5} className="font-mono text-xs bg-muted/30" />
            </div>
          )}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">cURL</Label>
              <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                onClick={() => copyText(curlSnippet, 'curl')}>
                {copied === 'curl' ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />} copy
              </button>
            </div>
            <Textarea value={curlSnippet} readOnly rows={5} className="font-mono text-xs bg-muted/30" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-base">Response</CardTitle>
            {result.httpStatus !== undefined && (
              <Badge variant="outline" className={`font-mono text-xs ${httpStatusClass}`}>
                HTTP {result.httpStatus}
              </Badge>
            )}
          </div>
          <CardDescription className="text-xs">
            A <span className="font-mono font-semibold">receiptNumber</span> is returned on success.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Raw JSON</Label>
              {result.resText && (
                <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  onClick={() => copyText(result.resText, 'res')}>
                  {copied === 'res' ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />} copy
                </button>
              )}
            </div>
            <Textarea value={result.resText} readOnly rows={10} className="font-mono text-xs bg-muted/30"
              placeholder="Response will appear here after posting a payment\u2026" />
          </div>
          {result.httpStatus === 201 && (() => {
            try {
              const p = JSON.parse(result.resText) as { receiptNumber?: string; transactionId?: string; status?: string; remainingBalance?: number; paidAt?: string; name?: string };
              if (!p.receiptNumber) return null;
              return (
                <div className="rounded-lg border bg-green-500/5 border-green-400/30 p-3 text-xs space-y-1">
                  <p className="font-semibold text-green-700 dark:text-green-400">Payment accepted</p>
                  <p>Receipt: <span className="font-mono font-bold">{p.receiptNumber}</span></p>
                  <p>Status: <span className="font-mono">{p.status}</span></p>
                  {p.name && <p>Consumer: <span className="font-mono">{p.name}</span></p>}
                  {p.remainingBalance !== undefined && (
                    <p>Remaining balance: <span className="font-mono">PKR {p.remainingBalance.toLocaleString()}</span></p>
                  )}
                  {p.paidAt && <p>Date: <span className="font-mono">{p.paidAt}</span></p>}
                </div>
              );
            } catch { return null; }
          })()}
        </CardContent>
      </Card>
    </div>
  );
};

/* ── Register Consumer tester ── */
const RegisterConsumerTester = ({
  pcidKey,
}: {
  pcidKey?: PcidKey;
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [externalRef, setExternalRef] = useState('');
  const [bundleId, setBundleId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [result, setResult] = useState<SaasResult>(emptyResult);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copyText = (text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const run = useCallback(async () => {
    if (!pcidKey?.apiKey) { toast.error('Select a PCID with an API key first'); return; }
    if (!name.trim()) { toast.error('Name is required'); return; }

    const body: Record<string, string> = { name: name.trim() };
    if (phone.trim())       body.phone       = phone.trim();
    if (email.trim())       body.email       = email.trim();
    if (externalRef.trim()) body.externalRef = externalRef.trim();
    if (bundleId.trim())    body.bundleId    = bundleId.trim();
    if (dueDate.trim())     body.dueDate     = dueDate.trim();

    const reqInfo = `POST /api/saas/v1/register-consumer\nX-API-Key: ${pcidKey.apiKey}\n\n${fmt(body)}`;
    setResult({ reqText: reqInfo, resText: '' });
    setLoading(true);
    try {
      const res = await fetch('/api/saas/v1/register-consumer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': pcidKey.apiKey },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let formatted = text;
      try { formatted = fmt(JSON.parse(text)); } catch { /* leave as-is */ }
      setResult({ reqText: reqInfo, resText: formatted, httpStatus: res.status });
      if (res.ok) {
        const parsed = JSON.parse(text) as { consumerNumber?: string; invoice?: { invoiceNumber: string; amount: number } };
        toast.success(`Consumer registered — ${parsed.consumerNumber ?? ''}${parsed.invoice ? ` · Invoice ${parsed.invoice.invoiceNumber}` : ''}`);
      } else {
        toast.error(`Register Consumer — HTTP ${res.status}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setResult((prev) => ({ ...prev, resText: `Error: ${msg}` }));
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [pcidKey, name, phone, email, externalRef, bundleId, dueDate]);

  const bodyForCurl = JSON.stringify(
    Object.fromEntries(
      Object.entries({ name: name || '<name>', phone, email, externalRef, bundleId, dueDate })
        .filter(([, v]) => Boolean(v))
    )
  );
  const curlSnippet = `curl -X POST ${window.location.origin}/api/saas/v1/register-consumer \\\n  -H "X-API-Key: ${pcidKey?.apiKey ?? '<api-key>'}" \\\n  -H "Content-Type: application/json" \\\n  -d '${bodyForCurl}'`;
  const httpStatusClass = result.httpStatus
    ? result.httpStatus < 300 ? 'text-green-600' : 'text-red-500'
    : '';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-5xl">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Request</CardTitle>
            <Badge variant="outline" className="font-mono text-xs">POST /api/saas/v1/register-consumer</Badge>
          </div>
          <CardDescription className="text-xs">
            Creates a consumer record and returns a 1BILL consumer number to give to your end-user.
            Pass <span className="font-mono font-semibold">bundleId</span> to auto-create the invoice so the consumer can pay immediately via ATM.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Name <span className="text-red-500">*</span></Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ahmed Khan" className="text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03001234567" className="font-mono text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" className="text-xs" />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">External Ref <span className="text-muted-foreground">(your internal ID, e.g. user_123)</span></Label>
              <Input value={externalRef} onChange={(e) => setExternalRef(e.target.value)} placeholder="optional" className="font-mono text-xs" />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">
                Bundle ID{' '}
                <span className="text-muted-foreground">
                  (recommended — auto-creates invoice so consumer can pay immediately)
                </span>
              </Label>
              <Input
                value={bundleId}
                onChange={(e) => setBundleId(e.target.value)}
                placeholder="e.g. BUNDLE-001 (from FetchBundle)"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Due Date <span className="text-muted-foreground">(YYYY-MM-DD, default: 30 days from today)</span></Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>

          <Button size="sm" className="gap-2 mt-1" onClick={() => void run()} disabled={loading}>
            <UserPlus className="w-3 h-3" />
            {loading ? 'Registering…' : 'Register Consumer'}
          </Button>

          <Separator />

          {result.reqText && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Request</Label>
                <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  onClick={() => copyText(result.reqText, 'req')}>
                  {copied === 'req' ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />} copy
                </button>
              </div>
              <Textarea value={result.reqText} readOnly rows={5} className="font-mono text-xs bg-muted/30" />
            </div>
          )}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">cURL</Label>
              <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                onClick={() => copyText(curlSnippet, 'curl')}>
                {copied === 'curl' ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />} copy
              </button>
            </div>
            <Textarea value={curlSnippet} readOnly rows={5} className="font-mono text-xs bg-muted/30" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-base">Response</CardTitle>
            {result.httpStatus !== undefined && (
              <Badge variant="outline" className={`font-mono text-xs ${httpStatusClass}`}>
                HTTP {result.httpStatus}
              </Badge>
            )}
          </div>
          <CardDescription className="text-xs">
            The <span className="font-mono font-semibold">consumerNumber</span> is the 1BILL-compliant ID to give to your end-customer for payment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Raw JSON</Label>
              {result.resText && (
                <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  onClick={() => copyText(result.resText, 'res')}>
                  {copied === 'res' ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />} copy
                </button>
              )}
            </div>
            <Textarea value={result.resText} readOnly rows={10} className="font-mono text-xs bg-muted/30"
              placeholder="Response will appear here after you register a consumer…" />
          </div>
          {result.httpStatus === 201 && (() => {
            try {
              const p = JSON.parse(result.resText) as {
                consumerNumber?: string;
                externalRef?: string;
                consumerId?: string;
                invoice?: { invoiceNumber: string; amount: number; dueDate: string; bundleName?: string };
              };
              if (!p.consumerNumber) return null;
              return (
                <div className="rounded-lg border bg-green-500/5 border-green-400/30 p-3 text-xs space-y-1">
                  <p className="font-semibold text-green-700 dark:text-green-400">Consumer registered successfully</p>
                  <p>Consumer Number: <span className="font-mono font-bold">{p.consumerNumber}</span></p>
                  <p className="text-muted-foreground">Give this number to the customer — they use it at ATM / mobile banking / bank branch to pay via 1BILL.</p>
                  {p.externalRef && <p>External Ref: <span className="font-mono">{p.externalRef}</span></p>}
                  {p.invoice && (
                    <div className="mt-2 pt-2 border-t border-green-400/20 space-y-0.5">
                      <p className="font-medium text-green-700 dark:text-green-400">Invoice auto-created ✓</p>
                      <p>Invoice: <span className="font-mono">{p.invoice.invoiceNumber}</span></p>
                      <p>Amount: <span className="font-mono font-bold">PKR {Number(p.invoice.amount).toLocaleString()}</span></p>
                      <p>Due: <span className="font-mono">{p.invoice.dueDate}</span></p>
                      {p.invoice.bundleName && <p>Bundle: {p.invoice.bundleName}</p>}
                    </div>
                  )}
                </div>
              );
            } catch { return null; }
          })()}
        </CardContent>
      </Card>
    </div>
  );
};

/* ── Main page ── */
const FetchBundleSandbox = () => {
  // FetchBundle (1LINK direct) state
  const [username, setUsername] = useState('demo-user');
  const [password, setPassword] = useState('demo-pass');
  const [pcid, setPcid] = useState('MBLINK01');
  const [loading, setLoading] = useState(false);
  const [reqText, setReqText] = useState('');
  const [resText, setResText] = useState('');
  const [resCode, setResCode] = useState<string | undefined>();
  const [copied, setCopied] = useState<string | null>(null);

  // 1LINK 3-step flow state
  const [flowStep, setFlowStep] = useState<1 | 2 | 3>(1);
  const [selectedBundle, setSelectedBundle] = useState<OneLinkBundle | null>(null);
  const [flowConsumerNum, setFlowConsumerNum] = useState('');
  const [inquiryResult, setInquiryResult] = useState<OneLinkInquiryResult | null>(null);
  const [inquiryLoading, setInquiryLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentResult, setPaymentResult] = useState<OneLinkPaymentResult | null>(null);

  // Shared SaaS state
  const [pcidKeys, setPcidKeys] = useState<PcidKey[]>([]);
  const [selectedPcid, setSelectedPcid] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [consumerNumber, setConsumerNumber] = useState('');

  useEffect(() => {
    void api.fetchPcidKeys().then((r) => {
      const keys = r.data ?? [];
      setPcidKeys(keys);
      if (keys.length > 0) setSelectedPcid(keys[0].pcid);
    });
  }, []);

  const selectedPcidKey = pcidKeys.find((k) => k.pcid === selectedPcid);

  const copyText = (text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const parsedResponse = (() => {
    try { return resText ? (JSON.parse(resText) as Record<string, unknown>) : null; }
    catch { return null; }
  })();

  const bundleDetails = Array.isArray(parsedResponse?.bundleDetails)
    ? (parsedResponse!.bundleDetails as Record<string, string>[])
    : [];

  const runFetchBundle = useCallback(async () => {
    const trimPcid = pcid.trim();
    if (!trimPcid) { toast.error('PCID is required'); return; }
    const body = { PCID: trimPcid };
    setReqText(fmt(body));
    setResText('');
    setResCode(undefined);
    setLoading(true);
    try {
      const res = await fetch('/v1/Transaction/Fetchbundle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          username: username.trim(),
          password: password.trim(),
        },
        body: JSON.stringify(body),
      });
      const data: unknown = await res.json();
      setResText(fmt(data));
      const code = (data as Record<string, string>)?.responseCode;
      setResCode(code);
      if (code === '00') {
        const count = Array.isArray((data as Record<string, unknown>).bundleDetails)
          ? ((data as Record<string, unknown[]>).bundleDetails).length : 0;
        toast.success(`OK — ${count} bundle(s) returned`);
      } else {
        toast.error(`FetchBundle returned code ${code}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setResText(`Error: ${msg}`);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [pcid, username, password]);

  const curlSnippet = `curl -X POST ${window.location.origin}/v1/Transaction/Fetchbundle \\
  -H "Content-Type: application/json" \\
  -H "username: ${username}" \\
  -H "password: ${password}" \\
  -d '{"PCID":"${pcid}"}'`;

  // ── 1LINK BillInquiry (step 2) ──────────────────────────────────────────────
  const runBillInquiry = useCallback(async () => {
    if (!flowConsumerNum.trim()) { toast.error('Consumer number is required'); return; }
    if (!selectedBundle) { toast.error('No bundle selected'); return; }
    setInquiryLoading(true);
    setInquiryResult(null);
    try {
      const reserved = buildInquiryReserved(selectedBundle.bundleId);
      const body = {
        consumer_number: flowConsumerNum.trim(),
        bank_mnemonic: pcid.trim(),
        reserved,
      };
      const res = await fetch('/api/1.0/Payments/BillInquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', username: username.trim(), password: password.trim() },
        body: JSON.stringify(body),
      });
      const json = await res.json() as OneLinkInquiryResult;
      setInquiryResult(json);
      if (json.response_Code === '00') {
        toast.success(`Inquiry OK — ${json.consumer_detail.trim()}`);
        if (json.bill_status === 'U') setFlowStep(3);
        else if (json.bill_status === 'P') toast.info('Bill is already paid.');
      } else {
        const msg: Record<string, string> = { '01': 'Consumer number not found', '02': 'Account blocked', '03': 'Unknown error', '04': 'Invalid data' };
        toast.error(msg[json.response_Code] ?? `Inquiry failed (code ${json.response_Code})`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Network error');
    } finally {
      setInquiryLoading(false);
    }
  }, [flowConsumerNum, selectedBundle, pcid, username, password]);

  // ── 1LINK BillPayment (step 3) ──────────────────────────────────────────────
  const runBillPayment = useCallback(async () => {
    if (!inquiryResult || !selectedBundle) return;
    setPaymentLoading(true);
    setPaymentResult(null);
    try {
      const now = new Date();
      const tran_date = now.toISOString().slice(0, 10).replace(/-/g, '');
      const tran_time = now.toTimeString().slice(0, 8).replace(/:/g, '');
      const tran_auth_id = String(Math.floor(100000 + Math.random() * 900000));
      const amountNum = parseAN14(inquiryResult.amount_within_dueDate);
      const reserved = buildPaymentReserved(selectedBundle.bundleId);
      const body = {
        consumer_number: flowConsumerNum.trim(),
        tran_auth_id,
        transaction_amount: toAN12(amountNum),
        tran_date,
        tran_time,
        bank_mnemonic: pcid.trim(),
        reserved,
      };
      const res = await fetch('/api/1.0/Payments/BillPayment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', username: username.trim(), password: password.trim() },
        body: JSON.stringify(body),
      });
      const json = await res.json() as OneLinkPaymentResult;
      setPaymentResult(json);
      if (json.response_Code === '00') {
        toast.success('Payment confirmed!');
      } else {
        const msg: Record<string, string> = { '01': 'Consumer not found', '02': 'Unknown error', '03': 'Duplicate transaction', '04': 'Invalid data', '05': 'Processing failed', '06': 'Already paid' };
        toast.error(msg[json.response_Code] ?? `Payment failed (code ${json.response_Code})`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Network error');
    } finally {
      setPaymentLoading(false);
    }
  }, [inquiryResult, selectedBundle, flowConsumerNum, pcid, username, password]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header flex items-center gap-2">
          <FlaskConical className="w-5 h-5" /> API Sandbox
        </h1>
        <p className="page-description">
          Interactive tester for the 1LINK FetchBundle endpoint and the SaaS gateway APIs.
        </p>
      </div>

      <Tabs defaultValue="fetchbundle">
        <TabsList>
          <TabsTrigger value="fetchbundle">FetchBundle</TabsTrigger>
          <TabsTrigger value="checkpayment">Check Payment</TabsTrigger>
          <TabsTrigger value="billstatus">Bill Status</TabsTrigger>
          <TabsTrigger value="paymenthistory">Payment History</TabsTrigger>
          <TabsTrigger value="makepayment">Make Payment</TabsTrigger>
          <TabsTrigger value="registerconsumer">Register Consumer</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: 1LINK Flow (FetchBundle → BillInquiry → BillPayment) ── */}
        <TabsContent value="fetchbundle" className="space-y-6 pt-4">
          {/* Step indicator */}
          <div className="flex items-center gap-2 text-xs font-medium max-w-xl">
            {([
              { n: 1, label: 'Get Bundles' },
              { n: 2, label: 'Bill Inquiry' },
              { n: 3, label: 'Confirm Payment' },
            ] as const).map(({ n, label }, idx) => (
              <span key={n} className="flex items-center gap-1">
                {idx > 0 && <span className="text-muted-foreground mx-1">→</span>}
                {flowStep > n
                  ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  : flowStep === n
                  ? <Circle className="w-4 h-4 text-primary shrink-0 fill-primary/20" />
                  : <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                }
                <span className={flowStep === n ? 'text-primary' : flowStep > n ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground/60'}>
                  {label}
                </span>
              </span>
            ))}
            {flowStep > 1 && (
              <Button variant="ghost" size="sm" className="ml-auto text-xs h-6 px-2"
                onClick={() => { setFlowStep(1); setSelectedBundle(null); setInquiryResult(null); setPaymentResult(null); }}>
                Start over
              </Button>
            )}
          </div>

          {/* ── Step 1: Credentials + FetchBundle ── */}
          {flowStep === 1 && (
            <>
              <Card className="max-w-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">1LINK Gateway Credentials (HTTP headers)</CardTitle>
                  <CardDescription className="text-xs">
                    Match <span className="font-mono">ONELINK_USERNAME</span> /{' '}
                    <span className="font-mono">ONELINK_PASSWORD</span> in your server&apos;s{' '}
                    <span className="font-mono">.env</span>. These are the credentials 1LINK uses to call your endpoints.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">username header</Label>
                      <Input value={username} onChange={(e) => setUsername(e.target.value)} className="font-mono text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">password header</Label>
                      <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono text-xs" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-5xl">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <CardTitle className="text-base">Step 1 — FetchBundle</CardTitle>
                      <Badge variant="outline" className="font-mono text-xs">POST /v1/Transaction/Fetchbundle</Badge>
                    </div>
                    <CardDescription className="text-xs">
                      Enter the biller&apos;s PCID (Company UCID, max 8 chars). The bank/ATM calls this first to show the customer a list of available fee packages.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1">
                      <Label className="text-xs">PCID <span className="text-muted-foreground">(bank_mnemonic / CompanyUCID)</span></Label>
                      <div className="flex gap-2">
                        <Input
                          value={pcid}
                          onChange={(e) => { setPcid(e.target.value.toUpperCase()); setResText(''); setResCode(undefined); }}
                          placeholder="e.g. MBLINK01"
                          maxLength={8}
                          className="font-mono text-xs uppercase"
                        />
                        <Button variant="outline" size="icon" title="Reset"
                          onClick={() => { setPcid('MBLINK01'); setResText(''); setResCode(undefined); }}>
                          <RefreshCw className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Must match a PCID in{' '}
                        <a href="/admin/bundles" className="underline">Bundle Management</a>{' '}
                        with at least one active bundle.
                      </p>
                    </div>
                    <Button size="sm" className="gap-2" onClick={() => void runFetchBundle()} disabled={loading}>
                      <Send className="w-3 h-3" />
                      {loading ? 'Fetching…' : 'Get Bundles'}
                    </Button>
                    <Separator />
                    {reqText && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">Request body</Label>
                          <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1" onClick={() => copyText(reqText, 'req')}>
                            {copied === 'req' ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />} copy
                          </button>
                        </div>
                        <Textarea value={reqText} readOnly rows={3} className="font-mono text-xs bg-muted/30" />
                      </div>
                    )}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">cURL</Label>
                        <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1" onClick={() => copyText(curlSnippet, 'curl')}>
                          {copied === 'curl' ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />} copy
                        </button>
                      </div>
                      <Textarea value={curlSnippet} readOnly rows={5} className="font-mono text-xs bg-muted/30" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base">Available Bundles</CardTitle>
                      {resCode !== undefined && <RcBadge code={resCode} />}
                    </div>
                    <CardDescription className="text-xs">
                      {resCode === '00'
                        ? 'Click a bundle to select it and proceed to Bill Inquiry.'
                        : 'responseCode: 00=success, 01=PCID not found, 03=error, 04=invalid'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {resCode === '00' && bundleDetails.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Biller: <span className="font-semibold">{String(parsedResponse?.billerName ?? '—')}</span>
                          {' · '}{bundleDetails.length} bundle(s)
                        </p>
                        <div className="space-y-2">
                          {bundleDetails.map((bd, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                setSelectedBundle(bd as unknown as OneLinkBundle);
                                setInquiryResult(null);
                                setPaymentResult(null);
                                setFlowStep(2);
                              }}
                              className="w-full text-left rounded-lg border p-3 hover:border-primary hover:bg-primary/5 transition-colors group"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-0.5 min-w-0">
                                  <p className="text-sm font-semibold truncate">{bd.bundleName}</p>
                                  <p className="text-xs text-muted-foreground font-mono">ID: {bd.bundleId}</p>
                                  {bd.description && <p className="text-xs text-muted-foreground">{bd.description}</p>}
                                  {bd.expiryDate && <p className="text-xs text-muted-foreground">Expires: {bd.expiryDate}</p>}
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="text-base font-bold font-mono">PKR {Number(bd.amount).toLocaleString()}</p>
                                  <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">Select →</span>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Raw JSON</Label>
                        <Textarea value={resText} readOnly rows={14} className="font-mono text-xs bg-muted/30"
                          placeholder="Run FetchBundle to see available bundles here…" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {/* ── Step 2: Bill Inquiry ── */}
          {flowStep >= 2 && selectedBundle && (
            <div className="space-y-4 max-w-5xl">
              {/* Selected bundle chip */}
              <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3 max-w-2xl">
                <CreditCard className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{selectedBundle.bundleName}</p>
                  <p className="text-xs text-muted-foreground font-mono">Bundle ID: {selectedBundle.bundleId} · PKR {Number(selectedBundle.amount).toLocaleString()}</p>
                </div>
                {flowStep === 2 && (
                  <Button variant="ghost" size="sm" className="text-xs h-7 shrink-0"
                    onClick={() => { setFlowStep(1); setSelectedBundle(null); }}>
                    Change
                  </Button>
                )}
              </div>

              {flowStep === 2 && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="text-base">Step 2 — Bill Inquiry</CardTitle>
                        <Badge variant="outline" className="font-mono text-xs">POST /api/1.0/Payments/BillInquiry</Badge>
                      </div>
                      <CardDescription className="text-xs">
                        Enter the consumer number (account ID assigned by the biller). The bank sends this to verify the consumer exists and fetch the amount due.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1">
                        <Label className="text-xs">Consumer Number <span className="text-red-500">*</span></Label>
                        <Input
                          value={flowConsumerNum}
                          onChange={(e) => setFlowConsumerNum(e.target.value)}
                          placeholder="e.g. 1234561001000000000001"
                          className="font-mono text-xs"
                        />
                        <p className="text-xs text-muted-foreground">
                          This number is created by the biller (us) and given to the consumer. Response code 01 = number not found.
                        </p>
                      </div>
                      <div className="rounded bg-muted/30 border p-2 text-xs space-y-0.5">
                        <p className="font-medium text-muted-foreground">Sending to /api/1.0/Payments/BillInquiry</p>
                        <p>consumer_number: <span className="font-mono">{flowConsumerNum || '…'}</span></p>
                        <p>bank_mnemonic: <span className="font-mono">{pcid}</span></p>
                        <p>reserved: <span className="font-mono text-muted-foreground">…+bundleId({selectedBundle.bundleId})+…</span></p>
                      </div>
                      <Button size="sm" className="gap-2" onClick={() => void runBillInquiry()} disabled={inquiryLoading}>
                        <Send className="w-3 h-3" />
                        {inquiryLoading ? 'Checking…' : 'Verify Consumer'}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Inquiry Response</CardTitle>
                      <CardDescription className="text-xs">
                        bill_status: U=unpaid (can pay), P=already paid, B=blocked. response_Code 00=valid.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {inquiryResult ? (
                        <div className="space-y-3">
                          <div className="rounded-lg border p-3 text-xs space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-1.5 py-0.5 rounded border text-xs font-mono font-semibold ${inquiryResult.response_Code === '00' ? 'bg-green-500/10 text-green-600 border-green-400/30' : 'bg-red-500/10 text-red-500 border-red-400/30'}`}>
                                {inquiryResult.response_Code === '00' ? '00 Valid Consumer' : `${inquiryResult.response_Code} Error`}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded border text-xs font-mono font-semibold ${inquiryResult.bill_status === 'U' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-400/30' : inquiryResult.bill_status === 'P' ? 'bg-blue-500/10 text-blue-600 border-blue-400/30' : 'bg-red-500/10 text-red-500 border-red-400/30'}`}>
                                {inquiryResult.bill_status === 'U' ? 'Unpaid' : inquiryResult.bill_status === 'P' ? 'Already Paid' : `Status: ${inquiryResult.bill_status}`}
                              </span>
                            </div>
                            {inquiryResult.response_Code === '00' && (
                              <>
                                <p>Name: <span className="font-semibold">{inquiryResult.consumer_detail.trim()}</span></p>
                                <p>Amount due: <span className="font-mono font-bold">PKR {parseAN14(inquiryResult.amount_within_dueDate).toLocaleString()}</span></p>
                                {inquiryResult.due_date && <p>Due date: <span className="font-mono">{inquiryResult.due_date}</span></p>}
                              </>
                            )}
                          </div>
                          <Textarea value={fmt(inquiryResult)} readOnly rows={8} className="font-mono text-xs bg-muted/30" />
                          {inquiryResult.response_Code === '00' && inquiryResult.bill_status === 'U' && (
                            <p className="text-xs text-green-600 font-medium">✓ Consumer verified — proceed to Step 3 to complete payment.</p>
                          )}
                        </div>
                      ) : (
                        <Textarea readOnly rows={10} className="font-mono text-xs bg-muted/30"
                          placeholder="Inquiry response will appear here…" value="" />
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Confirm & Pay ── */}
          {flowStep === 3 && selectedBundle && inquiryResult && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-5xl">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-base">Step 3 — Confirm Payment</CardTitle>
                    <Badge variant="outline" className="font-mono text-xs">POST /api/1.0/Payments/BillPayment</Badge>
                  </div>
                  <CardDescription className="text-xs">
                    The bank sends the payment after the customer confirms. tran_auth_id and timestamp are auto-generated.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border bg-muted/10 p-3 text-sm space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{inquiryResult.consumer_detail.trim()}</p>
                        <p className="text-xs text-muted-foreground font-mono">{flowConsumerNum}</p>
                        <p className="text-xs text-muted-foreground mt-1">{selectedBundle.bundleName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold font-mono">PKR {parseAN14(inquiryResult.amount_within_dueDate).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Amount to pay</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded bg-muted/30 border p-2 text-xs space-y-0.5">
                    <p className="font-medium text-muted-foreground">Will send to /api/1.0/Payments/BillPayment</p>
                    <p>consumer_number: <span className="font-mono">{flowConsumerNum}</span></p>
                    <p>transaction_amount: <span className="font-mono">{toAN12(parseAN14(inquiryResult.amount_within_dueDate))}</span> (AN12)</p>
                    <p>bank_mnemonic: <span className="font-mono">{pcid}</span></p>
                    <p>tran_auth_id: <span className="font-mono text-muted-foreground">auto-generated (6-digit)</span></p>
                    <p>reserved: <span className="font-mono text-muted-foreground">…+bundleId({selectedBundle.bundleId})+…</span></p>
                  </div>
                  <Button
                    size="sm"
                    className="gap-2 w-full"
                    onClick={() => void runBillPayment()}
                    disabled={paymentLoading || paymentResult?.response_Code === '00'}
                  >
                    <CreditCard className="w-3 h-3" />
                    {paymentLoading ? 'Processing…' : paymentResult?.response_Code === '00' ? 'Payment Complete ✓' : 'Confirm & Pay'}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Payment Response</CardTitle>
                  <CardDescription className="text-xs">
                    response_Code 00 = success. The biller records the payment and updates invoice status.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {paymentResult ? (
                    <div className="space-y-3">
                      <div className={`rounded-lg border p-3 text-xs ${paymentResult.response_Code === '00' ? 'bg-green-500/5 border-green-400/30' : 'bg-red-500/5 border-red-400/30'}`}>
                        {paymentResult.response_Code === '00' ? (
                          <>
                            <p className="font-bold text-green-700 dark:text-green-400 text-sm">Payment Accepted ✓</p>
                            <p className="mt-1">Consumer: <span className="font-semibold">{paymentResult.Identification_parameter}</span></p>
                            <p>Bundle: <span className="font-mono">{selectedBundle.bundleId}</span> — {selectedBundle.bundleName}</p>
                            <p>Amount: <span className="font-mono font-bold">PKR {parseAN14(inquiryResult.amount_within_dueDate).toLocaleString()}</span></p>
                          </>
                        ) : (
                          <p className="text-red-600 font-semibold">Failed — code {paymentResult.response_Code}</p>
                        )}
                      </div>
                      <Textarea value={fmt(paymentResult)} readOnly rows={6} className="font-mono text-xs bg-muted/30" />
                    </div>
                  ) : (
                    <Textarea readOnly rows={10} className="font-mono text-xs bg-muted/30"
                      placeholder="Payment response will appear here after confirmation…" value="" />
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Shared PCID credentials for tabs 2-4 */}
        {(['checkpayment', 'billstatus', 'paymenthistory'] as const).map((tab) => (
          <TabsContent key={tab} value={tab} className="space-y-6 pt-4">
            <PcidCredPanel
              pcidKeys={pcidKeys}
              selectedPcid={selectedPcid}
              setSelectedPcid={setSelectedPcid}
              showKey={showKey}
              setShowKey={setShowKey}
              consumerNumber={consumerNumber}
              setConsumerNumber={setConsumerNumber}
            />
            {tab === 'checkpayment' && (
              <SaasTester
                title="Check Payment"
                method="POST"
                endpointTemplate="/api/saas/v1/check-payment"
                pcidKey={selectedPcidKey}
                consumerNumber={consumerNumber}
              />
            )}
            {tab === 'billstatus' && (
              <SaasTester
                title="Bill Status"
                method="GET"
                endpointTemplate="/api/saas/v1/bill-status/:consumerNumber"
                pcidKey={selectedPcidKey}
                consumerNumber={consumerNumber}
              />
            )}
            {tab === 'paymenthistory' && (
              <SaasTester
                title="Payment History"
                method="GET"
                endpointTemplate="/api/saas/v1/payment-history/:consumerNumber"
                pcidKey={selectedPcidKey}
                consumerNumber={consumerNumber}
              />
            )}
          </TabsContent>
        ))}

        {/* ── Tab 6: Register Consumer ── */}
        <TabsContent value="registerconsumer" className="space-y-6 pt-4">
          <Card className="max-w-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <KeyRound className="w-4 h-4" /> SaaS Gateway Credentials
              </CardTitle>
              <CardDescription className="text-xs">
                Select a PCID linked to a biller. The new consumer will be registered under that biller.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">PCID</Label>
                  <Select value={selectedPcid} onValueChange={setSelectedPcid}>
                    <SelectTrigger className="font-mono text-xs"><SelectValue placeholder="Select PCID…" /></SelectTrigger>
                    <SelectContent>
                      {pcidKeys.map((k) => (
                        <SelectItem key={k.pcid} value={k.pcid}>
                          {k.pcid} {k.billerId ? `— ${k.billerName ?? 'linked'}` : '(not linked)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">X-API-Key</Label>
                  <div className="flex gap-1">
                    <Input
                      value={pcidKeys.find((k) => k.pcid === selectedPcid)?.apiKey ?? ''}
                      readOnly
                      type={showKey ? 'text' : 'password'}
                      className="font-mono text-xs bg-muted/40"
                      placeholder="Select a PCID above"
                    />
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setShowKey(!showKey)}>
                      {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>
              {selectedPcidKey && !selectedPcidKey.billerId && (
                <p className="text-xs text-yellow-600 bg-yellow-500/5 border border-yellow-400/30 rounded px-2 py-1">
                  ⚠ This PCID is not linked to a biller. Requests will return 403 PCID_NOT_LINKED.
                </p>
              )}
            </CardContent>
          </Card>
          <RegisterConsumerTester pcidKey={selectedPcidKey} />
        </TabsContent>

        {/* ── Tab 5: Make Payment ── */}
        <TabsContent value="makepayment" className="space-y-6 pt-4">
          <PcidCredPanel
            pcidKeys={pcidKeys}
            selectedPcid={selectedPcid}
            setSelectedPcid={setSelectedPcid}
            showKey={showKey}
            setShowKey={setShowKey}
            consumerNumber={consumerNumber}
            setConsumerNumber={setConsumerNumber}
          />
          <MakePaymentTester pcidKey={selectedPcidKey} consumerNumber={consumerNumber} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FetchBundleSandbox;
