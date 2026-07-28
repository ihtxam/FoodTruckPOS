import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Banknote,
  CreditCard,
  MoreHorizontal,
  PanelLeft,
  Printer,
  RefreshCw,
  Search,
  ShoppingBag,
  X,
} from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { roundMoney2, roundTo005, roundingAdjustment } from '@/lib/money';
import {
  generateWebPosReceiptText,
  textToEscPos,
  uint8ToBase64,
  type WebPosReceipt,
} from '@/lib/webpos-receipt';
import {
  browserPrintText,
  isPrintAgentAvailable,
  listAgentPrinters,
  printViaAgent,
  type AgentPrinter,
} from '@/lib/print-agent';
import { buildReceiptUrl, qrImageUrl } from '@/lib/qr';
import {
  lineSignature,
  type ShopComboSelection,
  type ShopSelectedExtra,
} from '@/lib/shop-cart';
import ShopProductModifiersModal, {
  productHasModifiers,
  type ShopModifierGroup,
  type ShopProductForModifiers,
} from '@/components/shop/ShopProductModifiersModal';
import ShopComboWizard, {
  productHasComboSlots,
  type ComboSlot,
  type ShopComboProduct,
} from '@/components/shop/ShopComboWizard';

type Channel = 'takeaway' | 'dine_in' | 'delivery';

type Product = {
  id: string;
  name: string;
  price: number | string;
  categoryId?: string | null;
  isTaxable?: boolean;
  stock?: number;
  productType?: string;
  allowExtras?: boolean;
  extras?: Array<{ id: string; name: string; price: number; isDefault?: boolean }>;
  modifierGroups?: ShopModifierGroup[];
  comboSlots?: ComboSlot[];
};

type Category = { id: string; name: string };

type CartLine = {
  lineId: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  taxable: boolean;
  selectedExtras: ShopSelectedExtra[];
  comboSelections: ShopComboSelection[];
};

function lineExtrasLabel(l: CartLine) {
  const parts: string[] = [];
  if (l.comboSelections.length) {
    parts.push(
      ...l.comboSelections.map((c) =>
        c.selectedExtras?.length
          ? `${c.productName} (${c.selectedExtras.map((e) => e.name).join(', ')})`
          : c.productName
      )
    );
  }
  if (!l.comboSelections.length && l.selectedExtras.length) {
    parts.push(...l.selectedExtras.map((e) => e.name));
  } else if (l.comboSelections.length && l.selectedExtras.length) {
    parts.push(...l.selectedExtras.map((e) => e.name));
  }
  return parts.join(' · ');
}

type SaleRecord = {
  id: string;
  total: number;
  paymentMethod: string;
  channel: Channel;
  completedAt: number;
  synced: boolean;
};

const CHANNELS: { id: Channel; label: string }[] = [
  { id: 'takeaway', label: 'Take away' },
  { id: 'dine_in', label: 'Dine in' },
  { id: 'delivery', label: 'Delivery' },
];

function money(n: number) {
  return `CHF ${n.toFixed(2)}`;
}

