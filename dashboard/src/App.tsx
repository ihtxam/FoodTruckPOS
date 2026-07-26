import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/store/auth';

import LoginPage from '@/pages/LoginPage';
import SetPasswordPage from '@/pages/SetPasswordPage';
import SuperadminDashboard from '@/pages/superadmin/Dashboard';
import MerchantDashboard from '@/pages/merchant/Dashboard';
import OrderingPage from '@/pages/shop/OrderingPage';
import CheckoutPage from '@/pages/shop/CheckoutPage';
import OrderConfirmationPage from '@/pages/shop/OrderConfirmationPage';
import ReceiptPage from '@/pages/ReceiptPage';
import ProtectedRoute from '@/components/ProtectedRoute';

const MAIN_HOST = (
  import.meta.env.VITE_PUBLIC_DOMAIN ||
  'manupos.webprintmedia.swiss'
).toLowerCase();

/** Reserved hosts that must never be treated as a merchant shop subdomain. */
const RESERVED_SUBDOMAINS = new Set(['admin', 'api', 'pay', 'www', 'app', 'panel']);

function hostParts() {
  const host = window.location.hostname.toLowerCase();
  if (host === MAIN_HOST) return { host, kind: 'main' as const, label: '' };
  if (!host.endsWith(`.${MAIN_HOST}`)) return { host, kind: 'other' as const, label: '' };
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
  const shopMode = shopHub || merchantSubdomain;

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <>
      <BrowserRouter>
        <Routes>
          {!shopMode && <Route path="/login" element={<LoginPage />} />}
          {!shopMode && <Route path="/set-password" element={<SetPasswordPage />} />}
          <Route path="/receipt/:saleId" element={<ReceiptPage />} />
          <Route path="/shop/:merchantSlug" element={<OrderingPage />} />
          <Route path="/shop/:merchantSlug/checkout" element={<CheckoutPage />} />
          <Route path="/shop/:merchantSlug/order/:orderId" element={<OrderConfirmationPage />} />

          {/* shop.domain/{slug} — Chaslay-style path shops */}
          {shopHub && (
            <>
              <Route path="/:merchantSlug/checkout" element={<CheckoutPage />} />
              <Route path="/:merchantSlug/order/:orderId" element={<OrderConfirmationPage />} />
              <Route path="/:merchantSlug" element={<OrderingPage />} />
              <Route path="/" element={<OrderingPage />} />
            </>
          )}

          {/* {slug}.domain — merchant subdomain shops */}
          {merchantSubdomain && (
            <>
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/order/:orderId" element={<OrderConfirmationPage />} />
              <Route path="/" element={<OrderingPage />} />
              <Route path="*" element={<OrderingPage />} />
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
