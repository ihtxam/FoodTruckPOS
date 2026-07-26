import { Menu, Bell, User, Moon, Sun } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/lib/theme';
import type { Locale } from '@/lib/i18n';

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
  language?: Locale;
  onLanguageChange?: (locale: Locale) => void;
}

export default function Header({ title, onMenuClick, language, onLanguageChange }: HeaderProps) {
  const { user } = useAuthStore();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="panel-header px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 shrink-0">
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
          <div className="text-right hidden xs:block sm:block max-w-[9rem]">
            <p className="font-medium text-xs truncate">{user?.name}</p>
            <p className="text-[10px] muted capitalize truncate">{user?.role}</p>
          </div>
          <button type="button" className="p-1.5 rounded-md hover:bg-[var(--bg-muted)]">
            <User className="w-4 h-4 muted" />
          </button>
        </div>
      </div>
    </header>
  );
}
