import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/store/auth';

import LoginPage from '@/pages/LoginPage';
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

function isShopSubdomain() {
  const host = window.location.hostname.toLowerCase();
  return host !== MAIN_HOST && host.endsWith(`.${MAIN_HOST}`);
}

function App() {
  const { hydrate } = useAuthStore();
  const shopHost = isShopSubdomain();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <>
      <BrowserRouter>
        <Routes>
          {!shopHost && <Route path="/login" element={<LoginPage />} />}
          <Route path="/receipt/:saleId" element={<ReceiptPage />} />
          <Route path="/shop/:merchantSlug" element={<OrderingPage />} />
          <Route path="/shop/:merchantSlug/checkout" element={<CheckoutPage />} />
          <Route path="/shop/:merchantSlug/order/:orderId" element={<OrderConfirmationPage />} />

          {shopHost && (
            <>
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/order/:orderId" element={<OrderConfirmationPage />} />
              <Route path="/" element={<OrderingPage />} />
              <Route path="*" element={<OrderingPage />} />
            </>
          )}

          {!shopHost && (
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
