import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
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

export default function WebPos() {
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
    return <div className="text-center py-16 text-slate-500">Loading WebPOS…</div>;
  }

  return (
    <div className="-m-6 h-[calc(100vh-4rem)] flex flex-col bg-slate-100">
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900">WebPOS</h1>
          <p className="text-xs text-slate-500">
            {merchant?.name || 'Store'} · Swiss 0.05 rounding ·{' '}
            {agentOk ? (
              <span className="text-emerald-600 font-semibold">Print agent online</span>
            ) : (
              <span className="text-amber-600 font-semibold">Print agent offline (browser print fallback)</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input py-1.5 text-sm w-auto min-w-[180px]"
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
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={autoPrint} onChange={(e) => setAutoPrint(e.target.checked)} />
            Auto-print
          </label>
          <button type="button" className="btn-secondary text-sm py-1.5" onClick={() => refreshAgent()}>
            Refresh printers
          </button>
          <button type="button" className="btn-secondary text-sm py-1.5" onClick={() => load()}>
            Reload catalog
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] min-h-0">
        {/* Catalog */}
        <div className="flex flex-col min-h-0 p-3 gap-3">
          <div className="flex flex-wrap gap-2 items-center">
            <input
              className="input flex-1 min-w-[180px]"
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => setCategoryId('all')}
                className={`px-3 py-1.5 rounded-full text-sm border ${
                  categoryId === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white'
                }`}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  className={`px-3 py-1.5 rounded-full text-sm border ${
                    categoryId === c.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {visibleProducts.length === 0 ? (
              <div className="text-center text-slate-500 py-16">No products</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                {visibleProducts.map((p) => {
                  const isCombo = productHasComboSlots(p);
                  const hasMods = !isCombo && productHasModifiers(p as ShopProductForModifiers);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onProductClick(p)}
                      className="text-left bg-white border border-slate-200 rounded-xl p-3 hover:border-indigo-400 hover:shadow-sm transition"
                    >
                      <div className="font-semibold text-slate-900 line-clamp-2 min-h-[2.5rem]">{p.name}</div>
                      {(isCombo || hasMods) && (
                        <div className="text-[11px] font-medium text-slate-500 mt-1">
                          {isCombo ? 'Combo' : 'Options'}
                        </div>
                      )}
                      <div className="text-lg font-bold text-indigo-600 mt-2">
                        {money(Number(p.price) || 0)}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Cart */}
        <aside className="bg-white border-l border-slate-200 flex flex-col min-h-0">
          <div className="p-3 border-b border-slate-100">
            <div className="text-sm font-semibold mb-2">Channel</div>
            <div className="grid grid-cols-3 gap-1">
              {CHANNELS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setChannel(c.id)}
                  className={`py-2 text-xs font-semibold rounded-lg border ${
                    channel === c.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto p-3 space-y-2">
            {cart.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">Cart is empty</p>
            ) : (
              cart.map((l) => (
                <div key={l.lineId} className="border border-slate-200 rounded-lg p-2">
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-slate-900">{l.name}</div>
                      {!!lineExtrasLabel(l) && (
                        <div className="text-xs text-slate-500 mt-0.5">{lineExtrasLabel(l)}</div>
                      )}
                    </div>
                    <button type="button" className="text-red-500 text-xs shrink-0" onClick={() => setQty(l.lineId, 0)}>
                      ✕
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="w-7 h-7 rounded bg-slate-900 text-white"
                        onClick={() => setQty(l.lineId, l.quantity - 1)}
                      >
                        −
                      </button>
                      <span className="font-bold w-6 text-center">{l.quantity}</span>
                      <button
                        type="button"
                        className="w-7 h-7 rounded bg-slate-900 text-white"
                        onClick={() => setQty(l.lineId, l.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                    <div className="font-semibold text-indigo-600">{money(l.lineTotal)}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-3 border-t border-slate-100 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{money(totals.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Tax ({taxRate}%)</span><span>{money(totals.tax)}</span></div>
            {totals.rounding !== 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Rounding</span>
                <span>{totals.rounding > 0 ? '+' : ''}{money(totals.rounding)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-1">
              <span>Total</span>
              <span className="text-indigo-600">{money(totals.total)}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              {(['cash', 'card'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={`py-2 rounded-lg border text-sm font-semibold capitalize ${
                    paymentMethod === m ? 'bg-slate-900 text-white' : 'bg-slate-50'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={!cart.length || busy}
              onClick={() => void completeSale()}
              className="w-full mt-2 btn-primary py-3 text-base disabled:opacity-40"
            >
              {busy ? 'Processing…' : `Charge ${money(totals.total)}`}
            </button>

            {lastReceipt && (
              <button
                type="button"
                className="w-full btn-secondary text-sm"
                onClick={() =>
                  void printReceipt(lastReceipt, lastReceiptUrl || undefined).catch((e) =>
                    toast.error(e.message)
                  )
                }
              >
                Re-print last receipt
              </button>
            )}
          </div>

          {sales.length > 0 && (
            <div className="border-t border-slate-100 p-3 max-h-36 overflow-auto">
              <div className="text-xs font-semibold text-slate-500 mb-1">Recent sales</div>
              {sales.slice(0, 8).map((s) => (
                <div key={s.id} className="flex justify-between text-xs py-0.5">
                  <span className="text-slate-500">{new Date(s.completedAt).toLocaleTimeString()}</span>
                  <span className="font-medium">{money(s.total)} · {s.paymentMethod}</span>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

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
