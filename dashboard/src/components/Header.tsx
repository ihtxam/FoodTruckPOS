import { ArrowLeft, LogOut, Menu, Bell, User, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/lib/theme';
import { useI18n, type Locale } from '@/lib/i18n';
import AcceptingMenu from '@/components/AcceptingMenu';

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
  language?: Locale;
  onLanguageChange?: (locale: Locale) => void;
  /** Show Accepting orders/reservations dropdown (merchant panel only) */
  showAcceptingMenu?: boolean;
}

export default function Header({
  title,
  onMenuClick,
  language,
  onLanguageChange,
  showAcceptingMenu = false,
}: HeaderProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user, impersonating, stopImpersonation, logout } = useAuthStore();
  const { theme, toggleTheme } = useTheme();

  const backToSuperadmin = () => {
    if (!stopImpersonation()) {
      toast.error('Superadmin session expired — please sign in again');
      navigate('/login');
      return;
    }
    toast.success('Back to Superadmin');
    navigate('/superadmin/merchants');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="panel-header shrink-0">
      {impersonating && (
        <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-1.5 bg-amber-50 text-amber-950 border-b border-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-900">
          <p className="text-xs sm:text-sm truncate">
            {t('viewingAsMerchant')} <span className="font-semibold">{user?.name}</span>
          </p>
          <button
            type="button"
            onClick={backToSuperadmin}
            className="inline-flex items-center gap-1 shrink-0 rounded-md bg-amber-900/90 px-2 py-1 text-xs font-medium text-white hover:bg-amber-900 dark:bg-amber-200 dark:text-amber-950"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t('backToSuperadmin')}
          </button>
        </div>
      )}

      <div className="px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onMenuClick}
            className="lg:hidden p-1.5 rounded-md hover:bg-[var(--bg-muted)] shrink-0"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-base sm:text-lg font-semibold truncate">{title}</h1>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {showAcceptingMenu ? <AcceptingMenu /> : null}

          {onLanguageChange && (
            <select
              className="input py-1 text-xs w-auto min-w-0"
              value={language || 'en'}
              onChange={(e) => onLanguageChange(e.target.value as Locale)}
              aria-label="Language"
            >
              <option value="en">EN</option>
              <option value="fr">FR</option>
              <option value="de">DE</option>
            </select>
          )}

          <button
            type="button"
            onClick={toggleTheme}
            className="p-1.5 rounded-md hover:bg-[var(--bg-muted)]"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button type="button" className="relative p-1.5 rounded-md hover:bg-[var(--bg-muted)] hidden sm:inline-flex">
            <Bell className="w-4 h-4 muted" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
          </button>

          <div className="flex items-center gap-2 pl-2 border-l border-[var(--border)]">
            <div className="text-right hidden sm:block max-w-[9rem]">
              <p className="font-medium text-xs truncate">{user?.name}</p>
              <p className="text-[10px] muted capitalize truncate">
                {impersonating ? 'Merchant (SA)' : user?.role}
              </p>
            </div>
            <button
              type="button"
              className="p-1.5 rounded-md hover:bg-[var(--bg-muted)] hidden sm:inline-flex"
              aria-label="Account"
            >
              <User className="w-4 h-4 muted" />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5 text-xs font-medium hover:bg-[var(--bg-muted)]"
              title={t('logout')}
              aria-label={t('logout')}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('logout')}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
