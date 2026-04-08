import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEteaSecurityStore } from '@/store/eteaSecurityStore';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useAuthStore } from '@/store/authStore';
import { EteaRequestSecurityContext } from '@/types';
import { Copy, Eye, EyeOff } from 'lucide-react';

const ETEASettings = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [keyVisible, setKeyVisible] = useState(false);

  const { user } = useAuthStore();

  const storedSourceIp = useEteaSecurityStore((state) => state.sourceIp);
  const setSourceIp = useEteaSecurityStore((state) => state.setSourceIp);

  const [securitySourceIp, setSecuritySourceIp] = useState(storedSourceIp);
  const [savingSecurityContext, setSavingSecurityContext] = useState(false);
  const { data: securityContextData } = useApiQuery(() => api.fetchSetting<EteaRequestSecurityContext>('etea_security_context'), []);

  useEffect(() => {
    const securityContext = securityContextData as EteaRequestSecurityContext | null;
    if (!securityContext) return;

    const nextSourceIp = securityContext.sourceIp || storedSourceIp;
    setSecuritySourceIp(nextSourceIp);
    setSourceIp(nextSourceIp);
  }, [securityContextData, setSourceIp, storedSourceIp]);

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('All password fields are required');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New password and confirm password do not match');
      return;
    }

    if (currentPassword === newPassword) {
      toast.error('New password must be different from current password');
      return;
    }

    try {
      await api.changePassword(currentPassword, newPassword);
      toast.success('Password updated successfully');
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update password');
    }
  };

  const handleSaveSecurityContext = async () => {
    if (!securitySourceIp.trim()) {
      toast.error('Source IP is required');
      return;
    }

    setSavingSecurityContext(true);
    try {
      const payload = {
        sourceIp: securitySourceIp.trim(),
      };
      await api.saveSetting('etea_security_context', payload);
      setSourceIp(payload.sourceIp);
      toast.success('API security context updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save security context');
    } finally {
      setSavingSecurityContext(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Settings</h1>
        <p className="page-description">Update your account password and ETEA payment security context.</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Update Password</CardTitle>
          <CardDescription>
            Use a strong password with at least 8 characters.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="rounded-lg"
              autoComplete="current-password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="rounded-lg"
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="rounded-lg"
              autoComplete="new-password"
            />
          </div>

          <Button className="rounded-lg" onClick={() => void handleUpdatePassword()}>
            Update Password
          </Button>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>API Key</CardTitle>
          <CardDescription>
            This key is issued by the platform for your organization. Provide it to external integrations (e.g. 1BILL) that need to call the ETEA payment API directly. Dashboard users authenticated via their account do not need to enter this key.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Your Organization API Key</Label>
            <div className="flex gap-2">
              <Input
                value={keyVisible ? (user?.tenantApiKey || 'Not available — contact platform admin') : '•'.repeat(32)}
                readOnly
                className="rounded-lg font-mono text-sm bg-muted/40"
              />
              <Button variant="outline" size="sm" onClick={() => setKeyVisible((v) => !v)}>
                {keyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!user?.tenantApiKey}
                onClick={() => {
                  void navigator.clipboard.writeText(user?.tenantApiKey || '');
                  toast.success('API key copied to clipboard');
                }}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">To regenerate this key, contact the platform administrator.</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
            <p>External integrations must include this key as the <code>X-API-Key</code> request header.</p>
            <p>Internal dashboard users authenticate via their login credentials — no key required.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>API Security Context</CardTitle>
          <CardDescription>
            Configure source IP for ETEA payment-controller calls. Protocol is fixed to HTTPS and callback flow enforces signature + idempotency controls.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="source-ip">Source IP (Whitelisted)</Label>
            <Input
              id="source-ip"
              value={securitySourceIp}
              onChange={(event) => setSecuritySourceIp(event.target.value)}
              className="rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="protocol">Protocol</Label>
            <Input id="protocol" value="https" readOnly className="rounded-lg bg-muted/40" />
          </div>

          <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
            <p>Security controls enabled:</p>
            <p>- API key authentication</p>
            <p>- Source IP whitelist</p>
            <p>- HTTPS-only transport</p>
            <p>- Webhook signature verification</p>
            <p>- Callback idempotency protection</p>
          </div>

          <Button className="rounded-lg" onClick={() => void handleSaveSecurityContext()} disabled={savingSecurityContext}>
            Save Security Context
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ETEASettings;
