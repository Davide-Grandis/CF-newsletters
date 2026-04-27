import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';

export default function Login() {
  const { setToken } = useAuth();
  const nav = useNavigate();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      // Probe an authenticated endpoint to verify the token works.
      await api(value, '/api/stats/overview');
      setToken(value);
      nav('/');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white rounded-lg shadow p-6 space-y-4">
        <h1 className="text-lg font-semibold">Sign in</h1>
        <p className="text-sm text-slate-500">
          Paste the <code className="bg-slate-100 px-1 rounded">ADMIN_TOKEN</code> secret you set with{' '}
          <code className="bg-slate-100 px-1 rounded">wrangler secret put</code>.
        </p>
        <input
          type="password"
          autoFocus
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="bearer token"
          className="w-full border rounded px-3 py-2 text-sm"
        />
        {err && <div className="text-sm text-red-600">{err}</div>}
        <button
          type="submit"
          disabled={busy || !value}
          className="w-full bg-slate-900 text-white rounded py-2 text-sm hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? 'Checking…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
