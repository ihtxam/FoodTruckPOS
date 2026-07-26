import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  role: 'superadmin' | 'merchant';
  name: string;
  merchantId?: string;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  hydrated: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
  hydrate: () => void;
}

function readStoredAuth(): { token: string | null; user: User | null } {
  if (typeof window === 'undefined') {
    return { token: null, user: null };
  }
  try {
    const token = localStorage.getItem('token');
    const raw = localStorage.getItem('user');
    if (token && raw) {
      return { token, user: JSON.parse(raw) as User };
    }
  } catch {
    // ignore corrupt storage
  }
  return { token: null, user: null };
}

const initial = readStoredAuth();

export const useAuthStore = create<AuthStore>((set) => ({
  user: initial.user,
  token: initial.token,
  isLoading: false,
  hydrated: true,
  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  setLoading: (loading) => set({ isLoading: loading }),
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null });
  },
  hydrate: () => {
    const stored = readStoredAuth();
    set({ ...stored, hydrated: true });
  },
}));
