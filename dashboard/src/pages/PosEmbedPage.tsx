import { useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuthStore, type User } from '@/store/auth';

/**
 * SSO bridge for Android POS WebView.
 * URL: /pos-embed?next=/merchant/settings#token=...&user=...
 * Hash carries credentials so they are less likely to hit server access logs.
 */
export default function PosEmbedPage() {
  const [params] = useSearchParams();
  const setToken = useAuthStore((s) => s.setToken);
  const setUser = useAuthStore((s) => s.setUser);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextPath = useMemo(() => {
    const raw = params.get('next') || '/merchant/settings';
    if (!raw.startsWith('/merchant')) return '/merchant/settings';
    const join = raw.includes('?') ? '&' : '?';
    return `${raw}${join}embed=1`;
  }, [params]);

  useEffect(() => {
    try {
      const hash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash;
      const hashParams = new URLSearchParams(hash);
      const token = hashParams.get('token') || params.get('token');
      const userRaw = hashParams.get('user') || params.get('user');
      if (!token || !userRaw) {
        setError('Missing auth token. Sign in again on the POS, then reopen online settings.');
        return;
      }
      const user = JSON.parse(decodeURIComponent(userRaw)) as User;
      if (!user?.id || !user?.role) {
        setError('Invalid user payload.');
        return;
      }
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      sessionStorage.setItem('manupos_pos_embed', '1');
      setToken(token);
      setUser(user);
      // Clear credentials from the address bar
      history.replaceState(null, '', `/pos-embed?next=${encodeURIComponent(params.get('next') || '/merchant/settings')}`);
      setReady(true);
    } catch (e: any) {
      setError(e?.message || 'Failed to open panel settings');
    }
  }, [params, setToken, setUser]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md text-center space-y-2">
          <h1 className="text-lg font-semibold">Could not open online settings</h1>
          <p className="text-sm text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-600">
        Opening merchant settings…
      </div>
    );
  }

  return <Navigate to={nextPath} replace />;
}
