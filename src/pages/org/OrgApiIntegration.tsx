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
    id: 'list-payments', method: 'GET', path: '/api/payments?page=1&limit=30', title: 'List payment requests', audience: 'Organization system',
    description: 'Returns tenant-scoped payment requests in newest-first order.',
    response: { data: [{ application_id: 'FORM-2026-00041', customer_name: 'Example Applicant', consumer_number: '10517220010000000001', amount: 2500, status: 'paid', transaction_id: '1LK9A2B3' }], meta: { page: 1, pageSize: 30, total: 1, pages: 1 } },
    notes: ['page starts at 1.', 'limit accepts 1 through 30; larger values are safely capped at 30.', 'Optional filters include status, from, to, application_id, and search.'],
  },
  {
    id: 'list-notifications', method: 'GET', path: '/api/payment-notifications?page=1&limit=30', title: 'List payment notifications', audience: 'Organization system',
    description: 'Returns the tenant-scoped payment-notification history for reconciliation and support.',
    response: { data: [{ application_id: 'FORM-2026-00041', status: 'paid', sent_at: '2026-09-05T08:12:41.000Z' }], meta: { page: 1, pageSize: 30, total: 1, pages: 1 } },
    notes: ['page starts at 1.', 'limit accepts 1 through 30 and is capped at 30.', 'Optional filters include status, from, to, and application_id.'],
  },
  {
    id: 'webhook', method: 'POST', path: 'Your configured HTTPS webhook URL', title: 'Payment-status webhook', audience: 'Your organization endpoint',
    description: 'Fintap pushes a signed notification to your system after the payment state changes.',
    request: { event_id: '60dfe530-8b37-4b59-80df-a5524b735993', event_type: 'payment.posted', created_at: '2026-09-05T08:12:41.000Z', data: { paymentId: '2b624b2e-54ca-4a58-a8e9-57e194f34d4d', consumerNumber: '10517220010000000001', amount: 2500, currency: 'PKR', reference: '1LK9A2B3' } },
    response: { acknowledged: true },
    notes: ['Verify X-Webhook-Signature using HMAC-SHA256 over the exact raw JSON body before processing it.', 'Return a 2xx response quickly and deduplicate events by X-Fintap-Event-Id/event_id. Delivery is retried with backoff. Configure and test the URL under Webhook Config.'],
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
      <p className="page-description max-w-3xl">Implementation reference for connecting your organization system to Fintap and the 1BILL invoice-payment flow.</p>
    </div>

    <div className="grid gap-4 lg:grid-cols-3">
      <Card><CardHeader><KeyRound className="h-5 w-5 text-primary" /><CardTitle className="text-base">Authentication</CardTitle><CardDescription>Send <code className="font-mono text-foreground">X-API-Key: YOUR_KEY</code> from server-side code only. Never expose the key in a browser or mobile bundle.</CardDescription></CardHeader></Card>
      <Card><CardHeader><LockKeyhole className="h-5 w-5 text-primary" /><CardTitle className="text-base">Transport security</CardTitle><CardDescription>Production calls require HTTPS. Configure approved source IPs and rotate credentials through Security settings.</CardDescription></CardHeader></Card>
      <Card><CardHeader><Network className="h-5 w-5 text-primary" /><CardTitle className="text-base">Base URL</CardTitle><CardDescription><code className="font-mono text-foreground">https://app.fintap.pk</code><br />Use the separately supplied sandbox host during certification; never send test traffic to production.</CardDescription></CardHeader></Card>
    </div>

    <Card>
      <CardHeader><CardTitle className="text-base">Required headers</CardTitle><CardDescription>These client-facing endpoints use your organization credential. Bank-facing 1LINK endpoints are operated only by Fintap and are intentionally not exposed here.</CardDescription></CardHeader>
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
