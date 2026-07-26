import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { ShoppingCart, Users, Package, Gift } from 'lucide-react';

interface Stats {
  totalOrders: number;
  totalCustomers: number;
  totalProducts: number;
  totalCards: number;
}

export default function Overview() {
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
    load();
  }, []);

  if (loading) return <div className="text-center py-12">Loading...</div>;

  const cards = [
    { label: 'Products', value: stats.totalProducts, icon: Package, path: '/merchant/products', color: 'bg-orange-500' },
    { label: 'Orders', value: stats.totalOrders, icon: ShoppingCart, path: '/merchant/orders', color: 'bg-blue-500' },
    { label: 'Customers', value: stats.totalCustomers, icon: Users, path: '/merchant/customers', color: 'bg-purple-500' },
    { label: 'Loyalty cards', value: stats.totalCards, icon: Gift, path: '/merchant/loyalty', color: 'bg-green-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-gray-600">Quick snapshot of your shop. Use the left menu for Products, Loyalty, and Settings.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.path} to={card.path} className="card hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">{card.label}</p>
                  <p className="text-2xl font-bold mt-2">{card.value}</p>
                </div>
                <div className={`${card.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
