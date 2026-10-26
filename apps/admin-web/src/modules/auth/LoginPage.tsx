import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../app/auth/AuthContext.js';
import { BrandLogo } from '../../components/BrandLogo.js';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [phone, setPhone] = useState('+919000000001');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/';

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(phone, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-app-bg">
      <form onSubmit={onSubmit} className="card w-full max-w-sm p-8">
        <h1 className="mb-4">
          <BrandLogo markClassName="h-10 w-10" />
        </h1>
        <p className="mb-6 text-sm text-app-muted">Sign in to the operations console</p>

        <label className="mb-1 block">
          <span className="section-label mb-1 block">Phone</span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="field"
            autoComplete="username"
          />
        </label>

        <label className="mb-4 block">
          <span className="section-label mb-1 block">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="field"
            autoComplete="current-password"
          />
        </label>

        {error && <p className="mb-4 text-sm text-app-danger">{error}</p>}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
