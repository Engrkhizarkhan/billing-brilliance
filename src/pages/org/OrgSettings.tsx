import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Eye, EyeOff, KeyRound, Plus, ShieldCheck, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOrgSecurityStore } from '@/store/orgSecurityStore';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuthStore } from '@/store/authStore';
import { OrgRequestSecurityContext } from '@/types';

const isValidIp = (value: string) => {
  const ipv4 = /^(\d{1,3})(?:\.(\d{1,3})){3}$/.test(value);
  if (ipv4) return value.split('.').every((part) => Number(part) <= 255);
  return /^[0-9a-f:]+$/i.test(value) && value.includes(':');
};

const OrgSettings = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [keyVisible, setKeyVisible] = useState(false);
  const { user } = useAuthStore();
  const storedSourceIp = useOrgSecurityStore((state) => state.sourceIp);
  const setSourceIp = useOrgSecurityStore((state) => state.setSourceIp);
  const [ipList, setIpList] = useState<string[]>(storedSourceIp ? storedSourceIp.split(',').filter(Boolean) : []);
  const [ipInput, setIpInput] = useState('');
  const [savingSecurityContext, setSavingSecurityContext] = useState(false);
  const { data: securityContextData } = useApiQuery(() => api.fetchSetting<OrgRequestSecurityContext>('org_security_context'), []);

  useEffect(() => {
    const securityContext = securityContextData as OrgRequestSecurityContext | null;
    if (!securityContext?.sourceIp) return;
    const next = securityContext.sourceIp.split(',').map((item) => item.trim()).filter(Boolean);
    setIpList(next);
    setSourceIp(next.join(','));
  }, [securityContextData, setSourceIp]);

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) return toast.error('All password fields are required');
    if (newPassword.length < 12) return toast.error('New password must be at least 12 characters');
    if (newPassword !== confirmPassword) return toast.error('New password and confirmation do not match');
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      toast.success('Password updated. Other sessions have been revoked.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update password');
    }
  };

  const addIp = () => {
    const value = ipInput.trim();
    if (!isValidIp(value)) return toast.error('Enter a valid IPv4 or IPv6 address');
    if (ipList.includes(value)) return toast.error('IP address is already allowlisted');
    setIpList((current) => [...current, value]);
    setIpInput('');
  };

  const saveSecurityContext = async () => {
    if (ipList.length === 0) return toast.error('Add at least one production source IP');
    setSavingSecurityContext(true);
    try {
      const sourceIp = ipList.join(',');
      await api.saveSetting('org_security_context', { sourceIp });
      setSourceIp(sourceIp);
      toast.success('API source IP allowlist saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save source IPs');
    } finally {
      setSavingSecurityContext(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div><h1 className="page-header">Integration Security</h1><p className="page-description">Manage the credentials and network controls used by your API integration.</p></div>

      <Card className="max-w-3xl">
        <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Organization API key</CardTitle><CardDescription>Use this key only from your backend. Never embed it in a website, mobile app, source repository, email, or support ticket.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input value={keyVisible ? (user?.tenantApiKey || 'Not available - contact the platform administrator') : '•'.repeat(32)} readOnly className="font-mono" />
            <Button variant="outline" size="icon" aria-label={keyVisible ? 'Hide API key' : 'Reveal API key'} onClick={() => setKeyVisible((value) => !value)}>{keyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
            <Button variant="outline" size="icon" aria-label="Copy API key" disabled={!user?.tenantApiKey} onClick={() => { void navigator.clipboard.writeText(user?.tenantApiKey || ''); toast.success('API key copied'); }}><Copy className="h-4 w-4" /></Button>
          </div>
          <p className="text-xs text-muted-foreground">Key rotation is restricted to platform administrators and requires typed confirmation.</p>
        </CardContent>
      </Card>

      <Card className="max-w-3xl">
        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Source IP allowlist</CardTitle><CardDescription>Only requests from these public egress IP addresses can use your organization API key.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex min-h-11 flex-wrap gap-2 rounded-lg border p-2">
            {ipList.length === 0 && <span className="p-1 text-xs text-destructive">No source IPs configured</span>}
            {ipList.map((ip) => <span key={ip} className="flex items-center gap-1 rounded border bg-muted px-2 py-1 font-mono text-xs">{ip}<button type="button" aria-label={`Remove ${ip}`} onClick={() => setIpList((current) => current.filter((item) => item !== ip))}><X className="h-3 w-3" /></button></span>)}
          </div>
          <div className="flex gap-2"><Input value={ipInput} onChange={(event) => setIpInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addIp(); } }} placeholder="203.0.113.10" className="font-mono" /><Button type="button" variant="outline" onClick={addIp}><Plus className="h-4 w-4" /></Button></div>
          <Button onClick={() => void saveSecurityContext()} disabled={savingSecurityContext}>{savingSecurityContext ? 'Saving…' : 'Save allowlist'}</Button>
        </CardContent>
      </Card>

      <Card className="max-w-3xl">
        <CardHeader><CardTitle>Account password</CardTitle><CardDescription>Use at least 12 characters. Changing it revokes all refresh tokens for this account.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div><Label htmlFor="current-password">Current password</Label><Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></div>
          <div><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></div>
          <div><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></div>
          <Button onClick={() => void handleUpdatePassword()}>Update password</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrgSettings;
