import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '@/lib/api';
import { qrImageUrl } from '@/lib/qr';

type Receipt = {
  id: string;
  orderNumber: string;
  businessName?: string;
  address?: string;
  phone?: string;
  channel?: string;
  paymentMethod?: string;
  subtotal: string | number;
  taxAmount: string | number;
  discountAmount?: string | number;
  total: string | number;
  tableLabel?: string | null;
  guestCount?: number | null;
  completedAt?: string;
  items: Array<{
    name?: string;
    quantity: string | number;
    unitPrice: string | number;
    lineTotal: string | number;
  }>;
};

function money(v: string | number | undefined) {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v || 0);
  return `CHF ${n.toFixed(2)}`;
}

export default function ReceiptPage() {
  const { saleId } = useParams();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!saleId) return;
    (async () => {
      try {
        setLoading(true);
        const res = await api.get(`/receipts/${encodeURIComponent(saleId)}`);
        setReceipt(res.data.receipt);
      } catch (e: any) {
        setError(e.response?.data?.error || 'Receipt not found');
      } finally {
        setLoading(false);
      }
    })();
  }, [saleId]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading receipt…</div>;
  }

  if (error || !receipt) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold mb-2">Receipt unavailable</h1>
          <p className="text-gray-600">{error || 'Not found'}</p>
          <p className="text-xs text-gray-400 mt-4 font-mono">{saleId}</p>
        </div>
      </div>
    );
  }

  const url = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow p-6">
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold">{receipt.businessName || 'ManuPOS'}</h1>
          {receipt.address && <p className="text-sm text-gray-600">{receipt.address}</p>}
          {receipt.phone && <p className="text-sm text-gray-600">Tel: {receipt.phone}</p>}
        </div>
        <div className="text-sm space-y-1 border-y py-3 mb-3">
          <p>
            <span className="text-gray-500">Order:</span> {receipt.orderNumber}
          </p>
          {receipt.completedAt && (
            <p>
              <span className="text-gray-500">Date:</span>{' '}
              {new Date(receipt.completedAt).toLocaleString()}
            </p>
          )}
          {receipt.channel && (
            <p>
              <span className="text-gray-500">Channel:</span> {receipt.channel}
            </p>
          )}
          {receipt.tableLabel && (
            <p>
              <span className="text-gray-500">Table:</span> {receipt.tableLabel}
              {receipt.guestCount ? ` · ${receipt.guestCount} PAX` : ''}
            </p>
          )}
        </div>
        <ul className="space-y-2 text-sm mb-4">
          {receipt.items.map((item, idx) => (
            <li key={idx} className="flex justify-between gap-3">
              <span>
                {item.quantity}× {item.name || 'Item'}
              </span>
              <span className="font-medium">{money(item.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <div className="text-sm space-y-1 border-t pt-3">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{money(receipt.subtotal)}</span>
          </div>
          {Number(receipt.discountAmount || 0) > 0 && (
            <div className="flex justify-between">
              <span>Discount</span>
              <span>-{money(receipt.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Tax</span>
            <span>{money(receipt.taxAmount)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold pt-2">
            <span>Total</span>
            <span>{money(receipt.total)}</span>
          </div>
          {receipt.paymentMethod && (
            <p className="text-gray-500 pt-1">Paid: {receipt.paymentMethod.toUpperCase()}</p>
          )}
        </div>
        {url && (
          <div className="text-center mt-6">
            <img src={qrImageUrl(url, 160)} alt="QR" className="mx-auto" width={160} height={160} />
            <p className="text-xs text-gray-500 mt-2">Digital receipt QR</p>
          </div>
        )}
        <button
          className="btn-primary w-full mt-6"
          onClick={() => window.print()}
        >
          Print
        </button>
      </div>
    </div>
  );
}
