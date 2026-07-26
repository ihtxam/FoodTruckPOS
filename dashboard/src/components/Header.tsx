import { Menu, Bell, User } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import type { Locale } from '@/lib/i18n';

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
  language?: Locale;
  onLanguageChange?: (locale: Locale) => void;
}

export default function Header({ title, onMenuClick, language, onLanguageChange }: HeaderProps) {
  const { user } = useAuthStore();

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
          <Menu className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        {onLanguageChange && (
          <select
            className="input py-1 text-sm w-auto"
            value={language || 'en'}
            onChange={(e) => onLanguageChange(e.target.value as Locale)}
            aria-label="Language"
          >
            <option value="en">EN</option>
            <option value="fr">FR</option>
            <option value="de">DE</option>
          </select>
        )}

        <button className="relative p-2 hover:bg-gray-100 rounded-lg">
          <Bell className="w-6 h-6 text-gray-600" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
          <div className="text-right">
            <p className="font-medium text-sm">{user?.name}</p>
            <p className="text-xs text-gray-600 capitalize">{user?.role}</p>
          </div>
          <button className="p-2 hover:bg-gray-100 rounded-lg">
            <User className="w-6 h-6 text-gray-600" />
          </button>
        </div>
      </div>
    </header>
  );
}
