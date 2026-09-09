import { ExternalLink, FlaskConical, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const sandboxUrl = import.meta.env.VITE_SANDBOX_BASE_URL as string | undefined;

const OrgSandbox = () => (
  <div className="space-y-6 animate-fade-in">
    <div><div className="flex items-center gap-2 mb-2"><FlaskConical className="w-5 h-5 text-primary" /><Badge variant="secondary">Isolated environment</Badge></div><h1 className="page-header">API Sandbox</h1><p className="page-description">Test integrations with synthetic data without touching production payments, credentials, or 1LINK connectivity.</p></div>
    <Card className="border-emerald-300/60"><CardHeader><ShieldCheck className="w-6 h-6 text-emerald-600" /><CardTitle>Production isolation</CardTitle><CardDescription>The sandbox runs as a separate API process with its own MySQL database, keys, logs, certificate, and hostname. It has no route to the production 1LINK VPN or settlement services.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 md:grid-cols-3 text-sm"><div className="rounded-lg border p-3"><p className="font-medium">Disposable data</p><p className="text-muted-foreground mt-1">Synthetic consumers and invoices may be reset.</p></div><div className="rounded-lg border p-3"><p className="font-medium">Separate credentials</p><p className="text-muted-foreground mt-1">Production keys are rejected by sandbox.</p></div><div className="rounded-lg border p-3"><p className="font-medium">No real collections</p><p className="text-muted-foreground mt-1">Payment simulations never reach 1LINK.</p></div></div>{sandboxUrl ? <Button asChild><a href={sandboxUrl} target="_blank" rel="noreferrer">Open sandbox <ExternalLink className="w-4 h-4 ml-2" /></a></Button> : <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">Sandbox deployment is not configured for this frontend. Set <code>VITE_SANDBOX_BASE_URL</code> to the separately deployed sandbox hostname.</div>}</CardContent></Card>
  </div>
);

export default OrgSandbox;
