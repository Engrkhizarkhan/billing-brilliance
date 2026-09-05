import { useState } from 'react';
import { Check, Clipboard, Code2, KeyRound, LockKeyhole, Network, Webhook } from 'lucide-react';
import { toast } from 'sonner';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type EndpointDoc = {
  id: string;
  method: 'GET' | 'POST';
  path: string;
  title: string;
  description: string;
  audience: string;
  request?: unknown;
  response: unknown;
  notes: string[];
};

const endpoints: EndpointDoc[] = [
  {
    id: 'health', method: 'GET', path: '/api/health', title: 'Service health', audience: 'Public',
    description: 'Confirms that the organization payment API process is reachable.',
    response: { data: { status: 'ok', service: 'org-payment-controller', timestamp: '2026-09-05T08:00:00.000Z' } },
    notes: ['No request body or API key is required.', 'Use /api/ready for infrastructure readiness checks, including database connectivity.'],
  },
  {
    id: 'create-payment', method: 'POST', path: '/api/payments/create', title: 'Create payment request', audience: 'Organization system',
    description: 'Creates an idempotent invoice-based payment request and returns the 1BILL consumer number.',
    request: { applicant_id: 'APP-10025', application_id: 'FORM-2026-00041', posting_id: 'POST-2026-09', amount: 2500, due_date: '2026-09-10', customer_name: 'Example Applicant', description: 'Application processing fee' },
    response: { data: { paymentId: '2b624b2e-54ca-4a58-a8e9-57e194f34d4d', billId: 'ORG-2B624B2E', consumerNumber: '10517220010000000001', status: 'pending', payment: { application_id: 'FORM-2026-00041', amount: 2500, due_date: '2026-09-10', expiry_date: '2026-09-10T23:59:59.000Z' }, oneBillRequest: { applicationId: 'FORM-2026-00041', consumerNumber: '10517220010000000001', amount: 2500, customerName: 'Example Applicant' } } },
    notes: ['Send a unique, stable application_id. Repeating it returns the existing payment instead of creating a duplicate.', 'amount must be greater than zero. Dates use ISO 8601.'],
  },
  {
    id: 'payment-status', method: 'GET', path: '/api/payments/{application_id}', title: 'Get payment status', audience: 'Organization system',
    description: 'Returns the current payment state for an application identifier.',
    response: { data: { applicationId: 'FORM-2026-00041', status: 'paid', payment: { bill_id: 'ORG-2B624B2E', consumer_number: '10517220010000000001', amount: 2500, paid_at: '2026-09-05T08:12:40.000Z', transaction_id: '1LK9A2B3' } } },
    notes: ['Replace {application_id} with a URL-encoded identifier.', 'A missing record returns status: not_found in the data envelope.'],
  },
  {
    id: 'bill-inquiry', method: 'POST', path: '/api/1.0/Payments/BillInquiry', title: '1BILL balance inquiry', audience: '1LINK network',
    description: 'Allows 1LINK to validate a consumer number and retrieve the payable amount.',
    request: { consumer_number: '10517220010000000001', bank_mnemonic: 'UBL', reserved: '' },
    response: { response_Code: '00', consumer_detail: 'EXAMPLE APPLICANT             ', bill_status: 'U', due_date: '20260910', amount_within_dueDate: '+0000000250000', amount_after_dueDate: '+0000000250000', billing_month: '202609', date_paid: '', amount_paid: '', tran_auth_Id: '', reserved: '' },
    notes: ['Uses the dedicated 1LINK username/password and network allowlist, not the organization X-API-Key.', 'Consumer identifiers are numeric and may be up to 24 digits for the agreed UAT edge case.'],
  },
  {
    id: 'bill-payment', method: 'POST', path: '/api/1.0/Payments/BillPayment', title: '1BILL payment notification', audience: '1LINK network',
    description: 'Posts the successful payment transaction against the invoice with duplicate protection.',
    request: { consumer_number: '10517220010000000001', tran_auth_id: 'A1B2C3', transaction_amount: '000000250000', tran_date: '20260905', tran_time: '131240', bank_mnemonic: 'UBL', reserved: '' },
    response: { response_Code: '00', Identification_parameter: 'A1B2C3' },
    notes: ['The transaction amount must exactly match the amount currently due.', 'Repeating the same transaction is handled idempotently and does not create a second ledger posting.'],
  },
  {
    id: 'webhook', method: 'POST', path: 'Your configured HTTPS webhook URL', title: 'Payment-status webhook', audience: 'Your organization endpoint',
    description: 'FinBill pushes a signed notification to your system after the payment state changes.',
    request: { application_id: 'FORM-2026-00041', status: 'paid', transaction_id: '1LK9A2B3', paid_at: '2026-09-05 08:12:40' },
    response: { acknowledged: true },
    notes: ['Verify X-Webhook-Signature using HMAC-SHA256 before processing the body.', 'Return a 2xx response quickly and deduplicate events by transactionId/applicationId. Configure and test the URL under Webhook Config.'],
  },
];

