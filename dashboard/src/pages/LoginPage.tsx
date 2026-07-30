import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { APP_NAME, APP_PANEL_TITLE } from '@/lib/brand';

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['superadmin', 'merchant']),
});

type LoginFormData = z.infer<typeof loginSchema>;

const ACCOUNTS = {
  superadmin: {
    email: 'admin@chaslay.com',
    password: 'ChaslayAdmin123!',
    role: 'superadmin' as const,
  },
  merchant: {
    email: 'demo@chaslay.com',
    password: 'DemoShop123!',
    role: 'merchant' as const,
  },
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { setUser, setToken } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { role: 'merchant', email: '', password: '' },
  });

  const role = watch('role');

  useEffect(() => {
    document.title = APP_PANEL_TITLE;
  }, []);

  const fillAccount = (key: keyof typeof ACCOUNTS) => {
    const account = ACCOUNTS[key];
    setValue('role', account.role, { shouldValidate: true });
    setValue('email', account.email, { shouldValidate: true });
    setValue('password', account.password, { shouldValidate: true });
  };

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const endpoint =
        data.role === 'superadmin' ? '/auth/superadmin/login' : '/auth/merchant/login';

      const response = await api.post(endpoint, {
        email: data.email,
        password: data.password,
      });

      const { token, merchant, superadmin, isOwner } = response.data;
      const account = data.role === 'superadmin' ? superadmin : merchant;
      if (!token || !account) {
        throw new Error('Invalid login response from server');
      }

      const isStaff = data.role === 'merchant' && account.staffId;
      const user = {
        id: isStaff ? account.staffId : account.id,
        email: account.email,
        name: account.name,
        role: (data.role === 'superadmin' ? 'superadmin' : isStaff ? 'staff' : 'merchant') as
          | 'superadmin'
          | 'merchant'
          | 'staff',
        merchantId: data.role === 'merchant' ? (isStaff ? account.id : account.id) : undefined,
        staffId: isStaff ? account.staffId : undefined,
        roleName: account.roleName,
        permissions: account.permissions,
        isOwner: data.role === 'merchant' && isOwner !== false && !isStaff,
      };

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setToken(token);
      setUser(user);

      toast.success(`Signed in as ${data.role}`);
      navigate(data.role === 'superadmin' ? '/superadmin' : '/merchant');
    } catch (error: any) {
      const message =
        error.response?.data?.error ||
        error.message ||
        'Login failed. Check role, email, and password.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-600 p-3 rounded-lg">
              <LogIn className="w-6 h-6 text-white" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center mb-2">{APP_NAME}</h1>
          <p className="text-gray-600 text-center mb-6">Sign in to your admin panel</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Role</label>
              <select {...register('role')} className="input">
                <option value="merchant">Merchant</option>
                <option value="superadmin">Superadmin</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Role must match the account. Superadmin login only works when Superadmin is selected.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                {...register('email')}
                type="email"
                placeholder="your@email.com"
                className="input"
                autoComplete="username"
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <input
                {...register('password')}
                type="password"
                placeholder="••••••••"
                className="input"
                autoComplete="current-password"
              />
              {errors.password && (
                <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
              )}
            </div>

            <button type="submit" disabled={isLoading} className="btn-primary w-full">
              {isLoading ? 'Signing in...' : `Sign in as ${role}`}
            </button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-gray-700 space-y-3">
            <p className="font-semibold">Use these live accounts (not old demo@example.com):</p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => fillAccount('merchant')}
                className="w-full text-left px-3 py-2 bg-white border rounded-lg hover:border-blue-400"
              >
                <span className="font-medium">Merchant</span>
                <br />
                <span className="text-xs break-all">{ACCOUNTS.merchant.email}</span>
              </button>
              <button
                type="button"
                onClick={() => fillAccount('superadmin')}
                className="w-full text-left px-3 py-2 bg-white border rounded-lg hover:border-blue-400"
              >
                <span className="font-medium">Superadmin</span>
                <br />
                <span className="text-xs break-all">{ACCOUNTS.superadmin.email}</span>
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Click a card to autofill, then press Sign In.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
