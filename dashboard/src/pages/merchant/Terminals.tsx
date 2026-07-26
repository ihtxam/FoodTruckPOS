import { FormEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

interface Terminal {
  id: string;
  terminalId: string;
  terminalName: string;
  serialNumber?: string | null;
  status: string;
  adyenMerchantAccount?: string | null;
  adyenClientId?: string | null;
  adyenApiKeyMasked?: string | null;
  adyenApiKeySet?: boolean;
}

interface AdyenCreds {
  merchantAccount?: string | null;
  apiKeyMasked?: string | null;
  apiKeySet?: boolean;
  clientId?: string | null;
}

export default function Terminals() {
  const { t } = useI18n();
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [adyen, setAdyen] = useState<AdyenCreds>({});
  const [loading, setLoading] = useState(true);
  const [terminalId, setTerminalId] = useState('');
  const [terminalName, setTerminalName] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);

  const [merchantAccount, setMerchantAccount] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [clientId, setClientId] = useState('');

  const load = async () => {
    try {
      const response = await api.get('/terminals');
      setTerminals(response.data.terminals || []);
      const a = response.data.adyen || {};
      setAdyen(a);
      setMerchantAccount(a.merchantAccount || '');
      setClientId(a.clientId || '');
      setApiKey('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load terminals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onSaveCreds = async (e: FormEvent) => {
    e.preventDefault();
    setSavingCreds(true);
    try {
      const response = await api.put('/terminals/adyen-credentials', {
        adyenMerchantAccount: merchantAccount,
        adyenApiKey: apiKey || undefined,
        adyenClientId: clientId,
      });
      setAdyen(response.data.adyen || {});
      setApiKey('');
      toast.success('Adyen credentials saved');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save credentials');
    } finally {
      setSavingCreds(false);
    }
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/terminals', { terminalId, terminalName, serialNumber });
      toast.success('Adyen terminal registered');
      setTerminalId('');
      setTerminalName('');
      setSerialNumber('');
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to register terminal');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-12">Loading terminals...</div>;

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-2xl font-bold mb-2">{t('adyenCredentials')}</h1>
        <p className="text-gray-600 mb-4">
          Merchant account, API key and client ID used by all store terminals (optional per-terminal
          overrides later).
        </p>
        <form onSubmit={onSaveCreds} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t('merchantAccount')}</label>
            <input
              className="input"
              value={merchantAccount}
              onChange={(e) => setMerchantAccount(e.target.value)}
              placeholder="YourCompanyECOM"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('apiKey')}</label>
            <input
              className="input"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={adyen.apiKeySet ? adyen.apiKeyMasked || '••••' : 'AQE...'}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('clientId')}</label>
            <input
              className="input"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Client key / client ID"
            />
          </div>
          <button type="submit" className="btn-primary md:col-span-3" disabled={savingCreds}>
            {savingCreds ? 'Saving...' : t('save')}
          </button>
        </form>
      </div>

      <div className="card">
        <h2 className="text-xl font-bold mb-2">{t('terminals')}</h2>
        <p className="text-gray-600 mb-4">
          Register store-level Adyen terminals. POS devices pick a terminal for card payments.
        </p>
        <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            className="input"
            placeholder="Adyen terminal ID"
            value={terminalId}
            onChange={(e) => setTerminalId(e.target.value)}
            required
          />
          <input
            className="input"
            placeholder="Display name"
            value={terminalName}
            onChange={(e) => setTerminalName(e.target.value)}
            required
          />
          <input
            className="input"
            placeholder="Serial (optional)"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Add terminal'}
          </button>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">Name</th>
              <th className="py-2">Terminal ID</th>
              <th className="py-2">Serial</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {terminals.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-gray-500">
                  No terminals registered.
                </td>
              </tr>
            )}
            {terminals.map((term) => (
              <tr key={term.id} className="border-b last:border-0">
                <td className="py-3 font-medium">{term.terminalName}</td>
                <td className="py-3 font-mono text-xs">{term.terminalId}</td>
                <td className="py-3">{term.serialNumber || '—'}</td>
                <td className="py-3 capitalize">{term.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
