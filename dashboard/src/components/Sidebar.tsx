import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth';
import { APP_NAME } from '@/lib/brand';
import { useI18n } from '@/lib/i18n';

interface MenuItem {
  label: string;
  path: string;
  icon: string;
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  menuItems: MenuItem[];
}

export default function Sidebar({ isOpen, onToggle, menuItems }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const logout = useAuthStore((s) => s.logout);
  const impersonating = useAuthStore((s) => s.impersonating);
  const stopImpersonation = useAuthStore((s) => s.stopImpersonation);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const backToSuperadmin = () => {
    if (!stopImpersonation()) {
      toast.error('Superadmin session expired — please sign in again');
      navigate('/login');
      return;
    }
    toast.success('Back to Superadmin');
    navigate('/superadmin/merchants');
  };

  return (
    <>
      <aside
        className={`${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed lg:relative lg:translate-x-0 w-56 h-dvh max-h-dvh bg-slate-900 text-slate-100 transition-transform duration-200 z-40 flex flex-col shrink-0`}
      >
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-base font-semibold tracking-tight">{APP_NAME}</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">{t('panel')}</p>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="lg:hidden p-1.5 rounded-md hover:bg-slate-800"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 min-h-0 p-2 space-y-0.5 overflow-y-auto">
          {menuItems.map((item) => {
            const isRoot = item.path === '/merchant' || item.path === '/superadmin';
            const isActive = isRoot
              ? location.pathname === item.path
              : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => {
                  if (window.innerWidth < 1024) onToggle();
                }}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="text-sm w-5 text-center opacity-80">{item.icon}</span>
                <span className="font-medium truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-700 space-y-1.5 shrink-0 bg-slate-950">
          {impersonating && (
            <button
              type="button"
              onClick={backToSuperadmin}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {t('backToSuperadmin')}
            </button>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t('logout')}
          </button>
        </div>
      </aside>

      {isOpen && (
        <div className="fixed inset-0 bg-black/40 lg:hidden z-30" onClick={onToggle} />
      )}
    </>
  );
}
