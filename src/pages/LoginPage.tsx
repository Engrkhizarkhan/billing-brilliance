import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { FinTapMark } from '@/components/FinTapMark';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import styles from './LoginPage.module.css';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setShowPassword(false);
    const success = await login(email, password);
    setLoading(false);
    if (success) {
      toast.success('Signed in successfully');
      const user = useAuthStore.getState().user;
      const roleRedirects: Record<string, string> = { admin: '/admin', school: '/school', org: '/org' };
      navigate(roleRedirects[user!.role] ?? `/${user!.role}`);
    } else {
      toast.error('Invalid credentials');
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a href="https://fintap.pk/" className={styles.brand} aria-label="FinTap home">
          <FinTapMark className="h-8 w-8" />
          <span aria-hidden="true">FinTap</span>
        </a>
        <a href="https://fintap.pk/" className={styles.backLink}>
          Back to website <span aria-hidden="true">↗</span>
        </a>
      </header>

      <main className={styles.main}>
        <section className={styles.signIn} aria-labelledby="login-heading">
          <p className={styles.eyebrow}>YOUR WORKSPACE</p>
          <h1 id="login-heading">Sign in to FinTap</h1>
          <p className={styles.intro}>Your bills, payments and records in one place.</p>

          <form onSubmit={handleSubmit} className={styles.form} aria-busy={loading}>
            <div className={styles.field}>
              <label htmlFor="login-email">Email address</label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="login-password">Password</label>
              <div className={styles.passwordField}>
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className={styles.visibilityButton}
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-controls="login-password"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
                </button>
              </div>
            </div>

            <button type="submit" className={styles.submit} disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className={styles.help}>
            Need access? Contact your institution’s administrator.
          </p>
        </section>
      </main>

      <footer className={styles.footer}>
        <span>© {new Date().getFullYear()} FinTap</span>
        <span>Payment collection, made simpler.</span>
      </footer>
    </div>
  );
};

export default LoginPage;
