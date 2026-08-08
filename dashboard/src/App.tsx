import { lazy, Suspense, useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/store/auth';
import { I18nProvider, SHOP_LANG_KEY, shopLangStorageKey } from '@/lib/i18n';
import { resolveShopKey } from '@/lib/shop-cart';
import ShopLocaleSync from '@/components/shop/ShopLocaleSync';

import LoginPage from '@/pages/LoginPage';
import SetPasswordPage from '@/pages/SetPasswordPage';
import SuperadminDashboard from '@/pages/superadmin/Dashboard';
import MerchantDashboard from '@/pages/merchant/Dashboard';
import ResellerDashboard from '@/pages/reseller/Dashboard';
import OrderingPage from '@/pages/shop/OrderingPage';
import CheckoutPage from '@/pages/shop/CheckoutPage';
import OrderConfirmationPage from '@/pages/shop/OrderConfirmationPage';
import AccountPage from '@/pages/shop/AccountPage';
import ReservationsPage from '@/pages/shop/ReservationsPage';
import ReceiptPage from '@/pages/ReceiptPage';
import ProtectedRoute from '@/components/ProtectedRoute';
import PosEmbedPage from '@/pages/PosEmbedPage';

const ShopEntry = lazy(() => import('@/pages/shop/ShopEntry'));

function ShopRoutes({ children }: { children: React.ReactNode }) {
  const { merchantSlug } = useParams();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const storageKey = shopKey ? shopLangStorageKey(shopKey) : SHOP_LANG_KEY;

  useEffect(() => {
    document.documentElement.classList.add('shop-shell');
    return () => document.documentElement.classList.remove('shop-shell');
  }, []);

  return (
    <I18nProvider storageKey={storageKey}>
      <ShopLocaleSync shopKey={shopKey} />
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center text-stone-500">…</div>
        }
      >
        {children}
      </Suspense>
    </I18nProvider>
  );
}

const MAIN_HOST = (
  import.meta.env.VITE_PUBLIC_DOMAIN ||
  'manupos.webprintmedia.swiss'
).toLowerCase();

/** Reserved hosts that must never be treated as a merchant shop subdomain. */
const RESERVED_SUBDOMAINS = new Set(['admin', 'api', 'pay', 'www', 'app', 'panel']);

function hostParts() {
  const host = window.location.hostname.toLowerCase();
  if (host === MAIN_HOST) return { host, kind: 'main' as const, label: '' };
  if (!host.endsWith(`.${MAIN_HOST}`)) return { host, kind: 'custom_domain' as const, label: host };
  const label = host.slice(0, -(MAIN_HOST.length + 1));
  if (label === 'shop') return { host, kind: 'shop_hub' as const, label };
  if (RESERVED_SUBDOMAINS.has(label)) return { host, kind: 'reserved' as const, label };
  return { host, kind: 'merchant_subdomain' as const, label };
}

function App() {
  const { hydrate } = useAuthStore();
  const { kind } = hostParts();
  const shopHub = kind === 'shop_hub';
  const merchantSubdomain = kind === 'merchant_subdomain';
  const customDomain = kind === 'custom_domain';
  const shopMode = shopHub || merchantSubdomain || customDomain;

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <>
      <BrowserRouter>
        <Routes>
          {!shopMode && <Route path="/login" element={<LoginPage />} />}
          {!shopMode && <Route path="/set-password" element={<SetPasswordPage />} />}
          {!shopMode && <Route path="/pos-embed" element={<PosEmbedPage />} />}
          <Route path="/receipt/:saleId" element={<ReceiptPage />} />
          <Route
            path="/shop/:merchantSlug"
            element={
              <ShopRoutes>
                <ShopEntry />
              </ShopRoutes>
            }
          />
          <Route
            path="/shop/:merchantSlug/menu"
            element={
              <ShopRoutes>
                <OrderingPage />
              </ShopRoutes>
            }
          />
          <Route
            path="/shop/:merchantSlug/checkout"
            element={
              <ShopRoutes>
                <CheckoutPage />
              </ShopRoutes>
            }
          />
          <Route
            path="/shop/:merchantSlug/order/:orderId"
            element={
              <ShopRoutes>
                <OrderConfirmationPage />
              </ShopRoutes>
            }
          />
          <Route
            path="/shop/:merchantSlug/account"
            element={
              <ShopRoutes>
                <AccountPage />
              </ShopRoutes>
            }
          />
          <Route
            path="/shop/:merchantSlug/reservations"
            element={
              <ShopRoutes>
                <ReservationsPage />
              </ShopRoutes>
            }
          />

          {/* shop.domain/{slug} - Chaslay-style path shops */}
          {shopHub && (
            <>
              <Route
                path="/:merchantSlug/menu"
                element={
                  <ShopRoutes>
                    <OrderingPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/:merchantSlug/checkout"
                element={
                  <ShopRoutes>
                    <CheckoutPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/:merchantSlug/order/:orderId"
                element={
                  <ShopRoutes>
                    <OrderConfirmationPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/:merchantSlug/account"
                element={
                  <ShopRoutes>
                    <AccountPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/:merchantSlug/reservations"
                element={
                  <ShopRoutes>
                    <ReservationsPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/:merchantSlug"
                element={
                  <ShopRoutes>
                    <ShopEntry />
                  </ShopRoutes>
                }
              />
              <Route
                path="/"
                element={
                  <ShopRoutes>
                    <ShopEntry />
                  </ShopRoutes>
                }
              />
            </>
          )}

          {/* {slug}.domain - merchant subdomain shops */}
          {merchantSubdomain && (
            <>
              <Route
                path="/menu"
                element={
                  <ShopRoutes>
                    <OrderingPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/checkout"
                element={
                  <ShopRoutes>
                    <CheckoutPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/order/:orderId"
                element={
                  <ShopRoutes>
                    <OrderConfirmationPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/account"
                element={
                  <ShopRoutes>
                    <AccountPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/reservations"
                element={
                  <ShopRoutes>
                    <ReservationsPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/"
                element={
                  <ShopRoutes>
                    <ShopEntry />
                  </ShopRoutes>
                }
              />
              <Route
                path="*"
                element={
                  <ShopRoutes>
                    <ShopEntry />
                  </ShopRoutes>
                }
              />
            </>
          )}

          {/* Custom merchant domain (apex / www) */}
          {customDomain && (
            <>
              <Route
                path="/menu"
                element={
                  <ShopRoutes>
                    <OrderingPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/checkout"
                element={
                  <ShopRoutes>
                    <CheckoutPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/order/:orderId"
                element={
                  <ShopRoutes>
                    <OrderConfirmationPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/account"
                element={
                  <ShopRoutes>
                    <AccountPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/reservations"
                element={
                  <ShopRoutes>
                    <ReservationsPage />
                  </ShopRoutes>
                }
              />
              <Route
                path="/"
                element={
                  <ShopRoutes>
                    <ShopEntry />
                  </ShopRoutes>
                }
              />
              <Route
                path="*"
                element={
                  <ShopRoutes>
                    <ShopEntry />
                  </ShopRoutes>
                }
              />
            </>
          )}

          {!shopMode && (
            <>
              <Route
                path="/superadmin/*"
                element={
                  <ProtectedRoute requiredRole="superadmin">
                    <SuperadminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reseller/*"
                element={
                  <ProtectedRoute requiredRole="reseller">
                    <ResellerDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/merchant/*"
                element={
                  <ProtectedRoute requiredRole="merchant">
                    <MerchantDashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </>
          )}
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </>
  );
}

export default App;
