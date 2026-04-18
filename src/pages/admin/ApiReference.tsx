import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { PcidKey } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { BookOpen, Copy, CheckCheck, Eye, EyeOff, KeyRound, ExternalLink, Info } from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────

const MethodBadge = ({ method }: { method: string }) => {
  const colors: Record<string, string> = {
    POST: 'bg-blue-500/10 text-blue-600 border-blue-400/30',
    GET:  'bg-green-500/10 text-green-600 border-green-400/30',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-xs font-mono font-bold ${colors[method] ?? 'bg-muted text-muted-foreground'}`}>
      {method}
    </span>
  );
};

const CodeBlock = ({ children }: { children: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(children);
    setCopied(true);
    toast.success('Copied');
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative group">
      <pre className="rounded-lg bg-muted/40 border text-xs font-mono p-3 pr-10 overflow-x-auto whitespace-pre-wrap leading-relaxed">
        {children}
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
        title="Copy"
      >
        {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
};

const Field = ({ name, type, required, desc }: { name: string; type: string; required?: boolean; desc: string }) => (
  <div className="flex gap-3 py-1.5 border-b last:border-0 text-sm">
    <div className="w-36 shrink-0">
      <span className="font-mono text-xs font-semibold">{name}</span>
      {required && <span className="ml-1 text-destructive text-xs">*</span>}
    </div>
    <div className="w-20 shrink-0 text-xs text-muted-foreground font-mono">{type}</div>
    <div className="text-xs text-muted-foreground">{desc}</div>
  </div>
);

const ApiReference = () => {
  const [baseUrl, setBaseUrl] = useState(() => window.location.origin);
  const [pcidKeys, setPcidKeys] = useState<PcidKey[]>([]);
  const [selectedPcid, setSelectedPcid] = useState('');
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    void api.fetchPcidKeys().then((res) => {
      const list = res.data ?? [];
      setPcidKeys(list);
      if (list.length > 0) setSelectedPcid(list[0].pcid);
    });
  }, []);

  const selectedPcidKey = pcidKeys.find((k) => k.pcid === selectedPcid);
  const apiKey = selectedPcidKey?.apiKey ?? '';

  const toggleVisible = (pcid: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      next.has(pcid) ? next.delete(pcid) : next.add(pcid);
      return next;
    });
  };

  const copyKey = (key: string, pcid: string) => {
    void navigator.clipboard.writeText(key);
    setCopiedKey(pcid);
    toast.success('API key copied');
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const saasConsumerEx = '1234567890';

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header flex items-center gap-2">
          <BookOpen className="w-5 h-5" /> External API Reference
        </h1>
        <p className="page-description">
          Four external gateway APIs. Share these with integrated systems — integrators use their per-PCID API key; banks/aggregators use the 1LINK credentials.
        </p>
      </div>

      {/* ── Server base URL ── */}
      <Card className="max-w-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Server Base URL</CardTitle>
          <CardDescription className="text-xs">Update this if the server is deployed at a different origin.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value.replace(/\/$/, ''))}
            className="font-mono text-xs"
            placeholder="http://192.168.1.10:3000"
          />
        </CardContent>
      </Card>

      <Tabs defaultValue="saas">
        <TabsList>
          <TabsTrigger value="saas">SaaS Gateway (3 APIs)</TabsTrigger>
          <TabsTrigger value="fetchbundle">1LINK FetchBundle</TabsTrigger>
        </TabsList>

        {/* ══════════════════ SaaS Gateway Tab ══════════════════ */}
        <TabsContent value="saas" className="space-y-6 mt-4">
          {/* PCID API keys table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <KeyRound className="w-4 h-4" /> PCID API Keys
              </CardTitle>
              <CardDescription className="text-xs">
                Each PCID has a unique API key. Pass it as the{' '}
                <span className="font-mono">X-API-Key</span> header on every SaaS gateway request.
                The PCID must be linked to a biller — queries are scoped to that biller&apos;s consumers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">PCID</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Linked Biller</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2 w-80">API Key</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pcidKeys.length === 0 && (
                      <tr>
                        <td colSpan={3} className="text-center text-muted-foreground text-xs py-6">
                          No PCID keys found. Create a bundle first.
                        </td>
                      </tr>
                    )}
                    {pcidKeys.map((k) => (
                      <tr key={k.pcid} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-3 py-2 font-mono text-xs font-semibold">{k.pcid}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {k.billerName ?? <span className="italic">Not linked</span>}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs flex-1 min-w-0 truncate">
                              {visibleKeys.has(k.pcid) ? k.apiKey : '••••••••••••••••••••••••'}
                            </span>
                            <Button
                              variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                              onClick={() => toggleVisible(k.pcid)}
                            >
                              {visibleKeys.has(k.pcid) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                              onClick={() => copyKey(k.apiKey, k.pcid)}
                            >
                              {copiedKey === k.pcid ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" />
                Manage PCID keys (regenerate, link billers) on the{' '}
                <a href="/admin/bundles" className="underline inline-flex items-center gap-0.5">
                  Bundle Management page <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </p>
            </CardContent>
          </Card>

          {/* Select PCID for cURL examples */}
          {pcidKeys.length > 0 && (
            <Card className="max-w-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Select PCID for cURL examples</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedPcid} onValueChange={setSelectedPcid}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a PCID…" />
                  </SelectTrigger>
                  <SelectContent>
                    {pcidKeys.map((k) => (
                      <SelectItem key={k.pcid} value={k.pcid}>
                        {k.pcid}{k.billerName ? ` — ${k.billerName}` : ' (not linked)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {/* API 1 — check-payment */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <MethodBadge method="POST" />
                    <CardTitle className="text-base font-mono">/api/saas/v1/check-payment</CardTitle>
                  </div>
                  <CardDescription>Quick "has this consumer paid?" check. Returns a boolean + latest invoice info.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Authentication</Label>
                <div className="rounded-lg border bg-muted/20 p-3 text-xs space-y-1">
                  <p><span className="font-mono font-semibold">Header:</span> <span className="font-mono">X-API-Key: &lt;pcid-api-key&gt;</span></p>
                  <p className="text-muted-foreground">Each key is scoped to a PCID linked to one biller — only that biller&apos;s consumers can be queried.</p>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Request body</Label>
                <div className="space-y-0">
                  <Field name="consumerNumber" type="string" required desc="The consumer's 10-24 digit account/roll number" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Response fields</Label>
                <div className="space-y-0">
                  <Field name="paid" type="boolean" desc="true if the latest invoice status is 'paid'" />
                  <Field name="status" type="string" desc="paid | pending | overdue | no_invoices | not_found" />
                  <Field name="consumerNumber" type="string" desc="Echo of the input" />
                  <Field name="studentName" type="string" desc="Registered name" />
                  <Field name="invoiceNumber" type="string" desc="Most recent invoice number" />
                  <Field name="amount" type="number" desc="Invoice amount (PKR)" />
                  <Field name="dueDate" type="string" desc="Invoice due date (YYYY-MM-DD)" />
                  <Field name="lastPayment" type="object|null" desc="{ amount, paidAt, transactionId } or null" />
                </div>
              </div>
              <Separator />
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">cURL example</Label>
                <CodeBlock>{`curl -X POST ${baseUrl}/api/saas/v1/check-payment \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${apiKey || '<paste-api-key-here>'}" \\
  -d '{"consumerNumber":"${saasConsumerEx}"}'`}</CodeBlock>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Example response</Label>
                <CodeBlock>{`{
  "paid": false,
  "status": "overdue",
  "consumerNumber": "${saasConsumerEx}",
  "studentName": "Ali Hassan",
  "invoiceNumber": "INV-2026-04-001",
  "amount": 18000,
  "dueDate": "2026-03-31",
  "lastPayment": {
    "amount": 18000,
    "paidAt": "2026-02-10T08:30:00.000Z",
    "transactionId": "TXN-2026-02-8821"
  }
}`}</CodeBlock>
              </div>
            </CardContent>
          </Card>

          {/* API 2 — bill-status */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <MethodBadge method="GET" />
                    <CardTitle className="text-base font-mono">/api/saas/v1/bill-status/:consumerNumber</CardTitle>
                  </div>
                  <CardDescription>Full financial snapshot — all invoice aggregates, pending/overdue amounts, last payment date.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Authentication</Label>
                <div className="rounded-lg border bg-muted/20 p-3 text-xs">
                  <p><span className="font-mono font-semibold">Header:</span> <span className="font-mono">X-API-Key: &lt;pcid-api-key&gt;</span></p>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">URL parameters</Label>
                <div className="space-y-0">
                  <Field name="consumerNumber" type="string" required desc="Consumer account number in the URL path" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Response fields</Label>
                <div className="space-y-0">
                  <Field name="consumerNumber" type="string" desc="Echo" />
                  <Field name="studentName" type="string" desc="Full name" />
                  <Field name="class" type="string" desc="Class/grade" />
                  <Field name="section" type="string" desc="Section" />
                  <Field name="accountStatus" type="string" desc="active | inactive" />
                  <Field name="paymentStatus" type="string" desc="paid_up | due | overdue" />
                  <Field name="totalDue" type="number" desc="pending + overdue total (PKR)" />
                  <Field name="totalPaid" type="number" desc="Sum of all paid invoices (PKR)" />
                  <Field name="pendingAmount" type="number" desc="Sum of pending invoices (PKR)" />
                  <Field name="overdueAmount" type="number" desc="Sum of overdue invoices (PKR)" />
                  <Field name="pendingInvoices" type="number" desc="Count of pending invoices" />
                  <Field name="overdueInvoices" type="number" desc="Count of overdue invoices" />
                  <Field name="lastPaymentDate" type="string|null" desc="ISO timestamp of most recent payment" />
                </div>
              </div>
              <Separator />
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">cURL example</Label>
                <CodeBlock>{`curl -X GET "${baseUrl}/api/saas/v1/bill-status/${saasConsumerEx}" \\
  -H "X-API-Key: ${apiKey || '<paste-api-key-here>'}"`}</CodeBlock>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Example response</Label>
                <CodeBlock>{`{
  "consumerNumber": "${saasConsumerEx}",
  "studentName": "Ali Hassan",
  "class": "Class 10",
  "section": "A",
  "accountStatus": "active",
  "paymentStatus": "overdue",
  "totalDue": 36000,
  "totalPaid": 72000,
  "pendingAmount": 18000,
  "overdueAmount": 18000,
  "pendingInvoices": 1,
  "overdueInvoices": 1,
  "lastPaymentDate": "2026-02-10T08:30:00.000Z"
}`}</CodeBlock>
              </div>
            </CardContent>
          </Card>

          {/* API 3 — payment-history */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <MethodBadge method="GET" />
                    <CardTitle className="text-base font-mono">/api/saas/v1/payment-history/:consumerNumber</CardTitle>
                  </div>
                  <CardDescription>Paginated list of all payment ledger entries for a consumer.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Authentication</Label>
                <div className="rounded-lg border bg-muted/20 p-3 text-xs">
                  <p><span className="font-mono font-semibold">Header:</span> <span className="font-mono">X-API-Key: &lt;pcid-api-key&gt;</span></p>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">URL params + query params</Label>
                <div className="space-y-0">
                  <Field name="consumerNumber" type="string" required desc="Consumer account number in the URL path" />
                  <Field name="page" type="number" desc="Page number (default: 1)" />
                  <Field name="pageSize" type="number" desc="Results per page (default: 20, max: 100)" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Response</Label>
                <div className="space-y-0">
                  <Field name="consumerNumber" type="string" desc="Echo" />
                  <Field name="studentName" type="string" desc="Full name" />
                  <Field name="data[]" type="array" desc="Array of payment entries (see below)" />
                  <Field name="data[].id" type="string" desc="Ledger entry ID" />
                  <Field name="data[].date" type="string" desc="Payment date (YYYY-MM-DD)" />
                  <Field name="data[].amount" type="number" desc="Amount paid (PKR)" />
                  <Field name="data[].balance" type="number" desc="Running balance after payment" />
                  <Field name="data[].description" type="string" desc="Narration" />
                  <Field name="data[].reference" type="string" desc="Transaction reference / receipt number" />
                  <Field name="data[].createdAt" type="string" desc="ISO timestamp" />
                  <Field name="meta.page" type="number" desc="Current page" />
                  <Field name="meta.pageSize" type="number" desc="Results per page" />
                  <Field name="meta.total" type="number" desc="Total payment records" />
                </div>
              </div>
              <Separator />
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">cURL example</Label>
                <CodeBlock>{`curl -X GET "${baseUrl}/api/saas/v1/payment-history/${saasConsumerEx}?page=1&pageSize=20" \\
  -H "X-API-Key: ${apiKey || '<paste-api-key-here>'}"`}</CodeBlock>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Example response</Label>
                <CodeBlock>{`{
  "consumerNumber": "${saasConsumerEx}",
  "studentName": "Ali Hassan",
  "data": [
    {
      "id": "d1e2f3a4-...",
      "date": "2026-02-10",
      "amount": 18000,
      "balance": 0,
      "description": "Payment received — Monthly fee Feb 2026",
      "reference": "TXN-2026-02-8821",
      "createdAt": "2026-02-10T08:30:00.000Z"
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 8 }
}`}</CodeBlock>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════════════ 1LINK FetchBundle Tab ══════════════════ */}
        <TabsContent value="fetchbundle" className="space-y-6 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <MethodBadge method="POST" />
                    <CardTitle className="text-base font-mono">/v1/Transaction/Fetchbundle</CardTitle>
                  </div>
                  <CardDescription>
                    1LINK Generic REST Spec v1.5 — Transaction 1. Called by banks/aggregators to retrieve available fee bundles for a biller.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Authentication</Label>
                <div className="rounded-lg border bg-muted/20 p-3 text-xs space-y-1.5">
                  <p><span className="font-mono font-semibold">username</span> header — matches <span className="font-mono">ONELINK_USERNAME</span> in server .env</p>
                  <p><span className="font-mono font-semibold">password</span> header — matches <span className="font-mono">ONELINK_PASSWORD</span> in server .env</p>
                  <p className="text-muted-foreground pt-1">Same credential pair shared with BillInquiry and BillPayment endpoints.</p>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Request body</Label>
                <div className="space-y-0">
                  <Field name="PCID" type="string" required desc="Biller code (max 8 chars). Must match a PCID with active bundles in the database." />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Response fields</Label>
                <div className="space-y-0">
                  <Field name="companyId" type="string" desc="Echoes the PCID on success" />
                  <Field name="responseCode" type="string" desc="00=success, 01=not found, 03=error, 04=invalid PCID" />
                  <Field name="billerName" type="string" desc="Biller name from the first matching bundle row" />
                  <Field name="bundleDetails" type="array" desc="Array of bundle objects (see below)" />
                  <Field name="bundleDetails[].bundleId" type="string" desc="Unique bundle identifier (max 20 chars)" />
                  <Field name="bundleDetails[].bundleName" type="string" desc="Display name (max 100 chars)" />
                  <Field name="bundleDetails[].description" type="string" desc="Short description (optional)" />
                  <Field name="bundleDetails[].expiryDate" type="string" desc="Expiry date string e.g. 31-DEC-26 (optional)" />
                  <Field name="bundleDetails[].amount" type="string" desc="Amount as string, e.g. '18000'" />
                  <Field name="bundleDetails[].tag" type="string" desc="Arbitrary metadata up to 2000 chars (optional)" />
                </div>
              </div>
              <Separator />
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">cURL example</Label>
                <CodeBlock>{`curl -X POST ${baseUrl}/v1/Transaction/Fetchbundle \\
  -H "Content-Type: application/json" \\
  -H "username: <ONELINK_USERNAME>" \\
  -H "password: <ONELINK_PASSWORD>" \\
  -d '{"PCID":"MBLINK01"}'`}</CodeBlock>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Success response (00)</Label>
                  <CodeBlock>{`{
  "companyId": "MBLINK01",
  "responseCode": "00",
  "billerName": "My Bank",
  "bundleDetails": [
    {
      "bundleId": "PKG001",
      "bundleName": "Annual Package",
      "description": "Full year fee bundle",
      "expiryDate": "31-DEC-26",
      "amount": "108000",
      "tag": ""
    }
  ]
}`}</CodeBlock>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Not found response (01)</Label>
                    <CodeBlock>{`{
  "companyId": "UNKNOWN",
  "responseCode": "01",
  "billerName": "",
  "bundleDetails": []
}`}</CodeBlock>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Response codes</Label>
                    <div className="rounded border text-xs overflow-hidden">
                      {[
                        ['00', 'Success — bundleDetails populated'],
                        ['01', 'PCID not found or no active bundles'],
                        ['03', 'Server error'],
                        ['04', 'Invalid / missing PCID or bad credentials'],
                      ].map(([code, desc]) => (
                        <div key={code} className="flex gap-3 px-3 py-1.5 border-b last:border-0 hover:bg-muted/20">
                          <span className="font-mono font-bold w-6 shrink-0">{code}</span>
                          <span className="text-muted-foreground">{desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3 text-xs space-y-1 text-muted-foreground">
                <p className="font-semibold text-foreground">Manage bundles</p>
                <p>
                  Create, edit, and deactivate bundles for each PCID on the{' '}
                  <a href="/admin/bundles" className="underline inline-flex items-center gap-0.5">
                    Bundles page <ExternalLink className="w-2.5 h-2.5" />
                  </a>{' '}
                  or test live requests in the{' '}
                  <a href="/admin/fetchbundle-sandbox" className="underline inline-flex items-center gap-0.5">
                    FetchBundle Sandbox <ExternalLink className="w-2.5 h-2.5" />
                  </a>.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ApiReference;
