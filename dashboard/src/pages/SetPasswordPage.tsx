import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { APP_NAME } from '@/lib/brand';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function SetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [invite, setInvite] = useState<{ email: string; name: string } | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Missing invite token. Open the link from your email.');
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const res = await axios.get(`${API_BASE}/auth/invite/${encodeURIComponent(token)}`);
        setInvite(res.data.invite);
        setError('');
      } catch (err: any) {
        setError(err.response?.data?.error || 'Invalid or expired invite link');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setSaving(true);
    try {
      await axios.post(`${API_BASE}/auth/set-password`, { token, password });
      toast.success('Password created — you can sign in now');
      navigate('/login', { replace: true });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to set password');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    document.title = `${APP_NAME} — Create password`;
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 space-y-4">
        <div>
          <p className="text-sm font-medium text-slate-500 text-center mb-1">{APP_NAME}</p>
          <h1 className="text-2xl font-bold">Create your password</h1>
          <p className="text-sm text-gray-600 mt-1">Set a password for your merchant account.</p>
        </div>

        {loading && <p className="text-sm text-gray-500">Checking invite link…</p>}

        {!loading && error && (
          <div className="space-y-3">
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
            <Link to="/login" className="text-sm text-slate-700 underline">
              Back to login
            </Link>
          </div>
        )}

        {!loading && !error && invite && (
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="text-sm bg-slate-50 border rounded px-3 py-2">
              <div className="font-medium">{invite.name}</div>
              <div className="text-gray-600">{invite.email}</div>
            </div>
            <label className="block">
              <span className="text-sm font-medium">New password</span>
              <input
                type="password"
                className="input mt-1"
                minLength={8}
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Confirm password</span>
              <input
                type="password"
                className="input mt-1"
                minLength={8}
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
            <button type="submit" className="btn-primary w-full" disabled={saving}>
              {saving ? 'Saving…' : 'Create password & continue'}
            </button>
            <p className="text-center text-sm">
              <Link to="/login" className="text-gray-600 underline">
                Already have a password? Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
