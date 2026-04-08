import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { billInquiry, billPayment, fetchBundle, onebillConfig } from '@/services/onebillService';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { toast } from 'sonner';
import { Shield, Activity, Wifi } from 'lucide-react';

const format = (data: unknown) => JSON.stringify(data, null, 2);

const ApiHealth = () => {
  const [inquiryResult, setInquiryResult] = useState('');
  const [paymentResult, setPaymentResult] = useState('');
  const [bundleResult, setBundleResult] = useState('');
  const [consumerNumber, setConsumerNumber] = useState('');
  const [pcid, setPcid] = useState('MBLINK01');
  const [loading, setLoading] = useState<string>('');

  const { data: studentsData } = useApiQuery(() => api.fetchStudents({ pageSize: 1 }), []);
  const sampleConsumer = ((studentsData as Array<{ consumerNumber?: string }>) || [])[0]?.consumerNumber || '1234561001000000000001';

  useEffect(() => {
    if (!consumerNumber) {
      setConsumerNumber(sampleConsumer);
    }
  }, [sampleConsumer, consumerNumber]);

  const runInquiry = async () => {
    setLoading('inquiry');
    try {
      const result = await billInquiry({ consumerNumber: consumerNumber.trim() || sampleConsumer });
      setInquiryResult(format(result));
      toast.success('Inquiry ok');
    } catch (error) {
      console.error(error);
      toast.error('Inquiry failed');
    } finally {
      setLoading('');
    }
  };

  const runPayment = async () => {
    setLoading('payment');
    try {
      const result = await billPayment({
        consumerNumber: consumerNumber.trim() || sampleConsumer,
        amount: 15000,
        transactionId: `TXN-${Date.now()}`,
        paidAt: new Date().toISOString(),
        channel: 'bank_app',
      });
      setPaymentResult(format(result));
      toast.success('Payment ok');
    } catch (error) {
      console.error(error);
      toast.error('Payment failed');
    } finally {
      setLoading('');
    }
  };

  const runBundle = async () => {
    setLoading('bundle');
    try {
      const result = await fetchBundle(pcid.trim() || 'MBLINK01');
      setBundleResult(format(result));
      toast.success('FetchBundle ok');
    } catch (error) {
      console.error(error);
      toast.error('FetchBundle failed');
    } finally {
      setLoading('');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">API Health & Testing</h1>
          <p className="page-description">Admin-only sandbox for BillInquiry, BillPayment, FetchBundle</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Shield className="w-4 h-4" /> {onebillConfig.useMock ? 'Mock mode' : 'Live mode'} • {onebillConfig.baseUrl}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4" /> BillInquiry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={consumerNumber} onChange={(e) => setConsumerNumber(e.target.value)} placeholder="Enter consumer number" className="font-mono text-xs" />
            <Button size="sm" onClick={runInquiry} disabled={loading === 'inquiry'} className="rounded-lg">{loading === 'inquiry' ? 'Running…' : 'Run Inquiry'}</Button>
            <Textarea value={inquiryResult} readOnly rows={8} className="font-mono text-xs" placeholder="Inquiry response" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Wifi className="w-4 h-4" /> BillPayment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Posts a payment using the consumer number above</p>
            <Button size="sm" onClick={runPayment} disabled={loading === 'payment'} className="rounded-lg">{loading === 'payment' ? 'Posting…' : 'Run Payment'}</Button>
            <Textarea value={paymentResult} readOnly rows={8} className="font-mono text-xs" placeholder="Payment response" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4" /> FetchBundle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={pcid} onChange={(e) => setPcid(e.target.value)} placeholder="PCID (e.g. MBLINK01)" className="font-mono text-xs" />
            <p className="text-xs text-muted-foreground">Returns 1LINK FetchBundle format: companyId, responseCode, billerName, bundleDetails</p>
            <Button size="sm" onClick={runBundle} disabled={loading === 'bundle'} className="rounded-lg">{loading === 'bundle' ? 'Fetching…' : 'Run FetchBundle'}</Button>
            <Textarea value={bundleResult} readOnly rows={8} className="font-mono text-xs" placeholder="Bundle response" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ApiHealth;
