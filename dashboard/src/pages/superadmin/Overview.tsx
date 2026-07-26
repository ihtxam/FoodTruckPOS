import { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Users, Lock, TrendingUp, DollarSign } from 'lucide-react';

interface Stats {
  totalMerchants: number;
  activeLicenses: number;
  totalRevenue: number;
  platformGrowth: number;
}

export default function Overview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/superadmin/analytics/overview');
        setStats(response.data.overview);
      } catch (error) {
        toast.error('Failed to load statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  const statCards = [
    {
      label: 'Total Merchants',
      value: stats?.totalMerchants || 0,
      icon: Users,
      color: 'bg-blue-500',
    },
    {
      label: 'Active Licenses',
      value: stats?.activeLicenses || 0,
      icon: Lock,
      color: 'bg-green-500',
    },
    {
      label: 'Total Revenue',
      value: `$${(stats?.totalRevenue || 0).toFixed(2)}`,
      icon: DollarSign,
      color: 'bg-purple-500',
    },
    {
      label: 'Growth Rate',
      value: `${stats?.platformGrowth || 0}%`,
      icon: TrendingUp,
      color: 'bg-orange-500',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div key={index} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">{card.label}</p>
                  <p className="text-2xl font-bold mt-2">{card.value}</p>
                </div>
                <div className={`${card.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={[
              { month: 'Jan', revenue: 4000 },
              { month: 'Feb', revenue: 5200 },
              { month: 'Mar', revenue: 6100 },
              { month: 'Apr', revenue: 7500 },
              { month: 'May', revenue: 8200 },
              { month: 'Jun', revenue: 9100 },
            ]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="revenue" stroke="#3b82f6" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Merchant Distribution */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Merchant Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={[
              { status: 'Active', count: 45 },
              { status: 'Trial', count: 12 },
              { status: 'Suspended', count: 3 },
              { status: 'Expired', count: 5 },
            ]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="status" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {[
            { action: 'New merchant registered', time: '2 hours ago', merchant: 'Acme Corp' },
            { action: 'License expired', time: '5 hours ago', merchant: 'Tech Store' },
            { action: 'Payment received', time: '1 day ago', merchant: 'Fashion Plus' },
            { action: 'License renewed', time: '2 days ago', merchant: 'Coffee Shop' },
          ].map((item, index) => (
            <div key={index} className="flex items-center justify-between py-3 border-b last:border-b-0">
              <div>
                <p className="font-medium">{item.action}</p>
                <p className="text-sm text-gray-600">{item.merchant}</p>
              </div>
              <p className="text-sm text-gray-500">{item.time}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
