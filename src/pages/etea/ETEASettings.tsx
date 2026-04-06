import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEteaSecurityStore } from '@/store/eteaSecurityStore';

const ETEASettings = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const storedApiKey = useEteaSecurityStore((state) => state.apiKey);
  const storedSourceIp = useEteaSecurityStore((state) => state.sourceIp);
  const setApiKey = useEteaSecurityStore((state) => state.setApiKey);
  const setSourceIp = useEteaSecurityStore((state) => state.setSourceIp);

  const [securityApiKey, setSecurityApiKey] = useState(storedApiKey);
  const [securitySourceIp, setSecuritySourceIp] = useState(storedSourceIp);

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleUpdatePassword = () => {
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

    toast.success('Password updated successfully (mock)');
    resetForm();
  };

  const handleSaveSecurityContext = () => {
    if (!securityApiKey.trim()) {
      toast.error('API key is required');
      return;
    }

    if (!securitySourceIp.trim()) {
      toast.error('Source IP is required');
      return;
    }

    setApiKey(securityApiKey);
    setSourceIp(securitySourceIp);
    toast.success('API Security Context updated');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Settings</h1>
        <p className="page-description">Update your account password.</p>
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

          <Button className="rounded-lg" onClick={handleUpdatePassword}>
            Update Password
          </Button>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>API Security Context</CardTitle>
          <CardDescription>
            Configure API key and source IP for ETEA payment-controller calls. Protocol is fixed to HTTPS and callback flow enforces signature + idempotency controls.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              value={securityApiKey}
              onChange={(event) => setSecurityApiKey(event.target.value)}
              className="rounded-lg"
            />
          </div>

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

          <Button className="rounded-lg" onClick={handleSaveSecurityContext}>
            Save Security Context
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ETEASettings;
