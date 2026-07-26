import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { ShoppingCart, Users, Package, Gift } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface Stats {
  totalOrders: number;
  totalCustomers: number;
  totalProducts: number;
  totalCards: number;
}

export default function Overview() {
  const { t } = useI18n();
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0,
    totalCustomers: 0,
    totalProducts: 0,
    totalCards: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [products, orders, customers, cards] = await Promise.all([
          api.get('/merchant/products'),
          api.get('/merchant/orders'),
          api.get('/merchant/customers'),
          api.get('/loyalty/cards').catch(() => ({ data: { cards: [] } })),
        ]);
        setStats({
          totalProducts: products.data.products?.length || 0,
          totalOrders: orders.data.orders?.length || 0,
          totalCustomers: customers.data.customers?.length || 0,
          totalCards: cards.data.cards?.length || 0,
        });
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Failed to load overview');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading) return <div className="text-center py-10 muted text-sm">{t('loading')}</div>;

  const cards = [
    { label: t('products'), value: stats.totalProducts, icon: Package, path: '/merchant/products' },
    { label: t('orders'), value: stats.totalOrders, icon: ShoppingCart, path: '/merchant/orders' },
    { label: t('customers'), value: stats.totalCustomers, icon: Users, path: '/merchant/customers' },
    { label: t('loyaltyCards'), value: stats.totalCards, icon: Gift, path: '/merchant/loyalty' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">{t('overview')}</h1>
        <p className="page-sub">{t('overviewSub')}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.path}
              to={card.path}
              className="card hover:bg-[var(--bg-muted)] transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs muted truncate">{card.label}</p>
                  <p className="text-xl font-semibold mt-1 tabular-nums">{card.value}</p>
                </div>
                <div className="rounded-md p-2 bg-[var(--bg-muted)] shrink-0">
                  <Icon className="w-4 h-4 muted" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
