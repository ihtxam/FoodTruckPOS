import { useCallback, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Overview from './Overview';
import Merchants from './Merchants';
import Licenses from './Licenses';
import Analytics from './Analytics';
import Settings from './Settings';
import { I18nProvider, useI18n, type Locale } from '@/lib/i18n';

function SuperadminShell() {
  const { t, locale, setLocale } = useI18n();
  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );

  const changeLanguage = useCallback(
    (lang: Locale) => {
      setLocale(lang);
    },
    [setLocale]
  );

  const menuItems = [
    { label: t('overview'), path: '/superadmin', icon: '📊' },
    { label: t('merchants'), path: '/superadmin/merchants', icon: '🏪' },
    { label: t('licenses'), path: '/superadmin/licenses', icon: '🔑' },
    { label: t('analytics'), path: '/superadmin/analytics', icon: '📈' },
    { label: t('settings'), path: '/superadmin/settings', icon: '⚙️' },
  ];

  return (
    <div className="flex h-screen panel-shell">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        menuItems={menuItems}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header
          title={t('superadminDashboard')}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          language={locale}
          onLanguageChange={changeLanguage}
        />

        <main className="flex-1 overflow-auto p-3 sm:p-4">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="merchants" element={<Merchants />} />
            <Route path="licenses" element={<Licenses />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function SuperadminDashboard() {
  return (
    <I18nProvider>
      <SuperadminShell />
    </I18nProvider>
  );
}
