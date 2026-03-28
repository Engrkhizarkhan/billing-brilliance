import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Lock, Mail, Building2, GraduationCap, Briefcase, Shield, ArrowRight, CheckCircle2 } from 'lucide-react';

const roles: { value: UserRole; label: string; desc: string; icon: React.ElementType; email: string }[] = [
  { value: 'admin', label: 'Admin', desc: 'Platform management', icon: Shield, email: 'admin@example.com' },
  { value: 'school', label: 'School', desc: 'Fee & student management', icon: GraduationCap, email: 'school@example.com' },
  { value: 'eta', label: 'Agency', desc: 'Service & applicant management', icon: Briefcase, email: 'eta@example.com' },
];

const features = [
  'Multi-biller management with real-time reconciliation',
  'Automated recurring billing & invoice generation',
  'Class-level payment plan assignment',
  'Enterprise-grade transaction monitoring',
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
      {/* Left — Branding panel */}
      <div className="hidden lg:flex lg:w-[520px] xl:w-[580px] bg-sidebar text-sidebar-foreground flex-col justify-between p-12 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
          backgroundSize: '32px 32px',
        }} />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-xl shadow-primary/30">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl tracking-tight">FinBill</span>
          </div>
        </div>

        <div className="relative space-y-8">
          <div>
            <h1 className="text-4xl font-bold tracking-tight leading-[1.1]">
              Billing infrastructure
              <br />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                built for scale.
              </span>
            </h1>
            <p className="mt-5 text-sidebar-foreground/50 text-[15px] leading-relaxed max-w-md">
              End-to-end payment orchestration for educational institutions and government agencies. Process thousands of transactions seamlessly.
            </p>
          </div>

          <div className="space-y-3">
            {features.map((f, i) => (
              <div key={i} className="flex items-start gap-3 text-[13px] text-sidebar-foreground/60">
                <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <p className="text-[11px] text-sidebar-muted">© 2025 FinBill. Enterprise Billing Platform v2.4.1</p>
        </div>
      </div>

      {/* Right — Form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-[420px] animate-fade-in">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl tracking-tight">FinBill</span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
          <p className="text-sm text-muted-foreground mt-1.5 mb-8">Sign in to access your dashboard</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Role selector */}
            <div className="grid grid-cols-3 gap-2.5">
              {roles.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => { setRole(r.value); setEmail(r.email); }}
                  className={`flex flex-col items-center gap-1.5 p-3.5 rounded-xl border-2 transition-all text-center ${
                    role === r.value
                      ? 'border-primary bg-primary/5 shadow-sm shadow-primary/10'
                      : 'border-border hover:border-primary/30 hover:bg-muted/50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${role === r.value ? 'bg-primary/10' : 'bg-muted'}`}>
                    <r.icon className={`w-4 h-4 ${role === r.value ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <span className={`text-xs font-semibold ${role === r.value ? 'text-primary' : 'text-foreground'}`}>{r.label}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">{r.desc}</span>
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Email address</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="pl-10 h-11 text-sm rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 h-11 text-sm rounded-xl"
                    required
                  />
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full h-11 text-sm font-semibold rounded-xl shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all" disabled={loading}>
              {loading ? 'Signing in…' : (
                <>Sign in <ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>

            <div className="rounded-xl bg-muted/60 border border-border p-4">
              <p className="text-[11px] font-semibold text-foreground mb-1.5">Demo credentials</p>
              <div className="space-y-0.5">
                <p className="text-[11px] text-muted-foreground font-mono">admin@ / school@ / eta@example.com</p>
                <p className="text-[11px] text-muted-foreground font-mono">Password: 123456</p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
