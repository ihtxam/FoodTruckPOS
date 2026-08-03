import { FormEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import RfidScanInput from '@/components/RfidScanInput';
import { useI18n } from '@/lib/i18n';

interface GiftCardSettings {
  enabled: boolean;
  presetDenominations: number[];
  minAmount: number;
  maxAmount: number;
  reloadEnabled: boolean;
  customAmountEnabled: boolean;
}

interface GiftCard {
  id: string;
  cardNumber: string;
  cardMediaType: string;
  balance?: string | null;
  pointsBalance?: number | null;
  status: string;
  membershipEnabled?: boolean;
  holderName?: string | null;
  holderEmail?: string | null;
  holderPhone?: string | null;
  customer?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
}

interface RfidReader {
  id: string;
  name: string;
  readerUid: string;
  connectionType: string;
  status: string;
}

interface ProgramSettings {
  enabled: boolean;
  earnPointsPerChf: number;
  redeemPointsPerChf: number;
  expiryDays: number;
}

type MainTab = 'gift' | 'fidelity' | 'rfid';
type GiftTab = 'settings' | 'cards';

const DEFAULT_GC: GiftCardSettings = {
  enabled: false,
  presetDenominations: [20, 50, 100, 150],
  minAmount: 5,
  maxAmount: 500,
  reloadEnabled: true,
  customAmountEnabled: true,
};

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-800">{label}</div>
        {hint ? <p className="text-xs text-slate-500 mt-0.5">{hint}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          checked ? 'bg-teal-500' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  );
}

