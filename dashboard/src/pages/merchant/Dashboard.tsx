import { useCallback, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import toast from 'react-hot-toast';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Overview from './Overview';
import Orders from './Orders';
import Products from './Products';
import Categories from './Categories';
import Modifiers from './Modifiers';
import Customers from './Customers';
import Loyalty from './Loyalty';
import Terminals from './Terminals';
import Settings from './Settings';
import Billing from './Billing';
import OnlineShop from './OnlineShop';
import FloorPlan from './FloorPlan';
import WebPos from './WebPos';
import api from '@/lib/api';
import { I18nProvider, useI18n, type Locale } from '@/lib/i18n';

function MerchantShell() {
  const { t, locale, setLocale } = useI18n();
  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );

  const changeLanguage = useCallback(
    async (lang: Locale) => {
      setLocale(lang);
      try {
        await api.put('/merchant/settings', { panelLanguage: lang });
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Failed to save language');
      }
    },
    [setLocale]
  );

  const menuItems = [
    { label: t('overview'), path: '/merchant', icon: '📊' },
    { label: t('orders'), path: '/merchant/orders', icon: '📦' },
    { label: t('webPos'), path: '/merchant/pos', icon: '🖥️' },
    { label: t('products'), path: '/merchant/products', icon: '🛍️' },
    { label: t('modifiers'), path: '/merchant/modifiers', icon: '🧩' },
    { label: t('categories'), path: '/merchant/categories', icon: '🏷️' },
    { label: t('customers'), path: '/merchant/customers', icon: '👥' },
    { label: t('loyalty'), path: '/merchant/loyalty', icon: '🎁' },
    { label: t('shop'), path: '/merchant/online-shop', icon: '🌐' },
    { label: t('terminals'), path: '/merchant/terminals', icon: '💳' },
    { label: t('floorPlan'), path: '/merchant/floor-plan', icon: '🪑' },
    { label: t('billing'), path: '/merchant/billing', icon: '💼' },
    { label: t('settings'), path: '/merchant/settings', icon: '⚙️' },
  ];

  return (
    <div className="flex h-screen panel-shell">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} menuItems={menuItems} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header
          title={t('merchantDashboard')}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          language={locale}
          onLanguageChange={changeLanguage}
        />

        <main className="flex-1 overflow-auto p-3 sm:p-4">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="orders" element={<Orders />} />
            <Route path="pos" element={<WebPos />} />
            <Route path="products" element={<Products />} />
            <Route path="modifiers" element={<Modifiers />} />
            <Route path="categories" element={<Categories />} />
            <Route path="customers" element={<Customers />} />
            <Route path="loyalty" element={<Loyalty />} />
            <Route path="online-shop" element={<OnlineShop />} />
            <Route path="terminals" element={<Terminals />} />
            <Route path="floor-plan" element={<FloorPlan />} />
            <Route path="billing" element={<Billing />} />
            <Route path="settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function MerchantDashboard() {
  return (
    <I18nProvider>
      <MerchantShell />
    </I18nProvider>
  );
}
