import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
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
import Offers from './Offers';
import Terminals from './Terminals';
import Settings from './Settings';
import Billing from './Billing';
import OnlineShop from './OnlineShop';
import FloorPlan from './FloorPlan';
import Reservations from './Reservations';
import Newsletter from './Newsletter';
import WebPos from './WebPos';
import api from '@/lib/api';
import { I18nProvider, useI18n, type Locale } from '@/lib/i18n';

const WebsiteCms = lazy(() => import('./WebsiteCms'));

function MerchantShell() {
  const { t, locale, setLocale } = useI18n();
  const location = useLocation();
  const isPosRoute = /^\/merchant\/pos\/?$/.test(location.pathname);
  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  /** When true on /merchant/pos, hide sidebar + header so WebPOS feels like its own app. */
  const [posAppMode, setPosAppMode] = useState(true);
  const hideChrome = isPosRoute && posAppMode;

  useEffect(() => {
    if (isPosRoute) setPosAppMode(true);
  }, [isPosRoute]);

  useEffect(() => {
    const showPanel = () => setPosAppMode(false);
    const enterApp = () => setPosAppMode(true);
    window.addEventListener('webpos:show-panel', showPanel);
    window.addEventListener('webpos:enter-app', enterApp);
    return () => {
      window.removeEventListener('webpos:show-panel', showPanel);
      window.removeEventListener('webpos:enter-app', enterApp);
    };
  }, []);

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
    { label: t('offers'), path: '/merchant/offers', icon: '🏷️' },
    { label: t('newsletter'), path: '/merchant/newsletter', icon: '✉️' },
    { label: t('shop'), path: '/merchant/online-shop', icon: '🌐' },
    { label: t('cmsWebsite'), path: '/merchant/website', icon: '✏️' },
    { label: t('floorPlan'), path: '/merchant/floor-plan', icon: '🪑' },
    { label: t('reservations'), path: '/merchant/reservations', icon: '📅' },
    { label: t('billing'), path: '/merchant/billing', icon: '💼' },
    { label: t('settings'), path: '/merchant/settings', icon: '⚙️' },
  ];

  return (
    <div className={`flex h-full max-h-full panel-shell${hideChrome ? ' webpos-app-mode' : ''}`}>
      {!hideChrome && (
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} menuItems={menuItems} />
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">
        {!hideChrome && (
          <Header
            title={t('merchantDashboard')}
            onMenuClick={() => setSidebarOpen(!sidebarOpen)}
            language={locale}
            onLanguageChange={changeLanguage}
            showAcceptingMenu
          />
        )}

        <main
          className={
            hideChrome
              ? 'flex-1 overflow-hidden p-0 min-h-0'
              : 'panel-main flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 min-h-0'
          }
        >
          <Routes>
            <Route index element={<Overview />} />
            <Route path="orders" element={<Orders />} />
            <Route path="pos" element={<WebPos appMode={hideChrome} />} />
            <Route path="products" element={<Products />} />
            <Route path="modifiers" element={<Modifiers />} />
            <Route path="categories" element={<Categories />} />
            <Route path="customers" element={<Customers />} />
            <Route path="loyalty" element={<Loyalty />} />
            <Route path="offers" element={<Offers />} />
            <Route path="newsletter" element={<Newsletter />} />
            <Route path="online-shop" element={<OnlineShop />} />
            <Route
              path="website"
              element={
                <Suspense fallback={<div className="p-4 text-sm muted">{t('loading')}</div>}>
                  <WebsiteCms />
                </Suspense>
              }
            />
            <Route path="terminals" element={<Terminals />} />
            <Route path="floor-plan" element={<FloorPlan />} />
            <Route path="reservations" element={<Reservations />} />
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