export default function Loyalty() {
  const { t } = useI18n();
  const [mainTab, setMainTab] = useState<MainTab>('gift');
  const [giftTab, setGiftTab] = useState<GiftTab>('settings');
  const [gcSettings, setGcSettings] = useState<GiftCardSettings>(DEFAULT_GC);
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [readers, setReaders] = useState<RfidReader[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  const [newDenom, setNewDenom] = useState('');
  const [editingDenomIdx, setEditingDenomIdx] = useState<number | null>(null);

  const [issueRfid, setIssueRfid] = useState('');
  const [issueBalance, setIssueBalance] = useState('0');
  const [issueMembership, setIssueMembership] = useState(false);
  const [issueName, setIssueName] = useState('');
  const [issueEmail, setIssueEmail] = useState('');
  const [issuePhone, setIssuePhone] = useState('');
  const [savingCard, setSavingCard] = useState(false);

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
      const [settingsRes, cardsRes, readersRes, programRes] = await Promise.all([
        api.get('/gift-cards/settings'),
        api.get('/gift-cards', { params: { limit: 100 } }),
        api.get('/rfid-readers'),
        api.get('/loyalty/program'),
      ]);
      if (settingsRes.data.settings) setGcSettings(settingsRes.data.settings);
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
      toast.error(error.response?.data?.error || t('giftCardLoadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const saveGcSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await api.put('/gift-cards/settings', gcSettings);
      if (res.data.settings) setGcSettings(res.data.settings);
      toast.success(t('giftCardSettingsSaved'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('giftCardSettingsSaveFailed'));
    } finally {
      setSavingSettings(false);
    }
  };

  const addOrEditDenom = () => {
    const n = Number(newDenom);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error(t('giftCardInvalidDenom'));
      return;
    }
    if (n < gcSettings.minAmount || n > gcSettings.maxAmount) {
      toast.error(
        t('giftCardDenomOutOfRange')
          .replace('{min}', gcSettings.minAmount.toFixed(2))
          .replace('{max}', gcSettings.maxAmount.toFixed(2))
      );
      return;
    }
    const next = [...gcSettings.presetDenominations];
    if (editingDenomIdx != null) {
      next[editingDenomIdx] = n;
    } else {
      if (next.includes(n)) {
        toast.error(t('giftCardDenomExists'));
        return;
      }
      next.push(n);
    }
    next.sort((a, b) => a - b);
    setGcSettings({ ...gcSettings, presetDenominations: next });
    setNewDenom('');
    setEditingDenomIdx(null);
  };

  const onIssueCard = async (e: FormEvent) => {
    e.preventDefault();
    if (!issueRfid.trim()) {
      toast.error(t('giftCardTapRequired'));
      return;
    }
    setSavingCard(true);
    try {
      const res = await api.post('/gift-cards', {
        cardNumber: issueRfid.trim(),
        cardMediaType: 'physical',
        initialBalance: Number(issueBalance) || 0,
        membershipEnabled: issueMembership,
        holderName: issueMembership ? issueName : undefined,
        holderEmail: issueMembership ? issueEmail : undefined,
        holderPhone: issueMembership ? issuePhone : undefined,
      });
      if (issueMembership && res.data.card?.id && (issueName || issueEmail || issuePhone)) {
        await api.post(`/gift-cards/${res.data.card.id}/membership`, {
          name: issueName,
          email: issueEmail,
          phone: issuePhone,
        });
      }
      toast.success(t('giftCardCreated'));
      setIssueRfid('');
      setIssueBalance('0');
      setIssueMembership(false);
      setIssueName('');
      setIssueEmail('');
      setIssuePhone('');
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('giftCardCreateFailed'));
    } finally {
      setSavingCard(false);
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
      toast.success(t('rfidReaderRegistered'));
      setReaderName('');
      setReaderUid('');
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('rfidReaderRegisterFailed'));
    } finally {
      setSavingReader(false);
    }
  };

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
      toast.success(t('fidelityProgramSaved'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('fidelityProgramSaveFailed'));
    } finally {
      setSavingProgram(false);
    }
  };

  const toggleCardStatus = async (card: GiftCard) => {
    try {
      if (card.status === 'active') {
        await api.post(`/gift-cards/${card.id}/suspend`, { reason: 'Merchant suspended' });
      } else {
        await api.post(`/gift-cards/${card.id}/reactivate`);
      }
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('giftCardStatusFailed'));
    }
  };

  if (loading) return <div className="text-center py-12">{t('loading')}…</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {(
          [
            ['gift', t('giftCard')],
            ['fidelity', t('fidelityProgram')],
            ['rfid', t('rfidReader')],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMainTab(id)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg ${
              mainTab === id
                ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-500'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mainTab === 'gift' && (
        <div className="card">
          <h1 className="text-2xl font-bold mb-4">{t('giftCard')}</h1>

          <div className="flex gap-6 border-b border-slate-200 mb-6">
            <button
              type="button"
              onClick={() => setGiftTab('settings')}
              className={`pb-2 text-sm font-semibold ${
                giftTab === 'settings'
                  ? 'text-teal-600 border-b-2 border-teal-500'
                  : 'text-slate-500'
              }`}
            >
              {t('giftCardGeneralSettings')}
            </button>
            <button
              type="button"
              onClick={() => setGiftTab('cards')}
              className={`pb-2 text-sm font-semibold ${
                giftTab === 'cards'
                  ? 'text-teal-600 border-b-2 border-teal-500'
                  : 'text-slate-500'
              }`}
            >
              {t('giftCardManagement')}
            </button>
          </div>

          {giftTab === 'settings' && (
            <div className="max-w-xl space-y-1">
              <Toggle
                checked={gcSettings.enabled}
                onChange={(v) => setGcSettings({ ...gcSettings, enabled: v })}
                label={t('giftCard')}
                hint={t('giftCardEnableHint')}
              />

              <div className="py-4 border-b border-slate-100">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <label className="text-sm font-medium text-slate-800">
                    {t('giftCardPresetDenomination')} <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={addOrEditDenom}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                    title={t('add')}
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <div className="flex gap-2 mb-3">
                  <input
                    className="input"
                    type="number"
                    min={gcSettings.minAmount}
                    max={gcSettings.maxAmount}
                    step="0.01"
                    placeholder="CHF"
                    value={newDenom}
                    onChange={(e) => setNewDenom(e.target.value)}
                  />
                  {editingDenomIdx != null && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setEditingDenomIdx(null);
                        setNewDenom('');
                      }}
                    >
                      {t('cancel')}
                    </button>
                  )}
                </div>
                <p className="text-xs font-medium text-slate-500 mb-2">
                  {t('giftCardDenominationList')}
                </p>
                <ul className="space-y-2">
                  {gcSettings.presetDenominations.map((d, i) => (
                    <li
                      key={`${d}-${i}`}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <span className="font-medium">CHF {d.toFixed(2)}</span>
                      <span className="flex gap-2 text-slate-500">
                        <button
                          type="button"
                          onClick={() => {
                            setGcSettings({
                              ...gcSettings,
                              presetDenominations: gcSettings.presetDenominations.filter(
                                (_, idx) => idx !== i
                              ),
                            });
                          }}
                          className="hover:text-red-600"
                          aria-label={t('delete')}
                        >
                          <Trash2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDenomIdx(i);
                            setNewDenom(String(d));
                          }}
                          className="hover:text-teal-600"
                          aria-label={t('edit')}
                        >
                          <Pencil size={16} />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-slate-500">
                  {t('giftCardStoredValueRange')
                    .replace('{min}', gcSettings.minAmount.toFixed(2))
                    .replace('{max}', gcSettings.maxAmount.toFixed(2))}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="text-xs text-slate-600">
                    {t('giftCardMinAmount')}
                    <input
                      className="input mt-1"
                      type="number"
                      step="0.01"
                      value={gcSettings.minAmount}
                      onChange={(e) =>
                        setGcSettings({
                          ...gcSettings,
                          minAmount: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </label>
                  <label className="text-xs text-slate-600">
                    {t('giftCardMaxAmount')}
                    <input
                      className="input mt-1"
                      type="number"
                      step="0.01"
                      value={gcSettings.maxAmount}
                      onChange={(e) =>
                        setGcSettings({
                          ...gcSettings,
                          maxAmount: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </label>
                </div>
              </div>

              <Toggle
                checked={gcSettings.reloadEnabled}
                onChange={(v) => setGcSettings({ ...gcSettings, reloadEnabled: v })}
                label={t('giftCardReload')}
                hint={t('giftCardReloadHint')}
              />
              <Toggle
                checked={gcSettings.customAmountEnabled}
                onChange={(v) => setGcSettings({ ...gcSettings, customAmountEnabled: v })}
                label={t('giftCardCustomAmount')}
                hint={t('giftCardCustomAmountHint')}
              />

              <div className="pt-4">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={savingSettings}
                  onClick={() => void saveGcSettings()}
                >
                  {savingSettings ? t('saving') : t('save')}
                </button>
              </div>
            </div>
          )}

          {giftTab === 'cards' && (
            <div className="space-y-6">
              <form onSubmit={onIssueCard} className="space-y-3 rounded-xl border border-slate-200 p-4">
                <h2 className="font-semibold text-slate-900">{t('giftCardIssue')}</h2>
                <p className="text-sm text-slate-500">{t('giftCardIssueHint')}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <RfidScanInput
                    value={issueRfid}
                    onChange={setIssueRfid}
                    placeholder={t('tapCard')}
                    autoFocus
                  />
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={t('giftCardInitialBalance')}
                    value={issueBalance}
                    onChange={(e) => setIssueBalance(e.target.value)}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={issueMembership}
                    onChange={(e) => setIssueMembership(e.target.checked)}
                  />
                  {t('giftCardAttachMembership')}
                </label>
                {issueMembership && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      className="input"
                      placeholder={t('name')}
                      value={issueName}
                      onChange={(e) => setIssueName(e.target.value)}
                    />
                    <input
                      className="input"
                      type="email"
                      placeholder={t('email')}
                      value={issueEmail}
                      onChange={(e) => setIssueEmail(e.target.value)}
                    />
                    <input
                      className="input"
                      placeholder={t('phone')}
                      value={issuePhone}
                      onChange={(e) => setIssuePhone(e.target.value)}
                    />
                  </div>
                )}
                <button type="submit" className="btn-primary" disabled={savingCard}>
                  {savingCard ? t('creating') : t('giftCardCreateFromRfid')}
                </button>
              </form>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2">{t('giftCardNumber')}</th>
                      <th className="py-2">{t('type')}</th>
                      <th className="py-2">{t('balance')}</th>
                      <th className="py-2">{t('membership')}</th>
                      <th className="py-2">{t('points')}</th>
                      <th className="py-2">{t('status')}</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {cards.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-6 text-gray-500">
                          {t('giftCardNoneYet')}
                        </td>
                      </tr>
                    )}
                    {cards.map((card) => {
                      const memberLabel = card.membershipEnabled
                        ? card.holderName ||
                          [card.customer?.firstName, card.customer?.lastName]
                            .filter(Boolean)
                            .join(' ') ||
                          card.holderEmail ||
                          '—'
                        : '—';
                      return (
                        <tr key={card.id} className="border-b last:border-0">
                          <td className="py-3 font-mono text-xs">{card.cardNumber}</td>
                          <td className="py-3 capitalize">
                            {card.cardMediaType === 'e_card' ? t('giftCardEcard') : t('giftCardPhysical')}
                          </td>
                          <td className="py-3">CHF {Number(card.balance || 0).toFixed(2)}</td>
                          <td className="py-3">{memberLabel}</td>
                          <td className="py-3">{card.pointsBalance ?? 0}</td>
                          <td className="py-3 capitalize">{card.status}</td>
                          <td className="py-3 text-right">
                            <button
                              type="button"
                              className="text-xs font-semibold text-teal-700 hover:underline"
                              onClick={() => void toggleCardStatus(card)}
                            >
                              {card.status === 'active' ? t('suspend') : t('reactivate')}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {mainTab === 'fidelity' && (
        <div className="card">
          <h1 className="text-2xl font-bold mb-2">{t('fidelityProgram')}</h1>
          <p className="text-gray-600 mb-4">{t('fidelityProgramHint')}</p>
          <form onSubmit={onSaveProgram} className="space-y-4">
            <label className="flex items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={program.enabled}
                onChange={(e) => setProgram({ ...program, enabled: e.target.checked })}
                className="h-4 w-4"
              />
              {t('fidelityEnableShop')}
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="block text-sm">
                <span className="text-gray-600">{t('earnPointsPerChf')}</span>
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
                <span className="text-gray-600">{t('pointsPerChfDiscount')}</span>
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
                <span className="text-gray-600">{t('pointsExpiryDays')}</span>
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
            <button type="submit" className="btn-primary" disabled={savingProgram}>
              {savingProgram ? t('saving') : t('save')}
            </button>
          </form>
        </div>
      )}

      {mainTab === 'rfid' && (
        <div className="card">
          <h2 className="text-xl font-bold mb-2">{t('rfidReader')}</h2>
          <p className="text-gray-600 mb-4">{t('rfidReaderHint')}</p>
          <form onSubmit={onRegisterReader} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              className="input"
              placeholder={t('rfidReaderNamePlaceholder')}
              value={readerName}
              onChange={(e) => setReaderName(e.target.value)}
              required
            />
            <input
              className="input"
              placeholder={t('rfidReaderUidPlaceholder')}
              value={readerUid}
              onChange={(e) => setReaderUid(e.target.value)}
            />
            <button type="submit" className="btn-primary" disabled={savingReader}>
              {savingReader ? t('saving') : t('registerReader')}
            </button>
          </form>
          {readers.length > 0 && (
            <ul className="mt-4 text-sm space-y-1">
              {readers.map((r) => (
                <li key={r.id} className="flex justify-between border-b py-2">
                  <span>
                    {r.name} · <span className="font-mono text-xs">{r.readerUid}</span> ·{' '}
                    {r.connectionType}
                  </span>
                  <span className="capitalize text-gray-500">{r.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
