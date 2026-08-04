import { create } from 'zustand';
import type { Permission } from '@/lib/permissions';

export interface User {
  id: string;
  email: string;
  role: 'superadmin' | 'merchant' | 'staff';
  name: string;
  merchantId?: string;
  staffId?: string;
  roleName?: string;
  permissions?: Permission[];
  isOwner?: boolean;
  impersonatedBy?: string;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  hydrated: boolean;
  impersonating: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  /** Switch into a merchant panel while stashing the superadmin session. */
  startImpersonation: (token: string, merchantUser: User) => void;
  /** Restore the stashed superadmin session. Returns false if none stored. */
  stopImpersonation: () => boolean;
  logout: () => void;
  hydrate: () => void;
}

const RETURN_TOKEN_KEY = 'sa_return_token';
const RETURN_USER_KEY = 'sa_return_user';

function readStoredAuth(): { token: string | null; user: User | null; impersonating: boolean } {
  if (typeof window === 'undefined') {
    return { token: null, user: null, impersonating: false };
  }
  try {
    const token = localStorage.getItem('token');
    const raw = localStorage.getItem('user');
    const impersonating = !!sessionStorage.getItem(RETURN_TOKEN_KEY);
    if (token && raw) {
      return { token, user: JSON.parse(raw) as User, impersonating };
    }
  } catch {
    // ignore corrupt storage
  }
  return { token: null, user: null, impersonating: false };
}

function clearReturnSession() {
  sessionStorage.removeItem(RETURN_TOKEN_KEY);
  sessionStorage.removeItem(RETURN_USER_KEY);
}

const initial = readStoredAuth();

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: initial.user,
  token: initial.token,
  isLoading: false,
  hydrated: true,
  impersonating: initial.impersonating,
  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  setLoading: (loading) => set({ isLoading: loading }),
  startImpersonation: (token, merchantUser) => {
    const { token: currentToken, user: currentUser } = get();
    if (currentToken && currentUser?.role === 'superadmin') {
      sessionStorage.setItem(RETURN_TOKEN_KEY, currentToken);
      sessionStorage.setItem(RETURN_USER_KEY, JSON.stringify(currentUser));
    }
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(merchantUser));
    set({ token, user: merchantUser, impersonating: true });
  },
  stopImpersonation: () => {
    const returnToken = sessionStorage.getItem(RETURN_TOKEN_KEY);
    const returnUserRaw = sessionStorage.getItem(RETURN_USER_KEY);
    if (!returnToken || !returnUserRaw) {
      return false;
    }
    try {
      const returnUser = JSON.parse(returnUserRaw) as User;
      clearReturnSession();
      localStorage.setItem('token', returnToken);
      localStorage.setItem('user', JSON.stringify(returnUser));
      set({ token: returnToken, user: returnUser, impersonating: false });
      return true;
    } catch {
      clearReturnSession();
      return false;
    }
  },
  logout: () => {
    clearReturnSession();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    try {
      sessionStorage.removeItem('webpos_staff_session');
    } catch {
      /* ignore */
    }
    set({ user: null, token: null, impersonating: false });
  },
  hydrate: () => {
    const stored = readStoredAuth();
    set({ ...stored, hydrated: true });
  },
}));
