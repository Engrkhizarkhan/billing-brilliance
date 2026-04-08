import { useState, useCallback } from 'react';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Terminal, Send, RefreshCw, Copy, CheckCheck } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

const todayYYYYMMDD = () => {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
};

const nowHHMMSS = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
};

/** PKR float → AN12 (no sign, last 2 = paise). e.g. 120 → "000000012000" */
const toAN12 = (pkr: number) =>
  String(Math.round(Math.abs(pkr) * 100)).padStart(12, '0');

/** AN12 → PKR float. e.g. "000000012000" → 120.00 */
const fromAN12 = (s: string) => (parseInt(s.replace(/^[+-]/, ''), 10) / 100).toFixed(2);

/** AN14 inquiry amount → PKR. e.g. "+0000000186900" → 1869.00 */
const fromAN14 = (s: string) => (parseInt(s.replace(/^[+-]/, ''), 10) / 100).toFixed(2);

const fmt = (v: unknown) => JSON.stringify(v, null, 2);

const StatusBadge = ({ code }: { code?: string }) => {
  if (!code) return null;
  const color =
    code === '00' ? 'bg-green-500/10 text-green-600 border-green-400/30' :
    code === '03' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-400/30' :
    'bg-red-500/10 text-red-600 border-red-400/30';
  const labels: Record<string, string> = {
    '00': 'Success',
    '01': 'Not Found',
    '02': 'Unknown Error',
    '03': 'Duplicate',
    '04': 'Invalid Data',
    '05': 'Processing Failed',
    '06': 'Already Paid',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono font-semibold ${color}`}>
      {code} — {labels[code] ?? 'Unknown'}
    </span>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const OneLinkSandbox = () => {
  // ── Shared credentials ───────────────────────────────────────────────────
  const [username, setUsername] = useState('demo-user');
  const [password, setPassword] = useState('demo-pass');
  const [bankMnemonic, setBankMnemonic] = useState('MBLINK01');

  // ── BillInquiry ──────────────────────────────────────────────────────────
  const [inqConsumer, setInqConsumer] = useState('');
  const [inqReserved, setInqReserved] = useState('');
  const [inqLoading, setInqLoading] = useState(false);
  const [inqReq, setInqReq] = useState('');
  const [inqRes, setInqRes] = useState('');
  const [inqCode, setInqCode] = useState<string | undefined>();

  // ── BillPayment ──────────────────────────────────────────────────────────
  const [payConsumer, setPayConsumer] = useState('');
  const [payTranAuthId, setPayTranAuthId] = useState(() => String(Math.floor(100000 + Math.random() * 900000)));
  const [payAmountPkr, setPayAmountPkr] = useState('100.00');
  const [payTranDate, setPayTranDate] = useState(todayYYYYMMDD);
  const [payTranTime, setPayTranTime] = useState(nowHHMMSS);
  const [payLoading, setPayLoading] = useState(false);
  const [payReq, setPayReq] = useState('');
  const [payRes, setPayRes] = useState('');
  const [payCode, setPayCode] = useState<string | undefined>();

  // Copy button
  const [copied, setCopied] = useState<string | null>(null);
  const copyText = (text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  // Auto-populate consumer number from first student
  const { data: studentsData } = useApiQuery(() => api.fetchStudents({ pageSize: 1 }), []);
  const sampleConsumer = ((studentsData as Array<{ consumerNumber?: string }>) || [])[0]?.consumerNumber || '';
  if (sampleConsumer && !inqConsumer) setInqConsumer(sampleConsumer);

  // ── Run BillInquiry ──────────────────────────────────────────────────────
  const runInquiry = useCallback(async () => {
    const consumer = inqConsumer.trim();
    if (!consumer) { toast.error('Consumer number is required'); return; }

    const body = {
      consumer_number: consumer,
      bank_mnemonic: bankMnemonic.trim() || 'MBLINK01',
      ...(inqReserved.trim() ? { reserved: inqReserved.trim() } : {}),
    };
    setInqReq(fmt(body));
    setInqRes('');
    setInqCode(undefined);
    setInqLoading(true);

    try {
      const res = await fetch('/api/1.0/Payments/BillInquiry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          username: username.trim(),
          password: password.trim(),
        },
        body: JSON.stringify(body),
      });
      const data: unknown = await res.json();
      setInqRes(fmt(data));
      const code = (data as Record<string, string>)?.response_Code;
      setInqCode(code);
      if (code === '00') {
        toast.success('Inquiry OK');
        // Sync consumer to payment panel
        setPayConsumer(consumer);
        // Pre-fill amount from response amount_after_dueDate
        const rawAmt = (data as Record<string, string>)?.amount_after_dueDate;
        if (rawAmt) {
          const pkr = parseFloat(fromAN14(rawAmt));
          if (pkr > 0) setPayAmountPkr(pkr.toFixed(2));
        }
      } else {
        toast.error(`Inquiry returned code ${code}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setInqRes(`Error: ${msg}`);
      toast.error(msg);
    } finally {
      setInqLoading(false);
    }
  }, [inqConsumer, inqReserved, bankMnemonic, username, password]);

  // ── Run BillPayment ──────────────────────────────────────────────────────
  const runPayment = useCallback(async () => {
    const consumer = payConsumer.trim();
    if (!consumer) { toast.error('Consumer number is required'); return; }
    const authId = payTranAuthId.trim();
    if (!authId) { toast.error('tran_auth_id is required'); return; }
    const amtPkr = parseFloat(payAmountPkr);
    if (isNaN(amtPkr) || amtPkr <= 0) { toast.error('Amount must be > 0'); return; }
    if (!payTranDate.match(/^\d{8}$/)) { toast.error('tran_date must be YYYYMMDD'); return; }
    if (!payTranTime.match(/^\d{6}$/)) { toast.error('tran_time must be HHMMSS'); return; }

    const body = {
      consumer_number: consumer,
      tran_auth_id: authId,
      transaction_amount: toAN12(amtPkr),
      tran_date: payTranDate,
      tran_time: payTranTime,
      bank_mnemonic: bankMnemonic.trim() || 'MBLINK01',
    };
    setPayReq(fmt(body));
    setPayRes('');
    setPayCode(undefined);
    setPayLoading(true);

    try {
      const res = await fetch('/api/1.0/Payments/BillPayment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          username: username.trim(),
          password: password.trim(),
        },
        body: JSON.stringify(body),
      });
      const data: unknown = await res.json();
      setPayRes(fmt(data));
      const code = (data as Record<string, string>)?.response_Code;
      setPayCode(code);
      if (code === '00') {
        toast.success('Payment posted successfully');
        // Rotate tran_auth_id + time for next test
        setPayTranAuthId(String(Math.floor(100000 + Math.random() * 900000)));
        setPayTranTime(nowHHMMSS());
      } else {
        toast.error(`Payment returned code ${code}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setPayRes(`Error: ${msg}`);
      toast.error(msg);
    } finally {
      setPayLoading(false);
    }
  }, [payConsumer, payTranAuthId, payAmountPkr, payTranDate, payTranTime, bankMnemonic, username, password]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">1LINK Gateway Sandbox</h1>
        <p className="page-description">
          Simulate exactly what the 1BILL gateway sends to <span className="font-mono text-xs">POST /api/1.0/Payments/BillInquiry</span> and <span className="font-mono text-xs">BillPayment</span>
        </p>
      </div>

      {/* Credentials */}
      <Card className="max-w-3xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Terminal className="w-4 h-4" /> Gateway Credentials (HTTP headers)
          </CardTitle>
          <CardDescription className="text-xs">
            These match <span className="font-mono">ONELINK_USERNAME</span> / <span className="font-mono">ONELINK_PASSWORD</span> in your server <span className="font-mono">.env</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">username header</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} className="font-mono text-xs rounded-lg" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">password header</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="font-mono text-xs rounded-lg"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">bank_mnemonic</Label>
              <Input value={bankMnemonic} onChange={(e) => setBankMnemonic(e.target.value)} className="font-mono text-xs rounded-lg" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two panels */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* ── BillInquiry ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">BillInquiry</CardTitle>
              <Badge variant="outline" className="font-mono text-xs">POST /api/1.0/Payments/BillInquiry</Badge>
            </div>
            <CardDescription className="text-xs">
              Returns consumer name, bill status (U/P/B), outstanding amount in AN14 format
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">consumer_number</Label>
                <Input
                  value={inqConsumer}
                  onChange={(e) => setInqConsumer(e.target.value)}
                  placeholder="e.g. 123456100100000000000001"
                  className="font-mono text-xs rounded-lg"
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">reserved <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  value={inqReserved}
                  onChange={(e) => setInqReserved(e.target.value)}
                  placeholder="CNIC(13)+accountId(28)+..."
                  className="font-mono text-xs rounded-lg"
                />
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => void runInquiry()}
              disabled={inqLoading}
              className="rounded-lg gap-2"
            >
              <Send className="w-3 h-3" />
              {inqLoading ? 'Running…' : 'Run BillInquiry'}
            </Button>

            <Separator />

            {/* Request preview */}
            {inqReq && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Request body sent</Label>
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    onClick={() => copyText(inqReq, 'inq-req')}
                  >
                    {copied === 'inq-req' ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    copy
                  </button>
                </div>
                <Textarea value={inqReq} readOnly rows={4} className="font-mono text-xs bg-muted/30 rounded-lg" />
              </div>
            )}

            {/* Response */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Response</Label>
                  {inqCode !== undefined && <StatusBadge code={inqCode} />}
                </div>
                {inqRes && (
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    onClick={() => copyText(inqRes, 'inq-res')}
                  >
                    {copied === 'inq-res' ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    copy
                  </button>
                )}
              </div>
              <Textarea
                value={inqRes}
                readOnly
                rows={12}
                className="font-mono text-xs bg-muted/30 rounded-lg"
                placeholder="Response will appear here…"
              />
            </div>

            {/* Decoded amounts hint */}
            {inqRes && inqCode === '00' && (() => {
              try {
                const parsed = JSON.parse(inqRes) as Record<string, string>;
                const within = parsed.amount_within_dueDate;
                const after = parsed.amount_after_dueDate;
                if (!within && !after) return null;
                return (
                  <div className="rounded-lg border bg-muted/20 p-2 text-xs text-muted-foreground space-y-0.5">
                    {within && <p>amount_within_dueDate → <span className="font-semibold text-foreground">PKR {fromAN14(within)}</span></p>}
                    {after  && <p>amount_after_dueDate  → <span className="font-semibold text-foreground">PKR {fromAN14(after)}</span></p>}
                    <p>bill_status: <span className="font-semibold text-foreground">{parsed.bill_status}</span>
                      {parsed.bill_status === 'U' ? '  (Unpaid)' : parsed.bill_status === 'P' ? '  (Paid)' : ''}
                    </p>
                  </div>
                );
              } catch { return null; }
            })()}
          </CardContent>
        </Card>

        {/* ── BillPayment ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">BillPayment</CardTitle>
              <Badge variant="outline" className="font-mono text-xs">POST /api/1.0/Payments/BillPayment</Badge>
            </div>
            <CardDescription className="text-xs">
              Amounts are AN12: last 2 digits = paise. e.g. PKR 120.00 → <span className="font-mono">000000012000</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">consumer_number</Label>
                <div className="flex gap-2">
                  <Input
                    value={payConsumer}
                    onChange={(e) => setPayConsumer(e.target.value)}
                    placeholder="e.g. 123456100100000000000001"
                    className="font-mono text-xs rounded-lg"
                  />
                  {inqConsumer && payConsumer !== inqConsumer && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 rounded-lg text-xs"
                      onClick={() => setPayConsumer(inqConsumer)}
                    >
                      Sync from inquiry
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">tran_auth_id <span className="text-muted-foreground">(6 digits)</span></Label>
                <div className="flex gap-2">
                  <Input
                    value={payTranAuthId}
                    onChange={(e) => setPayTranAuthId(e.target.value)}
                    className="font-mono text-xs rounded-lg"
                    maxLength={6}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 rounded-lg h-9 w-9"
                    title="Generate random ID"
                    onClick={() => setPayTranAuthId(String(Math.floor(100000 + Math.random() * 900000)))}
                  >
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">
                  Amount (PKR) → <span className="font-mono">{toAN12(parseFloat(payAmountPkr) || 0)}</span>
                </Label>
                <Input
                  value={payAmountPkr}
                  onChange={(e) => setPayAmountPkr(e.target.value)}
                  placeholder="e.g. 1500.00"
                  className="font-mono text-xs rounded-lg"
                  type="number"
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">tran_date <span className="text-muted-foreground">(YYYYMMDD)</span></Label>
                <div className="flex gap-2">
                  <Input
                    value={payTranDate}
                    onChange={(e) => setPayTranDate(e.target.value)}
                    className="font-mono text-xs rounded-lg"
                    maxLength={8}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 rounded-lg h-9 w-9"
                    title="Set to today"
                    onClick={() => setPayTranDate(todayYYYYMMDD())}
                  >
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">tran_time <span className="text-muted-foreground">(HHMMSS)</span></Label>
                <div className="flex gap-2">
                  <Input
                    value={payTranTime}
                    onChange={(e) => setPayTranTime(e.target.value)}
                    className="font-mono text-xs rounded-lg"
                    maxLength={6}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 rounded-lg h-9 w-9"
                    title="Set to now"
                    onClick={() => setPayTranTime(nowHHMMSS())}
                  >
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Duplicate warning */}
            <div className="rounded-lg border border-yellow-400/30 bg-yellow-500/5 p-2 text-xs text-muted-foreground">
              Duplicate key: <span className="font-mono">{`${payConsumer || '…'}:${payTranAuthId}:${payTranDate}:${payTranTime}`}</span>
              <br />Re-submitting the same combination returns <span className="font-mono">response_Code: 03</span>
            </div>

            <Button
              size="sm"
              onClick={() => void runPayment()}
              disabled={payLoading}
              className="rounded-lg gap-2"
            >
              <Send className="w-3 h-3" />
              {payLoading ? 'Posting…' : 'Run BillPayment'}
            </Button>

            <Separator />

            {/* Request preview */}
            {payReq && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Request body sent</Label>
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    onClick={() => copyText(payReq, 'pay-req')}
                  >
                    {copied === 'pay-req' ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    copy
                  </button>
                </div>
                <Textarea value={payReq} readOnly rows={5} className="font-mono text-xs bg-muted/30 rounded-lg" />
              </div>
            )}

            {/* Response */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Response</Label>
                  {payCode !== undefined && <StatusBadge code={payCode} />}
                </div>
                {payRes && (
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    onClick={() => copyText(payRes, 'pay-res')}
                  >
                    {copied === 'pay-res' ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    copy
                  </button>
                )}
              </div>
              <Textarea
                value={payRes}
                readOnly
                rows={6}
                className="font-mono text-xs bg-muted/30 rounded-lg"
                placeholder="Response will appear here…"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reference table */}
      <Card className="max-w-3xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Response Code Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
            {[
              ['00', 'Success'],
              ['01', 'Consumer number not found'],
              ['02', 'Unknown error / bad transaction'],
              ['03', 'Duplicate transaction'],
              ['04', 'Invalid data (credentials, mnemonic, etc.)'],
              ['05', 'Processing failed'],
              ['06', 'Bill already paid'],
            ].map(([code, desc]) => (
              <div key={code} className="flex items-baseline gap-2 py-0.5">
                <span className="font-mono font-semibold text-foreground w-5 shrink-0">{code}</span>
                <span className="text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OneLinkSandbox;