export default function WebPos({ appMode = true }: { appMode?: boolean }) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [merchant, setMerchant] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryId, setCategoryId] = useState<string | 'all'>('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [channel, setChannel] = useState<Channel>('takeaway');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [busy, setBusy] = useState(false);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [agentOk, setAgentOk] = useState(false);
  const [printers, setPrinters] = useState<AgentPrinter[]>([]);
  const [printerName, setPrinterName] = useState(() => localStorage.getItem('manupos_webpos_printer') || '');
  const [autoPrint, setAutoPrint] = useState(() => localStorage.getItem('manupos_webpos_autoprint') !== '0');
  const [lastReceipt, setLastReceipt] = useState<string>('');
  const [lastReceiptUrl, setLastReceiptUrl] = useState<string>('');
  const [pendingProduct, setPendingProduct] = useState<ShopProductForModifiers | null>(null);
  const [pendingCombo, setPendingCombo] = useState<ShopComboProduct | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  const cartCount = useMemo(() => cart.reduce((n, l) => n + l.quantity, 0), [cart]);

  useEffect(() => {
    if (!settingsOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [settingsOpen]);

  const showPanelMenus = useCallback(() => {
    window.dispatchEvent(new CustomEvent('webpos:show-panel'));
  }, []);

  const enterPosApp = useCallback(() => {
    window.dispatchEvent(new CustomEvent('webpos:enter-app'));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (pendingProduct) {
        e.preventDefault();
        setPendingProduct(null);
        return;
      }
      if (pendingCombo) {
        e.preventDefault();
        setPendingCombo(null);
        return;
      }
      if (settingsOpen) {
        e.preventDefault();
        setSettingsOpen(false);
        return;
      }
      if (mobileCartOpen) {
        e.preventDefault();
        setMobileCartOpen(false);
        return;
      }
      if (appMode) {
        e.preventDefault();
        showPanelMenus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [appMode, pendingProduct, pendingCombo, settingsOpen, mobileCartOpen, showPanelMenus]);

  const taxRate = useMemo(() => {
    if (!merchant) return 8.1;
    if (channel === 'dine_in') return Number(merchant.taxDineInRate ?? merchant.vatRate ?? 8.1);
    if (channel === 'delivery') return Number(merchant.taxDeliveryRate ?? merchant.vatRate ?? 8.1);
    return Number(merchant.taxTakeawayRate ?? merchant.vatRate ?? 8.1);
  }, [merchant, channel]);

  const totals = useMemo(() => {
    const subtotal = roundMoney2(cart.reduce((s, l) => s + l.lineTotal, 0));
    const taxable = roundMoney2(cart.filter((l) => l.taxable).reduce((s, l) => s + l.lineTotal, 0));
    const tax = roundMoney2((taxable * taxRate) / 100);
    const raw = subtotal + tax;
    const rounding = roundingAdjustment(raw);
    const total = roundTo005(raw);
    return { subtotal, tax, rounding, total };
  }, [cart, taxRate]);

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryId !== 'all' && p.categoryId !== categoryId) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, categoryId, search]);

  const refreshAgent = useCallback(async () => {
    const ok = await isPrintAgentAvailable();
    setAgentOk(ok);
    if (!ok) {
      setPrinters([]);
      return;
    }
    try {
      const list = await listAgentPrinters();
      setPrinters(list);
      if (!printerName && list.length) {
        const def = list.find((p) => p.isDefault) || list[0];
        setPrinterName(def.name);
      }
    } catch {
      setPrinters([]);
    }
  }, [printerName]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, catRes, prodRes] = await Promise.all([
        api.get('/merchant/settings'),
        api.get('/merchant/categories'),
        api.get('/merchant/products', { params: { limit: 500 } }),
      ]);
      setMerchant(settingsRes.data.settings || settingsRes.data.merchant);
      setCategories(catRes.data.categories || catRes.data || []);
      const prods = prodRes.data.products || prodRes.data || [];
      setProducts(
        prods.map((p: any) => ({
          ...p,
          price: Number(p.price),
        }))
      );
      await refreshAgent();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to load WebPOS catalog');
    } finally {
      setLoading(false);
    }
  }, [refreshAgent]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    localStorage.setItem('manupos_webpos_printer', printerName || '');
  }, [printerName]);

  useEffect(() => {
    localStorage.setItem('manupos_webpos_autoprint', autoPrint ? '1' : '0');
  }, [autoPrint]);

  const addConfiguredProduct = (
    p: Product,
    unitPrice: number,
    selectedExtras: ShopSelectedExtra[] = [],
    comboSelections: ShopComboSelection[] = []
  ) => {
    const price = roundMoney2(unitPrice);
    const sig = lineSignature(selectedExtras, comboSelections);
    setCart((prev) => {
      const existing = prev.find(
        (l) =>
          l.productId === p.id &&
          lineSignature(l.selectedExtras, l.comboSelections) === sig
      );
      if (existing) {
        const quantity = existing.quantity + 1;
        return prev.map((l) =>
          l.lineId === existing.lineId
            ? { ...l, quantity, lineTotal: roundMoney2(price * quantity) }
            : l
        );
      }
      return [
        ...prev,
        {
          lineId: `${p.id}-${Date.now()}-${sig || 'plain'}`,
          productId: p.id,
          name: p.name,
          quantity: 1,
          unitPrice: price,
          lineTotal: price,
          taxable: p.isTaxable !== false,
          selectedExtras,
          comboSelections,
        },
      ];
    });
  };

  const onProductClick = (p: Product) => {
    if (productHasComboSlots(p)) {
      if (!p.comboSlots?.length) {
        toast.error('This combo has no available options');
        return;
      }
      setPendingCombo({
        id: p.id,
        name: p.name,
        price: Number(p.price) || 0,
        allowExtras: p.allowExtras,
        extras: p.extras,
        modifierGroups: p.modifierGroups,
        comboSlots: p.comboSlots || [],
      });
      return;
    }
    if (productHasModifiers(p as ShopProductForModifiers)) {
      setPendingProduct({
        id: p.id,
        name: p.name,
        price: Number(p.price) || 0,
        allowExtras: p.allowExtras,
        extras: p.extras,
        modifierGroups: p.modifierGroups,
      });
      return;
    }
    addConfiguredProduct(p, Number(p.price) || 0, [], []);
  };

  const setQty = (lineId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((l) => l.lineId !== lineId));
      return;
    }
    setCart((prev) =>
      prev.map((l) =>
        l.lineId === lineId
          ? { ...l, quantity, lineTotal: roundMoney2(l.unitPrice * quantity) }
          : l
      )
    );
  };

  const printReceipt = async (receiptText: string, receiptUrl?: string) => {
    const escpos = textToEscPos(receiptText, receiptUrl);
    const dataBase64 = uint8ToBase64(escpos);
    if (agentOk) {
      await printViaAgent({ printerName: printerName || undefined, dataBase64, text: receiptText });
      toast.success(printerName ? `Printed on ${printerName}` : 'Sent to printer');
      return;
    }
    browserPrintText(receiptText, receiptUrl ? qrImageUrl(receiptUrl, 160) : undefined);
    toast('Print agent offline — used browser print', { icon: '🖨️' });
  };

  const completeSale = async () => {
    if (!cart.length || busy) return;
    setBusy(true);
    try {
      const clientId = `webpos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const sale = {
        clientId,
        paymentMethod,
        paymentStatus: 'completed',
        subtotal: totals.subtotal,
        taxAmount: totals.tax,
        discountAmount: 0,
        total: totals.total,
        fulfillmentChannel: channel,
        completedAt: Date.now(),
        notes: totals.rounding ? `Rounding ${totals.rounding > 0 ? '+' : ''}${totals.rounding.toFixed(2)}` : undefined,
        items: cart.map((l) => ({
          productClientId: l.productId,
          productId: l.productId,
          productName: l.name,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          totalPrice: l.lineTotal,
          taxAmount: l.taxable ? roundMoney2((l.lineTotal * taxRate) / 100) : 0,
          selectedExtras: l.selectedExtras.map((e) => ({
            id: e.id,
            name: e.name,
            price: e.price,
          })),
          comboSelections: l.comboSelections.map((c) => ({
            slotId: c.slotId,
            slotName: c.slotName,
            productId: c.productId,
            productName: c.productName,
            extraPrice: c.extraPrice,
            selectedExtras: (c.selectedExtras || []).map((e) => ({
              id: e.id,
              name: e.name,
              price: e.price,
            })),
          })),
          isOpenPrice: false,
        })),
      };

      await api.post('/sync/push-sales', { sales: [sale] });

      const receiptUrl = buildReceiptUrl(clientId);
      const receiptPayload: WebPosReceipt = {
        businessName: merchant?.name || 'ManuPOS',
        address: [merchant?.address, merchant?.city].filter(Boolean).join(', '),
        phone: merchant?.phone || undefined,
        id: clientId,
        completedAt: Date.now(),
        channel,
        paymentMethod,
        items: cart.map((l) => {
          const detail = lineExtrasLabel(l);
          return {
            name: detail ? `${l.name} (${detail})` : l.name,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            lineTotal: l.lineTotal,
          };
        }),
        subtotal: totals.subtotal,
        discount: 0,
        taxAmount: totals.tax,
        taxRate,
        rounding: totals.rounding,
        total: totals.total,
        receiptUrl,
        includeQr: true,
      };
      const receiptText = generateWebPosReceiptText(receiptPayload);
      setLastReceipt(receiptText);
      setLastReceiptUrl(receiptUrl);
      setSales((prev) => [
        {
          id: clientId,
          total: totals.total,
          paymentMethod,
          channel,
          completedAt: Date.now(),
          synced: true,
        },
        ...prev,
      ].slice(0, 30));
      setCart([]);
      toast.success(`Sale complete · ${money(totals.total)}`);
      if (autoPrint) {
        try {
          await printReceipt(receiptText, receiptUrl);
        } catch (e: any) {
          toast.error(e.message || 'Print failed');
        }
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || 'Sale failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
        Loading WebPOS…
      </div>
    );
  }

  const renderCartPanel = (opts?: { showClose?: boolean }) => (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg-elevated)]">
      <div className="shrink-0 border-b border-[var(--border)] px-3 pt-3 pb-2 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold tracking-tight">Current order</p>
            <p className="text-[11px] text-[var(--text-muted)]">
              {cartCount === 0 ? 'No items yet' : `${cartCount} item${cartCount === 1 ? '' : 's'}`}
            </p>
          </div>
          {opts?.showClose ? (
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)]"
              aria-label="Close cart"
              onClick={() => setMobileCartOpen(false)}
            >
              <X size={18} />
            </button>
          ) : null}
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-[var(--bg-muted)] p-1">
          {CHANNELS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setChannel(c.id)}
              className={`rounded-lg py-2 text-xs font-semibold transition ${
                channel === c.id
                  ? 'bg-[var(--bg-elevated)] text-[var(--text)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 py-2 space-y-2">
        {cart.length === 0 ? (
          <div className="flex h-full min-h-[8rem] flex-col items-center justify-center gap-2 text-center px-4">
            <ShoppingBag className="text-[var(--text-muted)] opacity-50" size={28} />
            <p className="text-sm text-[var(--text-muted)]">Tap products to add them</p>
          </div>
        ) : (
          cart.map((l) => (
            <div
              key={l.lineId}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/40 px-2.5 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug">{l.name}</p>
                  {!!lineExtrasLabel(l) && (
                    <p className="mt-0.5 text-[11px] text-[var(--text-muted)] leading-snug">
                      {lineExtrasLabel(l)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--danger)]"
                  aria-label="Remove item"
                  onClick={() => setQty(l.lineId, 0)}
                >
                  <X size={14} />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]">
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center text-base font-semibold"
                    onClick={() => setQty(l.lineId, l.quantity - 1)}
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-bold tabular-nums">{l.quantity}</span>
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center text-base font-semibold"
                    onClick={() => setQty(l.lineId, l.quantity + 1)}
                  >
                    +
                  </button>
                </div>
                <p className="text-sm font-semibold tabular-nums">{money(l.lineTotal)}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-3 space-y-2.5">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-[var(--text-muted)]">
            <span>Subtotal</span>
            <span className="tabular-nums">{money(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-[var(--text-muted)]">
            <span>Tax ({taxRate}%)</span>
            <span className="tabular-nums">{money(totals.tax)}</span>
          </div>
          {totals.rounding !== 0 && (
            <div className="flex justify-between text-[var(--text-muted)]">
              <span>Rounding</span>
              <span className="tabular-nums">
                {totals.rounding > 0 ? '+' : ''}
                {money(totals.rounding)}
              </span>
            </div>
          )}
          <div className="flex items-end justify-between pt-1">
            <span className="text-base font-semibold">Total</span>
            <span className="text-2xl font-bold tracking-tight tabular-nums">{money(totals.total)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPaymentMethod('cash')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-semibold transition ${
              paymentMethod === 'cash'
                ? 'border-stone-900 bg-stone-900 text-white'
                : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text)]'
            }`}
          >
            <Banknote size={16} />
            Cash
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod('card')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-semibold transition ${
              paymentMethod === 'card'
                ? 'border-stone-900 bg-stone-900 text-white'
                : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text)]'
            }`}
          >
            <CreditCard size={16} />
            Card
          </button>
        </div>

        <button
          type="button"
          disabled={!cart.length || busy}
          onClick={() => void completeSale()}
          className="w-full rounded-xl bg-teal-700 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Processing…' : cart.length ? `Charge ${money(totals.total)}` : 'Add items to charge'}
        </button>

        {lastReceipt ? (
          <button
            type="button"
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] py-2 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-muted)]"
            onClick={() =>
              void printReceipt(lastReceipt, lastReceiptUrl || undefined).catch((e) =>
                toast.error(e.message)
              )
            }
          >
            <Printer size={15} />
            Re-print last receipt
          </button>
        ) : null}

        {sales.length > 0 ? (
          <div className="border-t border-[var(--border)] pt-2">
            <button
              type="button"
              className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]"
              onClick={() => setRecentOpen((v) => !v)}
            >
              Recent sales
              <span>{recentOpen ? '−' : '+'}</span>
            </button>
            {recentOpen ? (
              <div className="mt-1.5 max-h-28 overflow-auto space-y-1">
                {sales.slice(0, 8).map((s) => (
                  <div key={s.id} className="flex justify-between text-xs">
                    <span className="text-[var(--text-muted)]">
                      {new Date(s.completedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="font-medium tabular-nums">
                      {money(s.total)} · {s.paymentMethod}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div
      className={`webpos-shell ${
        appMode ? 'h-dvh' : '-m-3 sm:-m-4 h-[calc(100dvh-4rem)]'
      } flex flex-col bg-[var(--bg)]`}
    >
      {/* Compact top bar — selling chrome only */}
      <header className="relative z-20 flex shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 sm:px-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-base font-bold tracking-tight sm:text-lg">WebPOS</h1>
            <span
              className={`hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                agentOk
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${agentOk ? 'bg-emerald-500' : 'bg-amber-500'}`}
              />
              {agentOk ? 'Printer ready' : 'Browser print'}
            </span>
          </div>
          <p className="truncate text-[11px] text-[var(--text-muted)]">
            {merchant?.name || 'Store'}
            {appMode ? ` · ${t('webPosEscHint')}` : ''}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[var(--border)] px-2.5 text-sm font-medium lg:hidden"
            onClick={() => setMobileCartOpen(true)}
          >
            <ShoppingBag size={16} />
            <span className="tabular-nums">{cartCount}</span>
          </button>

          <div className="relative" ref={settingsRef}>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] hover:bg-[var(--bg-muted)]"
              aria-label="Printer & tools"
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen((v) => !v)}
            >
              <MoreHorizontal size={18} />
            </button>
            {settingsOpen ? (
              <div className="absolute right-0 top-[calc(100%+6px)] w-[min(20rem,calc(100vw-1.5rem))] rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 shadow-lg space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  <Printer size={14} />
                  Printing
                </div>
                <label className="block space-y-1 text-sm">
                  <span className="text-xs text-[var(--text-muted)]">Printer</span>
                  <select
                    className="input"
                    value={printerName}
                    onChange={(e) => setPrinterName(e.target.value)}
                    disabled={!agentOk}
                  >
                    <option value="">Default printer</option>
                    {printers.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                        {p.isDefault ? ' (default)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={autoPrint}
                    onChange={(e) => setAutoPrint(e.target.checked)}
                  />
                  Auto-print after sale
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  <button
                    type="button"
                    className="btn-secondary justify-start text-sm"
                    onClick={() => {
                      void refreshAgent();
                      toast.success('Printers refreshed');
                    }}
                  >
                    <RefreshCw size={14} />
                    Refresh printers
                  </button>
                  <button
                    type="button"
                    className="btn-secondary justify-start text-sm"
                    onClick={() => {
                      void load();
                      setSettingsOpen(false);
                    }}
                  >
                    <RefreshCw size={14} />
                    Reload catalog
                  </button>
                </div>
                <p className="text-[11px] leading-snug text-[var(--text-muted)]">
                  {agentOk
                    ? 'Print agent online — receipts go to the selected printer.'
                    : 'Print agent offline — browser print is used as fallback.'}
                </p>
              </div>
            ) : null}
          </div>

          {appMode ? (
            <button
              type="button"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[var(--border)] px-2.5 text-sm font-medium hover:bg-[var(--bg-muted)]"
              onClick={showPanelMenus}
              title={t('webPosShowPanel')}
            >
              <PanelLeft size={16} />
              <span className="hidden sm:inline">Menus</span>
            </button>
          ) : (
            <button type="button" className="btn-primary h-10 text-sm" onClick={enterPosApp}>
              {t('webPosEnterApp')}
            </button>
          )}
        </div>
      </header>

      <div className="relative grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_min(24rem,38vw)]">
        {/* Catalog */}
        <section className="flex min-h-0 flex-col">
          <div className="shrink-0 space-y-2.5 border-b border-[var(--border)] bg-[var(--bg-elevated)]/80 px-3 py-2.5 sm:px-4 backdrop-blur-sm">
            <label className="relative block">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                className="input h-11 rounded-xl pl-9 text-base sm:text-sm"
                placeholder="Search products…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
              />
            </label>
            <div className="webpos-cat-scroll -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
              <button
                type="button"
                onClick={() => setCategoryId('all')}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  categoryId === 'all'
                    ? 'bg-stone-900 text-white'
                    : 'bg-[var(--bg-muted)] text-[var(--text)] hover:bg-[var(--border)]'
                }`}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                    categoryId === c.id
                      ? 'bg-stone-900 text-white'
                      : 'bg-[var(--bg-muted)] text-[var(--text)] hover:bg-[var(--border)]'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-3 pb-24 sm:p-4 lg:pb-4">
            {visibleProducts.length === 0 ? (
              <div className="flex h-full min-h-[12rem] items-center justify-center text-sm text-[var(--text-muted)]">
                No products match
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {visibleProducts.map((p) => {
                  const isCombo = productHasComboSlots(p);
                  const hasMods = !isCombo && productHasModifiers(p as ShopProductForModifiers);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onProductClick(p)}
                      className="group flex min-h-[5.5rem] flex-col items-stretch rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 text-left transition hover:border-stone-400 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-400"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--text)]">
                          {p.name}
                        </span>
                        {(isCombo || hasMods) && (
                          <span className="shrink-0 rounded-md bg-[var(--bg-muted)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                            {isCombo ? 'Combo' : 'Opts'}
                          </span>
                        )}
                      </div>
                      <span className="mt-auto pt-3 text-base font-bold tabular-nums tracking-tight text-teal-800">
                        {money(Number(p.price) || 0)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Desktop cart */}
        <aside className="hidden min-h-0 border-l border-[var(--border)] lg:flex lg:flex-col">
          {renderCartPanel()}
        </aside>
      </div>

      {/* Mobile sticky checkout bar */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 p-3 lg:hidden">
        <div className="pointer-events-auto mx-auto flex max-w-lg items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]/95 p-2 shadow-lg backdrop-blur-md">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-[var(--bg-muted)]"
            onClick={() => setMobileCartOpen(true)}
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-stone-900 text-sm font-bold text-white tabular-nums">
              {cartCount}
            </span>
            <span className="min-w-0">
              <span className="block text-xs text-[var(--text-muted)]">Order total</span>
              <span className="block truncate text-base font-bold tabular-nums">{money(totals.total)}</span>
            </span>
          </button>
          <button
            type="button"
            disabled={!cart.length || busy}
            onClick={() => {
              if (!cart.length) {
                setMobileCartOpen(true);
                return;
              }
              void completeSale();
            }}
            className="shrink-0 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? '…' : 'Charge'}
          </button>
        </div>
      </div>

      {/* Mobile cart sheet */}
      {mobileCartOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-stone-900/40"
            aria-label="Dismiss cart"
            onClick={() => setMobileCartOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl">
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-[var(--border)]" />
            <div className="min-h-0 flex-1">{renderCartPanel({ showClose: true })}</div>
          </div>
        </div>
      ) : null}

      {pendingProduct && (
        <ShopProductModifiersModal
          product={pendingProduct}
          onClose={() => setPendingProduct(null)}
          onConfirm={(extras, unitPrice) => {
            const base = products.find((p) => p.id === pendingProduct.id);
            if (base) addConfiguredProduct(base, unitPrice, extras, []);
            setPendingProduct(null);
          }}
        />
      )}

      {pendingCombo && (
        <ShopComboWizard
          product={pendingCombo}
          onClose={() => setPendingCombo(null)}
          onConfirm={({ comboSelections, selectedExtras, unitPrice }) => {
            const base = products.find((p) => p.id === pendingCombo.id);
            if (base) {
              addConfiguredProduct(
                base,
                unitPrice,
                selectedExtras,
                comboSelections as ShopComboSelection[]
              );
            }
            setPendingCombo(null);
          }}
        />
      )}
    </div>
  );
}
