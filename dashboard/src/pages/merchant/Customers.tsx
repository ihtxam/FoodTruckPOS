import { FormEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

interface Customer {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  loyaltyPoints?: number | null;
  totalSpent?: string | null;
}

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const response = await api.get('/merchant/customers');
      setCustomers(response.data.customers || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/merchant/customers', { firstName, lastName, email, phone });
      toast.success('Customer added');
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to add customer');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-12">Loading customers...</div>;

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-2xl font-bold mb-2">Customers</h1>
        <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-4">
          <input className="input" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          <input className="input" placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          <input className="input" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Add customer'}
          </button>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">Name</th>
              <th className="py-2">Email</th>
              <th className="py-2">Phone</th>
              <th className="py-2">Points</th>
              <th className="py-2">Spent</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-gray-500">No customers yet.</td>
              </tr>
            )}
            {customers.map((customer) => (
              <tr key={customer.id} className="border-b last:border-0">
                <td className="py-3 font-medium">
                  {[customer.firstName, customer.lastName].filter(Boolean).join(' ') || '-'}
                </td>
                <td className="py-3">{customer.email || '-'}</td>
                <td className="py-3">{customer.phone || '-'}</td>
                <td className="py-3">{customer.loyaltyPoints ?? 0}</td>
                <td className="py-3">CHF {Number(customer.totalSpent || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
