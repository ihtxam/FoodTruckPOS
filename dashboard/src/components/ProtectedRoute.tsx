import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'superadmin' | 'merchant' | 'reseller';
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, token } = useAuthStore();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole === 'superadmin' && user.role !== 'superadmin') {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole === 'reseller' && user.role !== 'reseller') {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole === 'merchant' && user.role !== 'merchant' && user.role !== 'staff') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
