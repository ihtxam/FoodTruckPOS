import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';

/** Terminals live under Settings → Payments (shared Swisspayout credentials). */
export default function Terminals() {
  useEffect(() => {
    // keep for bookmarks / old links
  }, []);
  return <Navigate to="/merchant/settings?tab=payments" replace />;
}
