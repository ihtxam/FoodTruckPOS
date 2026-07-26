import { FormEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import RfidScanInput from '@/components/RfidScanInput';
import { useI18n } from '@/lib/i18n';

interface LoyaltyCard {
  id: string;
  cardNumber: string;
  cardType: string;
  balance?: string | null;
  pointsBalance?: number | null;
  status: string;
}

interface RfidReader {
  id: string;
  name: string;
  readerUid: string;
  connectionType: string;
  status: string;
  lastSeenAt?: string | null;
}

interface ProgramSettings {
  enabled: boolean;
  earnPointsPerChf: number;
  redeemPointsPerChf: number;
  expiryDays: number;
}

export default function Loyalty() {
  const { t } = useI18n();
  const [cards, setCards] = useState<LoyaltyCard[]>([]);
  const [readers, setReaders] = useState<RfidReader[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardType, setCardType] = useState<'loyalty' | 'gift_card'>('gift_card');
  const [initialBalance, setInitialBalance] = useState('0');
  const [rfidCode, setRfidCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [readerName, setReaderName] = useState('');
  const [readerUid, setReaderUid] = useState('');
  const [savingReader, setSavingReader] = useState(false);

  const [program, setProgram] = useState<ProgramSettings>({
    enabled: false,
    earnPointsPerChf: 1,
    redeemPointsPerChf: 100,
    expiryDays: 30,
  });
  const [savingProgram, setSavingProgram] = useState(false);

  const load = async () => {
    try {
      const [cardsRes, readersRes, programRes] = await Promise.all([
        api.get('/loyalty/cards'),
        api.get('/rfid-readers'),
        api.get('/loyalty/program'),
      ]);
      setCards(cardsRes.data.cards || []);
      setReaders(readersRes.data.readers || []);
      if (programRes.data.program) {
        setProgram({
          enabled: !!programRes.data.program.enabled,
          earnPointsPerChf: Number(programRes.data.program.earnPointsPerChf) || 1,
          redeemPointsPerChf: Number(programRes.data.program.redeemPointsPerChf) || 100,
          expiryDays: Number(programRes.data.program.expiryDays) || 30,
        });
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load loyalty');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onSaveProgram = async (e: FormEvent) => {
    e.preventDefault();
    setSavingProgram(true);
    try {
      const res = await api.put('/loyalty/program', {
        enabled: program.enabled,
        earnPointsPerChf: Number(program.earnPointsPerChf) || 1,
        redeemPointsPerChf: Math.floor(Number(program.redeemPointsPerChf) || 100),
        expiryDays: Math.floor(Number(program.expiryDays) || 30),
      });
      if (res.data.program) setProgram(res.data.program);
      toast.success('Fidelity program saved');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save program');
    } finally {
      setSavingProgram(false);
    }
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!rfidCode.trim()) {
      toast.error('Tap an RFID card or enter the card UID');
      return;
    }
    setSaving(true);
    try {
      await api.post('/loyalty/cards', {
        cardType,
        initialBalance: Number(initialBalance) || 0,
        cardNumber: rfidCode.trim(),
        rfidCode: rfidCode.trim(),
      });
      toast.success('Card created from RFID');
      setInitialBalance('0');
      setRfidCode('');
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create card');
    } finally {
      setSaving(false);
    }
  };

  const onRegisterReader = async (e: FormEvent) => {
    e.preventDefault();
    setSavingReader(true);
    try {
      await api.post('/rfid-readers', {
        name: readerName,
        readerUid: readerUid || `HID-${Date.now()}`,
        connectionType: 'hid',
      });
      toast.success('RFID reader registered');
      setReaderName('');
      setReaderUid('');
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to register reader');
    } finally {
      setSavingReader(false);
    }
  };

  if (loading) return <div className="text-center py-12">Loading loyalty…</div>;

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-2xl font-bold mb-2">Fidelity program</h1>
        <p className="text-gray-600 mb-4">
          Online shop points for logged-in customers. RFID gift / loyalty cards below are separate.
        </p>
        <form onSubmit={onSaveProgram} className="space-y-4">
          <label className="flex items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={program.enabled}
              onChange={(e) => setProgram({ ...program, enabled: e.target.checked })}
              className="h-4 w-4"
            />
            Enable fidelity program on the web shop
          </label>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="block text-sm">
              <span className="text-gray-600">Earn points per CHF</span>
              <input
                className="input mt-1"
                type="number"
                min="0.001"
                step="0.001"
                value={program.earnPointsPerChf}
                onChange={(e) =>
                  setProgram({ ...program, earnPointsPerChf: Number(e.target.value) || 0 })
                }
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">Points per CHF 1 discount</span>
              <input
                className="input mt-1"
                type="number"
                min="1"
                step="1"
                value={program.redeemPointsPerChf}
                onChange={(e) =>
                  setProgram({ ...program, redeemPointsPerChf: Number(e.target.value) || 0 })
                }
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">Points expiry (days)</span>
              <input
                className="input mt-1"
                type="number"
                min="1"
                step="1"
                value={program.expiryDays}
                onChange={(e) =>
                  setProgram({ ...program, expiryDays: Number(e.target.value) || 30 })
                }
              />
            </label>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700 space-y-1">
            <p className="font-semibold text-slate-900">How it works</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Earn: floor(paid food subtotal × {program.earnPointsPerChf || 1}) pts — tip &amp;
                delivery excluded
              </li>
              <li>
                Cash redeem: {program.redeemPointsPerChf || 100} pts = CHF 1.00 (floor)
              </li>
              <li>
                Free product: set “Free with points” on a product → unlock when balance ≥ N
              </li>
              <li>Expiry: {program.expiryDays || 30} days, oldest lots first (FIFO)</li>
            </ul>
          </div>

          <button type="submit" className="btn-primary" disabled={savingProgram}>
            {savingProgram ? 'Saving…' : 'Save fidelity program'}
          </button>
        </form>
      </div>

      <div className="card">
        <h2 className="text-xl font-bold mb-2">{t('rfidReader')}</h2>
        <p className="text-gray-600 mb-4">
          Register HID/USB RFID readers. Gift cards are bound to the physical RFID UID from the
          reader.
        </p>
        <form onSubmit={onRegisterReader} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            className="input"
            placeholder="Reader name (Counter 1)"
            value={readerName}
            onChange={(e) => setReaderName(e.target.value)}
            required
          />
          <input
            className="input"
            placeholder="Reader UID / serial"
            value={readerUid}
            onChange={(e) => setReaderUid(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={savingReader}>
            {savingReader ? 'Saving...' : 'Register reader'}
          </button>
        </form>
        {readers.length > 0 && (
          <ul className="mt-4 text-sm space-y-1">
            {readers.map((r) => (
              <li key={r.id} className="flex justify-between border-b py-2">
                <span>
                  {r.name} · <span className="font-mono text-xs">{r.readerUid}</span> · {r.connectionType}
                </span>
                <span className="capitalize text-gray-500">{r.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2 className="text-xl font-bold mb-2">{t('loyalty')}</h2>
        <p className="text-gray-600 mb-4">
          Issue gift / loyalty cards by tapping the RFID card on a connected reader.
        </p>
        <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            className="input"
            value={cardType}
            onChange={(e) => setCardType(e.target.value as 'loyalty' | 'gift_card')}
          >
            <option value="gift_card">{t('giftCard')}</option>
            <option value="loyalty">{t('loyaltyCard')}</option>
          </select>
          <RfidScanInput
            value={rfidCode}
            onChange={setRfidCode}
            placeholder={t('tapCard')}
            autoFocus
          />
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            placeholder="Initial balance"
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Creating...' : 'Create from RFID'}
          </button>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">RFID / card number</th>
              <th className="py-2">Type</th>
              <th className="py-2">Balance</th>
              <th className="py-2">Points</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {cards.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-gray-500">
                  No cards yet. Tap an RFID card to issue one.
                </td>
              </tr>
            )}
            {cards.map((card) => (
              <tr key={card.id} className="border-b last:border-0">
                <td className="py-3 font-mono text-xs">{card.cardNumber}</td>
                <td className="py-3 capitalize">{card.cardType.replace('_', ' ')}</td>
                <td className="py-3">CHF {Number(card.balance || 0).toFixed(2)}</td>
                <td className="py-3">{card.pointsBalance ?? 0}</td>
                <td className="py-3 capitalize">{card.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
