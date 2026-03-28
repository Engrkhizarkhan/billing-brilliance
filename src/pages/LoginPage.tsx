import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Lock, Mail, Building2, GraduationCap, Briefcase, Shield, ArrowRight } from 'lucide-react';

const roles: { value: UserRole; label: string; desc: string; icon: React.ElementType; email: string }[] = [
  { value: 'admin', label: 'Admin', desc: 'Platform management', icon: Shield, email: 'admin@example.com' },
  { value: 'school', label: 'School', desc: 'Fee & student management', icon: GraduationCap, email: 'school@example.com' },
  { value: 'eta', label: 'Agency', desc: 'Service & applicant management', icon: Briefcase, email: 'eta@example.com' },
];

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('admin');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const success = await login(email, password, role);
    setLoading(false);
    if (success) {
      toast.success('Signed in successfully');
      navigate(`/${role}`);
    } else {
      toast.error('Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left - Branding */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] bg-sidebar text-sidebar-foreground flex-col justify-between p-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Building2 className="w-4 h-4 text-sidebar-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight">FinBill</span>
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight leading-tight">
            Billing infrastructure<br />
            <span className="text-sidebar-primary">built for scale.</span>
          </h1>
          <p className="mt-4 text-sidebar-foreground/60 text-sm leading-relaxed max-w-sm">
            Manage billers, automate fee collection, track payments, and generate reports — all from one platform.
          </p>
        </div>
        <p className="text-[11px] text-sidebar-muted">© 2025 FinBill. All rights reserved.</p>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[380px] animate-fade-in">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">FinBill</span>
          </div>

          <h2 className="text-xl font-bold tracking-tight">Sign in to your account</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-6">Select your role and enter credentials</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-3 gap-2">
              {roles.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => { setRole(r.value); setEmail(r.email); }}
                  className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all text-center ${
                    role === r.value
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border hover:border-primary/30'
                  }`}
                >
                  <r.icon className={`w-4 h-4 ${role === r.value ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={`text-xs font-medium ${role === r.value ? 'text-primary' : 'text-foreground'}`}>{r.label}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">{r.desc}</span>
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="pl-9 h-9 text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="pl-9 h-9 text-sm"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-9 text-sm font-medium" disabled={loading}>
              {loading ? 'Signing in…' : (
                <>Sign in <ArrowRight className="w-3.5 h-3.5 ml-1.5" /></>
              )}
            </Button>

            <div className="rounded-md bg-muted/60 border border-border p-3">
              <p className="text-[11px] font-medium text-foreground mb-1">Demo credentials</p>
              <p className="text-[11px] text-muted-foreground font-mono">admin@ / school@ / eta@example.com</p>
              <p className="text-[11px] text-muted-foreground font-mono">Password: 123456</p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