const JsonBlock = ({ value, label }: { value: unknown; label: string }) => {
  const [copied, setCopied] = useState(false);
  const content = JSON.stringify(value, null, 2);
  const copy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success(`${label} JSON copied`);
    window.setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="overflow-hidden rounded-lg border bg-slate-950 text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
        <Button type="button" variant="ghost" size="sm" className="h-7 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => void copy()}>
          {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Clipboard className="mr-1.5 h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-5"><code>{content}</code></pre>
    </div>
  );
};

const MethodBadge = ({ method }: { method: EndpointDoc['method'] }) => (
  <Badge className={method === 'POST' ? 'bg-emerald-600 hover:bg-emerald-600' : 'bg-blue-600 hover:bg-blue-600'}>{method}</Badge>
);

const OrgApiIntegration = () => (
  <div className="space-y-6 animate-fade-in">
    <div>
      <div className="mb-2 flex items-center gap-2"><Code2 className="h-5 w-5 text-primary" /><Badge variant="outline">API v1</Badge></div>
      <h1 className="page-header">API Integration</h1>
      <p className="page-description max-w-3xl">Implementation reference for connecting your organization system to FinBill and the 1BILL invoice-payment flow.</p>
    </div>

    <div className="grid gap-4 lg:grid-cols-3">
      <Card><CardHeader><KeyRound className="h-5 w-5 text-primary" /><CardTitle className="text-base">Authentication</CardTitle><CardDescription>Send <code className="font-mono text-foreground">X-API-Key: YOUR_KEY</code> from server-side code only. Never expose the key in a browser or mobile bundle.</CardDescription></CardHeader></Card>
      <Card><CardHeader><LockKeyhole className="h-5 w-5 text-primary" /><CardTitle className="text-base">Transport security</CardTitle><CardDescription>Production calls require HTTPS. Configure approved source IPs and rotate credentials through Security settings.</CardDescription></CardHeader></Card>
      <Card><CardHeader><Network className="h-5 w-5 text-primary" /><CardTitle className="text-base">Base URL</CardTitle><CardDescription><code className="font-mono text-foreground">https://app.fintap.com</code><br />Use the separately supplied UAT host during certification.</CardDescription></CardHeader></Card>
    </div>

    <Card>
      <CardHeader><CardTitle className="text-base">Required headers</CardTitle><CardDescription>Organization endpoints and 1LINK network endpoints use separate credentials.</CardDescription></CardHeader>
      <CardContent className="grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-lg border p-4"><p className="mb-2 font-semibold">Organization request</p><code className="block text-xs text-muted-foreground">Content-Type: application/json</code><code className="block text-xs text-muted-foreground">X-API-Key: YOUR_ORGANIZATION_KEY</code></div>
        <div className="rounded-lg border p-4"><p className="mb-2 font-semibold">Webhook receiver</p><code className="block text-xs text-muted-foreground">Content-Type: application/json</code><code className="block text-xs text-muted-foreground">X-Webhook-Signature: HMAC_SHA256_HEX</code></div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Endpoint reference</CardTitle><CardDescription>Open an endpoint to view its purpose, JSON contract, and integration rules.</CardDescription></CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full">
          {endpoints.map((endpoint) => (
            <AccordionItem key={endpoint.id} value={endpoint.id}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex min-w-0 items-center gap-3 text-left"><MethodBadge method={endpoint.method} /><code className="truncate text-xs sm:text-sm">{endpoint.path}</code><span className="hidden text-sm font-medium text-muted-foreground lg:inline">— {endpoint.title}</span></div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-6">
                <div><div className="mb-1 flex items-center gap-2"><h3 className="font-semibold">{endpoint.title}</h3><Badge variant="secondary">{endpoint.audience}</Badge></div><p className="text-sm text-muted-foreground">{endpoint.description}</p></div>
                <div className={`grid gap-4 ${endpoint.request ? 'xl:grid-cols-2' : ''}`}>
                  {endpoint.request && <JsonBlock value={endpoint.request} label="JSON request" />}
                  <JsonBlock value={endpoint.response} label="JSON response" />
                </div>
                <ul className="space-y-1.5 text-sm text-muted-foreground">{endpoint.notes.map((note) => <li key={note} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{note}</li>)}</ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>

    <Card className="border-amber-300/60 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
      <CardHeader className="flex-row gap-3"><Webhook className="mt-1 h-5 w-5 text-amber-600" /><div><CardTitle className="text-base">Production checklist</CardTitle><CardDescription>Complete UAT, configure the CA-authorized certificate, TLS 1.2 cipher, source-IP allowlists, webhook signature verification, idempotency, monitoring, and rollback ownership before switching the production base URL.</CardDescription></div></CardHeader>
    </Card>
  </div>
);

export default OrgApiIntegration;
