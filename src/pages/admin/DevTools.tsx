import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { Biller } from '@/types';

// ---------------------------------------------------------------------------
// Tab 1: Hash Verifier
// ---------------------------------------------------------------------------
const HashVerifier = () => {
  const [hash, setHash] = useState('');
  const [plaintext, setPlaintext] = useState('');
  const [result, setResult] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async () => {
    setError('');
    setResult(null);
    if (!hash.trim() || !plaintext) {
      setError('Both fields are required.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.verifyHash(hash.trim(), plaintext);
      if (res.data !== undefined) {
        setResult(res.data.match);
      } else {
        setError((res as { error?: string }).error || 'Verification failed');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Bcrypt Hash Verifier</CardTitle>
        <CardDescription>
          Paste a bcrypt hash from the database and a plaintext string to verify they match.
          Bcrypt is one-way — this tool uses <code>bcrypt.compare()</code>, not decryption.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="hash-input">Bcrypt Hash (from DB)</Label>
          <Textarea
            id="hash-input"
            placeholder="$2b$12$..."
            className="font-mono text-xs"
            rows={3}
            value={hash}
            onChange={(e) => { setHash(e.target.value); setResult(null); }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="plain-input">Plaintext</Label>
          <Input
            id="plain-input"
            type="password"
            placeholder="Password or value to test"
            value={plaintext}
            onChange={(e) => { setPlaintext(e.target.value); setResult(null); }}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {result !== null && (
          <div className={`flex items-center gap-2 text-sm font-medium ${result ? 'text-green-600' : 'text-destructive'}`}>
            {result ? (
              <><CheckCircle2 className="w-4 h-4" /> Match — plaintext matches the hash</>
            ) : (
              <><XCircle className="w-4 h-4" /> No match — plaintext does not match</>
            )}
          </div>
        )}

        <Button onClick={handleVerify} disabled={loading} className="w-full sm:w-auto">
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying…</> : 'Verify Hash'}
        </Button>
      </CardContent>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// Tab 2: JWT Inspector  (purely client-side — no API call)
// ---------------------------------------------------------------------------
const JwtInspector = () => {
  const [token, setToken] = useState('');
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [decodeError, setDecodeError] = useState('');

  const decode = () => {
    setPayload(null);
    setDecodeError('');
    try {
      const parts = token.trim().split('.');
      if (parts.length !== 3) throw new Error('Not a valid JWT (expected 3 parts)');
      const raw = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = raw + '='.repeat((4 - (raw.length % 4)) % 4);
      const json = atob(padded);
      setPayload(JSON.parse(json));
    } catch (e) {
      setDecodeError(e instanceof Error ? e.message : 'Failed to decode token');
    }
  };

  const now = Math.floor(Date.now() / 1000);
  const exp = payload?.exp as number | undefined;
  const isExpired = exp !== undefined && exp < now;
  const expiresIn = exp !== undefined && !isExpired ? Math.round((exp - now) / 60) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">JWT Inspector</CardTitle>
        <CardDescription>Paste any JWT to inspect its decoded payload. Decoding happens entirely in your browser — nothing is sent to the server.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="jwt-input">JWT Token</Label>
          <Textarea
            id="jwt-input"
            placeholder="eyJhbGciOi..."
            className="font-mono text-xs"
            rows={4}
            value={token}
            onChange={(e) => { setToken(e.target.value); setPayload(null); setDecodeError(''); }}
          />
        </div>

        {decodeError && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {decodeError}
          </div>
        )}

        <Button onClick={decode} className="w-full sm:w-auto">Inspect Token</Button>

        {payload && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              {isExpired ? (
                <Badge variant="destructive">Expired</Badge>
              ) : (
                <Badge className="bg-green-600 text-white">Valid</Badge>
              )}
              {exp && (
                <span className="text-xs text-muted-foreground">
                  {isExpired
                    ? `Expired ${Math.round((now - exp) / 60)} min ago`
                    : `Expires in ~${expiresIn} min`}
                </span>
              )}
              {payload.impersonated && (
                <Badge className="bg-orange-500 text-white">Impersonation Token</Badge>
              )}
            </div>
            <div className="rounded-lg border bg-muted/40 p-4 overflow-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(payload, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// Tab 3: Tenant Secrets
// ---------------------------------------------------------------------------
const TenantSecrets = () => {
  const { data: billers, loading, error } = useApiQuery(() => api.fetchBillers({ pageSize: 100 }));
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) return <div className="py-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading tenants…</div>;
  if (error) return <div className="py-8 text-center text-sm text-destructive">{error}</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tenant API Keys</CardTitle>
        <CardDescription>API keys for all registered tenants. Click the eye icon to reveal a key.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="table-container">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Tenant</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">API Key</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(billers as Biller[])?.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="text-sm font-medium">{b.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground capitalize">{b.type}</TableCell>
                  <TableCell className="text-xs capitalize">{b.status}</TableCell>
                  <TableCell className="font-mono text-xs max-w-xs">
                    {revealed.has(b.id)
                      ? (b.apiKey || <span className="text-muted-foreground italic">not set</span>)
                      : '••••••••••••••••••••••••'}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggle(b.id)}>
                      {revealed.has(b.id)
                        ? <EyeOff className="w-3.5 h-3.5" />
                        : <Eye className="w-3.5 h-3.5" />}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
const DevTools = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-xl font-bold tracking-tight">Developer Tools</h1>
      <p className="text-sm text-muted-foreground mt-1">Admin-only maintenance and debugging utilities.</p>
    </div>

    <Tabs defaultValue="hash" className="space-y-4">
      <TabsList>
        <TabsTrigger value="hash">Hash Verifier</TabsTrigger>
        <TabsTrigger value="jwt">JWT Inspector</TabsTrigger>
        <TabsTrigger value="secrets">Tenant Secrets</TabsTrigger>
      </TabsList>
      <TabsContent value="hash"><HashVerifier /></TabsContent>
      <TabsContent value="jwt"><JwtInspector /></TabsContent>
      <TabsContent value="secrets"><TenantSecrets /></TabsContent>
    </Tabs>
  </div>
);

export default DevTools;
