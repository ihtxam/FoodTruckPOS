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
import Staff from './Staff';
import OnlineShop from './OnlineShop';
import FloorPlan from './FloorPlan';
import Reservations from './Reservations';
import Newsletter from './Newsletter';
import WebPos from './WebPos';
import Reports from './Reports';
import api from '@/lib/api';
import { I18nProvider, useI18n, type Locale } from '@/lib/i18n';
import { APP_PANEL_TITLE } from '@/lib/brand';
import { useAuthStore } from '@/store/auth';
import { canAccessRoute } from '@/lib/permissions';
import type { EditionFeatureKey } from '@/lib/edition-features';

const WebsiteCms = lazy(() => import('./WebsiteCms'));

function MerchantShell() {
  const { t, locale, setLocale } = useI18n();
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'merchant' && user?.isOwner !== false;
  const location = useLocation();
  const isPosRoute = /^\/merchant\/pos\/?$/.test(location.pathname);
  const isPosEmbed =
    typeof window !== 'undefined' &&
    (new URLSearchParams(location.search).get('embed') === '1' ||
      sessionStorage.getItem('manupos_pos_embed') === '1');
  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  /** When true on /merchant/pos, hide sidebar + header so WebPOS feels like its own app. */
  const [posAppMode, setPosAppMode] = useState(true);
  const [editionFeatures, setEditionFeatures] = useState<EditionFeatureKey[] | null>(null);
  const hideChrome = (isPosRoute && posAppMode) || isPosEmbed;

  useEffect(() => {
    api
      .get('/merchant/settings')
      .then((r) => {
        const feats = r.data?.settings?.editionFeatures;
        setEditionFeatures(Array.isArray(feats) ? feats : null);
      })
      .catch(() => setEditionFeatures(null));
  }, []);

  useEffect(() => {
    if (isPosRoute) setPosAppMode(true);
  }, [isPosRoute]);

  useEffect(() => {
    document.title = APP_PANEL_TITLE;
  }, []);

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

  const perms = user?.permissions;
  const allow = (path: string) => canAccessRoute(path, perms, isOwner, editionFeatures);

  const menuItems = [
    { label: t('overview'), path: '/merchant', icon: '📊' },
    {
      id: 'sales',
      label: t('navSales'),
      icon: '📦',
      children: [
        { label: t('orders'), path: '/merchant/orders', icon: '📦' },
        { label: t('webPos'), path: '/merchant/pos', icon: '🖥️' },
        { label: t('reports'), path: '/merchant/reports', icon: '📈' },
      ].filter((item) => allow(item.path)),
    },
    {
      id: 'catalog',
      label: t('navCatalog'),
      icon: '🛍️',
      children: [
        { label: t('products'), path: '/merchant/products', icon: '🛍️' },
        { label: t('categories'), path: '/merchant/categories', icon: '🏷️' },
        { label: t('modifiers'), path: '/merchant/modifiers', icon: '🧩' },
      ].filter((item) => allow(item.path)),
    },
    {
      id: 'customers',
      label: t('navCustomers'),
      icon: '👥',
      children: [
        { label: t('customers'), path: '/merchant/customers', icon: '👥' },
        { label: t('loyalty'), path: '/merchant/loyalty', icon: '🎁' },
        { label: t('offers'), path: '/merchant/offers', icon: '🏷️' },
        { label: t('newsletter'), path: '/merchant/newsletter', icon: '✉️' },
      ].filter((item) => allow(item.path)),
    },
    {
      id: 'online',
      label: t('navOnline'),
      icon: '🌐',
      children: [
        { label: t('shop'), path: '/merchant/online-shop', icon: '🌐' },
        { label: t('cmsWebsite'), path: '/merchant/website', icon: '✏️' },
        { label: t('reservations'), path: '/merchant/reservations', icon: '📅' },
      ].filter((item) => allow(item.path)),
    },
    ...(allow('/merchant/floor-plan')
      ? [{ label: t('floorPlan'), path: '/merchant/floor-plan', icon: '🪑' }]
      : []),
    ...(allow('/merchant/users')
      ? [{ label: t('staffPageTitle'), path: '/merchant/users', icon: '👤' }]
      : []),
    {
      id: 'account',
      label: t('navAccount'),
      icon: '⚙️',
      children: [
        { label: t('billing'), path: '/merchant/billing', icon: '💼' },
        { label: t('settings'), path: '/merchant/settings', icon: '⚙️' },
      ].filter((item) => allow(item.path)),
    },
  ]
    .filter((entry) => {
      if ('children' in entry && Array.isArray(entry.children)) {
        return entry.children.length > 0;
      }
      if (entry.path) return allow(entry.path);
      return false;
    });

  return (
    <div className={`flex h-full max-h-full panel-shell${hideChrome ? ' webpos-app-mode' : ''}`}>
      {!hideChrome && (
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          menuItems={menuItems}
          panelKey="merchant"
        />
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
            isPosRoute && posAppMode
              ? 'flex-1 overflow-hidden p-0 min-h-0'
              : 'panel-main flex-1 p-3 sm:p-4'
          }
        >
          <Routes>
            <Route index element={<Overview />} />
            <Route path="orders" element={<Orders />} />
            <Route path="pos" element={<WebPos appMode={hideChrome} />} />
            <Route path="reports" element={<Reports />} />
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
            <Route path="users" element={<Staff />} />
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
