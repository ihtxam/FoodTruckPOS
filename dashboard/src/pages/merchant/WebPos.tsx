import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Banknote,
  ClipboardList,
  CreditCard,
  Globe2,
  MoreHorizontal,
  PanelLeft,
  PauseCircle,
  Printer,
  RefreshCw,
  Search,
  ShoppingBag,
  X,
  Zap,
  MonitorSmartphone,
  UserCircle2,
  Vault,
} from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { roundMoney2, roundTo005, roundingAdjustment } from '@/lib/money';
import { APP_NAME } from '@/lib/brand';
import {
  filterKitchenItems,
  generateKitchenTicketEscPos,
  generateKitchenTicketText,
  generateWebPosReceiptText,
  logoUrlToEscPos,
  printersForRole,
  resolveReceiptLanguage,
  textToEscPos,
  uint8ToBase64,
  type PosPrintSettingsClient,
  type WebPosReceipt,
  type WebPosReceiptItem,
} from '@/lib/webpos-receipt';
import WebPosFulfillmentModal, {
  type FulfillmentWhen,
} from '@/components/WebPosFulfillmentModal';
import WebPosCustomerPicker, {
  type WebPosCustomer,
} from '@/components/WebPosCustomerPicker';
import type { StoreHours } from '@/lib/shop-hours';
import {
  isPrintAgentAvailable,
  listAgentPrinters,
  printViaAgent,
  type AgentPrinter,
} from '@/lib/print-agent';
import { buildReceiptUrl } from '@/lib/qr';
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
import WebPosPaymentModal, { type WebPosPaymentPhase } from '@/components/WebPosPaymentModal';
import WebPosPinModal from '@/components/WebPosPinModal';
import WebPosOrdersPanel from '@/components/WebPosOrdersPanel';
import WebPosOnlineOrdersPanel, {
  type OnlineOrder,
} from '@/components/WebPosOnlineOrdersPanel';
import {
  playOrderAlertOnce,
  startOrderAlertLoop,
  stopOrderAlertLoop,
} from '@/lib/order-alert';
import {
  hasPermission,
  loadWebPosStaffSession,
  saveWebPosStaffSession,
  type Permission,
  type WebPosStaffSession,
} from '@/lib/permissions';
import { openCashDrawerViaAgent } from '@/lib/print-agent';

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
  categoryId?: string | null;
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

type PosPaymentMethod = 'cash' | 'card' | 'terminal' | 'pay_later';

type WebPosTerminal = {
  id: string;
  terminalId: string;
  terminalName: string | null;
  status: string;
};

type WebPosPaymentConfig = {
  methods: {
    express: boolean;
    cash: boolean;
    card: boolean;
    terminal: boolean;
  };
  terminalReady: boolean;
  adyenConfigured: boolean;
  defaultTerminalId: string | null;
  terminals: WebPosTerminal[];
  posPrintSettings?: PosPrintSettingsClient | null;
  shopLogoUrl?: string | null;
  panelLanguage?: string | null;
};

function money(n: number) {
  return `CHF ${n.toFixed(2)}`;
}

export default function WebPos({ appMode = true }: { appMode?: boolean }) {
  const { t, locale } = useI18n();
  const channels = useMemo(
    () => [
      { id: 'takeaway' as Channel, label: t('takeaway') },
      { id: 'dine_in' as Channel, label: t('dineIn') },
      { id: 'delivery' as Channel, label: t('delivery') },
    ],
    [t]
  );
  const [loading, setLoading] = useState(true);
  const [merchant, setMerchant] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryId, setCategoryId] = useState<string | 'all'>('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [channel, setChannel] = useState<Channel>('takeaway');
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>('cash');
  const [paymentConfig, setPaymentConfig] = useState<WebPosPaymentConfig | null>(null);
  const [selectedTerminalId, setSelectedTerminalId] = useState('');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentPhase, setPaymentPhase] = useState<WebPosPaymentPhase>('processing');
  const [paymentMessage, setPaymentMessage] = useState('');
  const paymentAbortRef = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [agentOk, setAgentOk] = useState(false);
  const [printers, setPrinters] = useState<AgentPrinter[]>([]);
  const [printerName, setPrinterName] = useState(() => localStorage.getItem('manupos_webpos_printer') || '');
  const [autoPrint, setAutoPrint] = useState(() => localStorage.getItem('manupos_webpos_autoprint') !== '0');
  const [lastReceipt, setLastReceipt] = useState<string>('');
  const [lastReceiptUrl, setLastReceiptUrl] = useState<string>('');
  const [printSettings, setPrintSettings] = useState<PosPrintSettingsClient | null>(null);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [onlineOrdersOpen, setOnlineOrdersOpen] = useState(false);
  const [onlineOrders, setOnlineOrders] = useState<OnlineOrder[]>([]);
  const knownOnlineIdsRef = useRef<Set<string> | null>(null);
  const onlinePanelOpenRef = useRef(false);
  const [fulfillmentWhen, setFulfillmentWhen] = useState<FulfillmentWhen | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<WebPosCustomer | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [pendingPayMethod, setPendingPayMethod] = useState<PosPaymentMethod | 'express' | null>(
    null
  );
  const [pendingProduct, setPendingProduct] = useState<ShopProductForModifiers | null>(null);
  const [pendingCombo, setPendingCombo] = useState<ShopComboProduct | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [webposStaff, setWebposStaff] = useState<WebPosStaffSession | null>(() => loadWebPosStaffSession());
  const [staffConfigured, setStaffConfigured] = useState(false);
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
      const [settingsRes, catRes, prodRes, webposRes, staffRes] = await Promise.all([
        api.get('/merchant/settings'),
        api.get('/merchant/categories'),
        api.get('/merchant/products', { params: { limit: 500 } }),
        api.get('/merchant/webpos-config').catch(() => ({ data: { config: null } })),
        api.get('/merchant/staff').catch(() => ({ data: { staff: [] } })),
      ]);
      const merch = settingsRes.data.settings || settingsRes.data.merchant;
      setMerchant(merch);
      setPrintSettings(merch?.posPrintSettings || null);
      setCategories(catRes.data.categories || catRes.data || []);
      const cfg = webposRes.data.config as WebPosPaymentConfig | null;
      if (cfg) {
        setPaymentConfig(cfg);
        if (cfg.posPrintSettings) setPrintSettings(cfg.posPrintSettings);
        if (cfg.defaultTerminalId) setSelectedTerminalId(cfg.defaultTerminalId);
        const first: PosPaymentMethod[] = ['cash', 'card', 'terminal'];
        const pick = first.find((m) => cfg.methods[m]);
        if (pick) setPaymentMethod(pick);
        if (cfg.posPrintSettings?.autoPrintReceipt != null) {
          setAutoPrint(cfg.posPrintSettings.autoPrintReceipt !== false);
        }
      }
      const staffList = staffRes.data.staff || [];
      setStaffConfigured(staffList.some((s: { pinSet?: boolean; isActive?: boolean }) => s.pinSet && s.isActive));
      if (!loadWebPosStaffSession() && staffList.some((s: { pinSet?: boolean }) => s.pinSet)) {
        setPinModalOpen(true);
      }
      const prods = prodRes.data.products || prodRes.data || [];
      setProducts(
        prods.map((p: any) => ({
          ...p,
          price: Number(p.price),
        }))
      );
      await refreshAgent();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('webPosLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [refreshAgent]);

  useEffect(() => {
    load();
  }, [load]);

  const pollOnlineOrders = useCallback(async () => {
    try {
      const res = await api.get('/merchant/orders', { params: { limit: 80 } });
      const all = (res.data.orders || []) as OnlineOrder[];
      const online = all.filter((o) => o.orderType === 'web_shop');
      setOnlineOrders(online);

      const newOnes = online.filter(
        (o) => o.status === 'pending' || o.status === 'pending_approval'
      );
      const newIds = newOnes.map((o) => o.id);

      if (knownOnlineIdsRef.current == null) {
        knownOnlineIdsRef.current = new Set(newIds);
        return;
      }

      const fresh = newIds.filter((id) => !knownOnlineIdsRef.current!.has(id));
      for (const id of newIds) knownOnlineIdsRef.current.add(id);

      if (fresh.length > 0) {
        playOrderAlertOnce();
        toast(t('webPosNewOrderAlert'), { icon: '🔔', duration: 5000 });
        if (!onlinePanelOpenRef.current) {
          startOrderAlertLoop(5000);
        }
      }

      if (newIds.length === 0) {
        stopOrderAlertLoop();
      }
    } catch {
      /* ignore poll errors */
    }
  }, [t]);

  useEffect(() => {
    onlinePanelOpenRef.current = onlineOrdersOpen;
    if (onlineOrdersOpen) stopOrderAlertLoop();
  }, [onlineOrdersOpen]);

  useEffect(() => {
    void pollOnlineOrders();
    const id = setInterval(() => void pollOnlineOrders(), 8000);
    return () => {
      clearInterval(id);
      stopOrderAlertLoop();
    };
  }, [pollOnlineOrders]);

  // Browsers block audio until a user gesture — unlock AudioContext on first tap
  useEffect(() => {
    const softUnlock = () => {
      try {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AC) void new AC().resume();
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('pointerdown', softUnlock, { once: true });
    return () => window.removeEventListener('pointerdown', softUnlock);
  }, []);

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
          categoryId: p.categoryId,
          selectedExtras,
          comboSelections,
        },
      ];
    });
  };

  const onProductClick = (p: Product) => {
    if (productHasComboSlots(p)) {
      if (!p.comboSlots?.length) {
        toast.error(t('webPosComboNoOptions'));
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

  const printEscPosToTargets = async (
    text: string,
    opts: { qrUrl?: string; role: 'receipt' | 'kitchen' | 'eod'; paperWidthMm?: 58 | 80 }
  ) => {
    const targets = printersForRole(printSettings, opts.role);
    const names =
      targets.length > 0
        ? targets.map((x) => x.name)
        : [printerName || ''];
    const paper = opts.paperWidthMm || targets[0]?.paperWidthMm || printSettings?.paperWidthMm || 80;
    const logoUrl =
      opts.role === 'receipt'
        ? printSettings?.receiptLogoUrl || merchant?.shopLogoUrl || paymentConfig?.shopLogoUrl
        : null;
    const logo = logoUrl
      ? await logoUrlToEscPos(String(logoUrl), paper === 58 ? 240 : 384)
      : null;
    const qr =
      opts.role === 'receipt' && printSettings?.receiptShowQrCode !== false ? opts.qrUrl : undefined;
    const escpos = textToEscPos(text, qr, logo);
    const dataBase64 = uint8ToBase64(escpos);
    if (!(agentOk || (await isPrintAgentAvailable()))) {
      throw new Error(t('webPosAgentOffline'));
    }
    for (const name of names) {
      await printViaAgent({ printerName: name || undefined, dataBase64, text });
    }
    toast.success(
      names[0]
        ? t('webPosPrintedOn').replace('{name}', names[0])
        : t('webPosSentDefaultPrinter')
    );
  };

  const printReceipt = async (receiptText: string, receiptUrl?: string) => {
    await printEscPosToTargets(receiptText, { qrUrl: receiptUrl, role: 'receipt' });
  };

  const printKitchenForCart = async (lines: CartLine[], saleChannel: Channel) => {
    if (printSettings?.autoPrintKitchen === false) return;
    const lang = resolveReceiptLanguage(printSettings, printSettings?.receiptLanguage === 'panel' ? locale : printSettings?.receiptLanguage || locale);
    const kitchenPrinters = (printSettings?.printers || []).filter(
      (p) => p.enabled !== false && p.printKitchenTickets && p.name
    );
    const receiptItems: WebPosReceiptItem[] = lines.map((l) => {
      const detail = lineExtrasLabel(l);
      return {
        name: detail ? `${l.name} (${detail})` : l.name,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
        productId: l.productId,
        categoryId: l.categoryId,
      };
    });

    const kitchenOpts = {
      businessName: merchant?.name as string | undefined,
      channel: saleChannel,
      language: lang,
      header: printSettings?.kitchenTicketHeader,
      footer: printSettings?.kitchenTicketFooter,
      scheduledFor: fulfillmentWhen?.scheduledFor ?? null,
      customerName: selectedCustomer
        ? [selectedCustomer.firstName, selectedCustomer.lastName].filter(Boolean).join(' ')
        : null,
      itemTextScale: printSettings?.kitchenItemTextScale || 2,
      headerTextScale: printSettings?.kitchenHeaderTextScale || 2,
      boldText: printSettings?.kitchenBoldText !== false,
    };

    if (kitchenPrinters.length) {
      for (const kp of kitchenPrinters) {
        const items = filterKitchenItems(receiptItems, kp);
        if (!items.length) continue;
        const escpos = generateKitchenTicketEscPos({
          ...kitchenOpts,
          items,
          paperWidthMm: kp.paperWidthMm || printSettings?.paperWidthMm || 80,
        });
        const text = generateKitchenTicketText({
          ...kitchenOpts,
          items,
          paperWidthMm: kp.paperWidthMm || printSettings?.paperWidthMm || 80,
        });
        await printViaAgent({
          printerName: kp.name,
          dataBase64: uint8ToBase64(escpos),
          text,
        });
      }
      return;
    }

    const paperWidthMm = printSettings?.paperWidthMm || 80;
    const escpos = generateKitchenTicketEscPos({
      ...kitchenOpts,
      items: receiptItems,
      paperWidthMm,
    });
    const text = generateKitchenTicketText({
      ...kitchenOpts,
      items: receiptItems,
      paperWidthMm,
    });
    if (!(agentOk || (await isPrintAgentAvailable()))) {
      throw new Error(t('webPosAgentOffline'));
    }
    await printViaAgent({
      printerName: printerName || undefined,
      dataBase64: uint8ToBase64(escpos),
      text,
    });
  };

  const buildSalePayload = (clientId: string, method: PosPaymentMethod) => {
    const payLater = method === 'pay_later';
    const custName = selectedCustomer
      ? [selectedCustomer.firstName, selectedCustomer.lastName].filter(Boolean).join(' ')
      : undefined;
    const ship = selectedCustomer
      ? [selectedCustomer.defaultAddress, selectedCustomer.defaultZip, selectedCustomer.defaultCity]
          .filter(Boolean)
          .join(', ')
      : undefined;
    return {
      clientId,
      paymentMethod: method,
      paymentStatus: payLater ? 'awaiting_payment' : 'completed',
      status: payLater
        ? fulfillmentWhen?.scheduledFor
          ? 'accepted'
          : 'preparing'
        : 'completed',
      subtotal: totals.subtotal,
      taxAmount: totals.tax,
      discountAmount: 0,
      total: totals.total,
      fulfillmentChannel: channel,
      completedAt: payLater ? undefined : Date.now(),
      scheduledFor: fulfillmentWhen?.scheduledFor || null,
      customerId: selectedCustomer?.id || null,
      customerName: custName || null,
      customerPhone: selectedCustomer?.phone || null,
      customerEmail: selectedCustomer?.email || null,
      shippingAddress: ship || null,
      notes: [
        totals.rounding
          ? `Rounding ${totals.rounding > 0 ? '+' : ''}${totals.rounding.toFixed(2)}`
          : '',
        fulfillmentWhen?.mode === 'later' ? `Pickup/delivery: ${fulfillmentWhen.label}` : '',
      ]
        .filter(Boolean)
        .join(' · ') || undefined,
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
  };

  const closePaymentModal = () => {
    paymentAbortRef.current?.abort();
    paymentAbortRef.current = null;
    setPaymentModalOpen(false);
    setPaymentMessage('');
  };

  const finalizeSale = async (method: PosPaymentMethod, presetClientId?: string) => {
    const clientId = presetClientId || `webpos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sale = buildSalePayload(clientId, method);

    await api.post('/sync/push-sales', { sales: [sale] });

    const receiptUrl = buildReceiptUrl(clientId);
    const lang = resolveReceiptLanguage(
      printSettings,
      paymentConfig?.panelLanguage || locale
    );
    const paperWidthMm = printSettings?.paperWidthMm || 80;
    const cartSnapshot = [...cart];
    const channelSnapshot = channel;
    const receiptPayload: WebPosReceipt = {
      businessName: merchant?.name || APP_NAME,
      address: [merchant?.address, merchant?.city].filter(Boolean).join(', '),
      phone: merchant?.phone || undefined,
      vatNumber: merchant?.vatNumber || undefined,
      id: clientId,
      completedAt: Date.now(),
      channel,
      paymentMethod: method,
      items: cart.map((l) => {
        const detail = lineExtrasLabel(l);
        return {
          name: detail ? `${l.name} (${detail})` : l.name,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
          productId: l.productId,
          categoryId: l.categoryId,
        };
      }),
      subtotal: totals.subtotal,
      discount: 0,
      taxAmount: totals.tax,
      taxRate,
      rounding: totals.rounding,
      total: totals.total,
      receiptUrl,
      includeQr: printSettings?.receiptShowQrCode !== false,
      staffName: webposStaff?.name,
      language: lang,
      paperWidthMm,
      header: printSettings?.receiptHeader,
      footer: printSettings?.receiptFooter,
      showVat: printSettings?.receiptShowVatTable !== false,
      showStaff: printSettings?.receiptShowStaffLine !== false,
    };
    const receiptText = generateWebPosReceiptText(receiptPayload, locale);
    setLastReceipt(receiptText);
    setLastReceiptUrl(receiptUrl);
    setSales((prev) =>
      [
        {
          id: clientId,
          total: totals.total,
          paymentMethod: method,
          channel,
          completedAt: Date.now(),
          synced: true,
        },
        ...prev,
      ].slice(0, 30)
    );
    setCart([]);
    setFulfillmentWhen(null);
    setSelectedCustomer(null);
    const payLater = method === 'pay_later';
    toast.success(
      payLater
        ? t('webPosProgrammedSaved')
        : t('webPosSaleCompleteAmount').replace('{amount}', money(totals.total))
    );
    const shouldPrintReceipt =
      !payLater && autoPrint && printSettings?.autoPrintReceipt !== false;
    if (shouldPrintReceipt) {
      try {
        await printReceipt(receiptText, receiptUrl);
      } catch (e: any) {
        toast.error(e.message || t('webPosPrintFailed'));
      }
    }
    try {
      await printKitchenForCart(cartSnapshot, channelSnapshot);
    } catch (e: any) {
      toast.error(e.message || t('webPosKitchenPrintFailed'));
    }
  };

  const beginCheckout = (method: PosPaymentMethod | 'express') => {
    if (!cart.length || busy || paymentModalOpen) return;
    const needsSchedule = channel === 'takeaway' || channel === 'delivery';
    if (needsSchedule && !fulfillmentWhen) {
      setPendingPayMethod(method);
      setScheduleOpen(true);
      return;
    }
    if (channel === 'delivery' && !selectedCustomer) {
      setPendingPayMethod(method);
      setCustomerOpen(true);
      return;
    }
    void runCheckout(method);
  };

  const runCheckout = async (method: PosPaymentMethod | 'express') => {
    if (method === 'express') {
      setBusy(true);
      try {
        await finalizeSale('cash');
      } catch (e: any) {
        toast.error(e.response?.data?.error || e.message || t('webPosSaleFailed'));
      } finally {
        setBusy(false);
      }
      return;
    }
    if (method === 'terminal') {
      setPaymentMethod('terminal');
      await runTerminalPayment();
      return;
    }
    setBusy(true);
    try {
      await finalizeSale(method);
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || t('webPosSaleFailed'));
    } finally {
      setBusy(false);
    }
  };

  const holdCurrentOrder = async (sendToKitchen = false) => {
    if (!cart.length) return;
    try {
      await api.post('/merchant/pos/held', {
        label: `${channel} · ${money(totals.total)}`,
        channel,
        cartJson: { cart, channel },
        staffId: webposStaff?.id,
        staffName: webposStaff?.name,
        sendToKitchen,
      });
      if (sendToKitchen) {
        try {
          await printKitchenForCart(cart, channel);
        } catch {
          /* kitchen optional on hold */
        }
      }
      setCart([]);
      toast.success(sendToKitchen ? t('webPosHeldSentKitchen') : t('webPosOrderHeld'));
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('webPosHoldFailed'));
    }
  };

  const runTerminalPayment = async () => {
    if (!selectedTerminalId) {
      toast.error(t('webPosSelectTerminal'));
      return;
    }

    const clientId = `webpos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const abort = new AbortController();
    paymentAbortRef.current = abort;
    setPaymentModalOpen(true);
    setPaymentPhase('processing');
    setPaymentMessage(t('webPosPayCompleteOnTerminal'));
    setBusy(true);

    try {
      const res = await api.post(
        '/payment/terminal/poi',
        {
          amount: totals.total,
          terminalId: selectedTerminalId,
          currency: 'CHF',
          saleRef: clientId,
        },
        { signal: abort.signal, timeout: 170_000 }
      );

      const result = res.data.result as { status: string; message?: string; reference?: string };

      if (result.status === 'approved') {
        closePaymentModal();
        await finalizeSale('terminal', clientId);
        return;
      }

      if (result.status === 'cancelled') {
        setPaymentPhase('cancelled');
        setPaymentMessage(result.message || t('webPosPayCancelledMsg'));
        return;
      }

      setPaymentPhase('failed');
      setPaymentMessage(result.message || t('webPosPayFailedMsg'));
    } catch (e: any) {
      if (e.code === 'ERR_CANCELED' || e.name === 'CanceledError') {
        setPaymentPhase('cancelled');
        setPaymentMessage(t('webPosPayCancelled'));
        return;
      }
      setPaymentPhase('failed');
      setPaymentMessage(e.response?.data?.error || e.message || t('webPosPayFailedMsg'));
    } finally {
      setBusy(false);
      paymentAbortRef.current = null;
    }
  };

  const completeSale = async () => {
    beginCheckout(paymentMethod);
  };

  const expressSale = async () => {
    beginCheckout('express');
  };

  const staffPerms = webposStaff?.permissions;
  const canPay =
    !staffConfigured || (!!webposStaff && hasPermission(staffPerms, 'PROCESS_PAYMENTS'));
  const canDrawer =
    !staffConfigured || (!!webposStaff && hasPermission(staffPerms, 'OPEN_CASH_DRAWER'));

  const openCashDrawer = async () => {
    if (!canDrawer) {
      toast.error(t('webPosDrawerDenied'));
      return;
    }
    try {
      await openCashDrawerViaAgent({ printerName: printerName || undefined });
      toast.success(t('webPosDrawerOpened'));
    } catch (e: any) {
      toast.error(e.message || t('webPosDrawerFailed'));
    }
  };

  const onStaffPinSuccess = (staff: {
    id: string;
    name: string;
    roleId: string;
    roleName: string;
    permissions: string[];
  }) => {
    const session: WebPosStaffSession = {
      id: staff.id,
      name: staff.name,
      roleId: staff.roleId,
      roleName: staff.roleName,
      permissions: staff.permissions as Permission[],
    };
    setWebposStaff(session);
    saveWebPosStaffSession(session);
    toast.success(t('webPosSignedInAs').replace('{name}', staff.name));
  };

  const enabledMethods = {
    express: (paymentConfig?.methods.express ?? true) && canPay,
    cash: (paymentConfig?.methods.cash ?? true) && canPay,
    card: (paymentConfig?.methods.card ?? true) && canPay,
    terminal: (paymentConfig?.methods.terminal ?? false) && canPay,
  };

  const activeTerminals = useMemo(
    () => (paymentConfig?.terminals || []).filter((t) => t.status === 'active'),
    [paymentConfig]
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
        {t('webPosLoading')}
      </div>
    );
  }

  const renderCartPanel = (opts?: { showClose?: boolean }) => (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg-elevated)]">
      <div className="shrink-0 border-b border-[var(--border)] px-3 pt-3 pb-2 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold tracking-tight">{t('webPosCurrentOrder')}</p>
            <p className="text-[11px] text-[var(--text-muted)]">
              {cartCount === 0
                ? t('webPosNoItems')
                : (cartCount === 1 ? t('webPosItemCount') : t('webPosItemCountPlural')).replace('{n}', String(cartCount))}
            </p>
          </div>
          {opts?.showClose ? (
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)]"
              aria-label={t('webPosCloseCart')}
              onClick={() => setMobileCartOpen(false)}
            >
              <X size={18} />
            </button>
          ) : null}
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-[var(--bg-muted)] p-1">
          {channels.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setChannel(c.id);
                setFulfillmentWhen(null);
                setSelectedCustomer(null);
              }}
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
            <p className="text-sm text-[var(--text-muted)]">{t('webPosTapProducts')}</p>
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
                  aria-label={t('webPosRemoveItem')}
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
            <span>{t('webPosSubtotal')}</span>
            <span className="tabular-nums">{money(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-[var(--text-muted)]">
            <span>{t('webPosTax').replace('{rate}', String(taxRate))}</span>
            <span className="tabular-nums">{money(totals.tax)}</span>
          </div>
          {totals.rounding !== 0 && (
            <div className="flex justify-between text-[var(--text-muted)]">
              <span>{t('webPosRounding')}</span>
              <span className="tabular-nums">
                {totals.rounding > 0 ? '+' : ''}
                {money(totals.rounding)}
              </span>
            </div>
          )}
          <div className="flex items-end justify-between pt-1">
            <span className="text-base font-semibold">{t('webPosTotal')}</span>
            <span className="text-2xl font-bold tracking-tight tabular-nums">{money(totals.total)}</span>
          </div>
        </div>

        {(channel === 'takeaway' || channel === 'delivery') && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/50 px-2.5 py-2 text-xs space-y-1">
            <button
              type="button"
              className="w-full text-left font-medium"
              onClick={() => {
                setPendingPayMethod(null);
                setScheduleOpen(true);
              }}
            >
              {t('webPosWhen')}:{' '}
              <span className="text-teal-800">
                {fulfillmentWhen?.label || t('webPosTapToSetTime')}
              </span>
            </button>
            {channel === 'delivery' ? (
              <button
                type="button"
                className="w-full text-left font-medium"
                onClick={() => setCustomerOpen(true)}
              >
                {t('webPosCustomer')}:{' '}
                <span className="text-teal-800">
                  {selectedCustomer
                    ? [selectedCustomer.firstName, selectedCustomer.lastName]
                        .filter(Boolean)
                        .join(' ') || selectedCustomer.phone
                    : t('webPosTapToSelectCustomer')}
                </span>
              </button>
            ) : null}
          </div>
        )}

        {enabledMethods.express ? (
          <button
            type="button"
            disabled={!cart.length || busy || paymentModalOpen}
            onClick={() => void expressSale()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-amber-500 bg-amber-50 py-2.5 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Zap size={16} />
            {t('webPosExpress')} · {money(totals.total)}
          </button>
        ) : null}

        {(enabledMethods.cash || enabledMethods.card || enabledMethods.terminal) && (
          <div
            className={`grid gap-2 ${
              [enabledMethods.cash, enabledMethods.card, enabledMethods.terminal].filter(Boolean).length >= 3
                ? 'grid-cols-3'
                : 'grid-cols-2'
            }`}
          >
            {enabledMethods.cash ? (
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
                {t('webPosCash')}
              </button>
            ) : null}
            {enabledMethods.card ? (
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
                {t('webPosCard')}
              </button>
            ) : null}
            {enabledMethods.terminal ? (
              <button
                type="button"
                onClick={() => setPaymentMethod('terminal')}
                className={`inline-flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-semibold transition ${
                  paymentMethod === 'terminal'
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text)]'
                }`}
              >
                <MonitorSmartphone size={16} />
                {t('webPosTerminal')}
              </button>
            ) : null}
          </div>
        )}

        {enabledMethods.terminal && paymentMethod === 'terminal' && activeTerminals.length > 0 ? (
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-[var(--text-muted)]">{t('webPosTerminal')}</span>
            <select
              className="input w-full text-sm"
              value={selectedTerminalId}
              onChange={(e) => setSelectedTerminalId(e.target.value)}
            >
              {activeTerminals.map((t) => (
                <option key={t.id} value={t.terminalId}>
                  {t.terminalName || t.terminalId}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <button
          type="button"
          disabled={!cart.length || busy || paymentModalOpen}
          onClick={() => void completeSale()}
          className="w-full rounded-xl bg-teal-700 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy && !paymentModalOpen
            ? t('webPosProcessing')
            : paymentMethod === 'terminal' && cart.length
              ? t('webPosPayOnTerminal').replace('{amount}', money(totals.total))
              : cart.length
                ? t('webPosCharge').replace('{amount}', money(totals.total))
                : t('webPosAddItemsToCharge')}
        </button>

        {(channel === 'takeaway' || channel === 'delivery') && cart.length ? (
          <button
            type="button"
            disabled={busy || paymentModalOpen}
            onClick={() => beginCheckout('pay_later')}
            className="w-full rounded-xl border-2 border-violet-500 bg-violet-50 py-2.5 text-sm font-semibold text-violet-900 hover:bg-violet-100 disabled:opacity-40"
          >
            {t('webPosPayLater')} · {money(totals.total)}
          </button>
        ) : null}

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
            {t('webPosReprint')}
          </button>
        ) : null}

        {sales.length > 0 ? (
          <div className="border-t border-[var(--border)] pt-2">
            <button
              type="button"
              className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]"
              onClick={() => setRecentOpen((v) => !v)}
            >
              {t('webPosRecentSales')}
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
              {agentOk ? t('webPosPrinterReady') : t('webPosStartPrintAgent')}
            </span>
          </div>
          <p className="truncate text-[11px] text-[var(--text-muted)]">
            {merchant?.name || t('webPosStore')}
            {appMode ? ` · ${t('webPosEscHint')}` : ''}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            className="relative inline-flex h-10 items-center gap-1.5 rounded-xl border border-[var(--border)] px-2.5 text-xs font-medium hover:bg-[var(--bg-muted)]"
            onClick={() => {
              setOnlineOrdersOpen(true);
              stopOrderAlertLoop();
            }}
            title={t('webPosOnlineOrders')}
          >
            <Globe2 size={16} />
            <span className="hidden sm:inline">{t('webPosOnlineOrders')}</span>
            {onlineOrders.filter(
              (o) => o.status === 'pending' || o.status === 'pending_approval'
            ).length > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-bold text-white">
                {
                  onlineOrders.filter(
                    (o) => o.status === 'pending' || o.status === 'pending_approval'
                  ).length
                }
              </span>
            ) : null}
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[var(--border)] px-2.5 text-xs font-medium hover:bg-[var(--bg-muted)]"
            onClick={() => setOrdersOpen(true)}
            title={t('webPosOrders')}
          >
            <ClipboardList size={16} />
            <span className="hidden sm:inline">{t('webPosOrders')}</span>
          </button>
          <button
            type="button"
            disabled={!cart.length || busy}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[var(--border)] px-2.5 text-xs font-medium hover:bg-[var(--bg-muted)] disabled:opacity-40"
            onClick={() => void holdCurrentOrder(false)}
            title={t('webPosHold')}
          >
            <PauseCircle size={16} />
            <span className="hidden sm:inline">{t('webPosHold')}</span>
          </button>
          {webposStaff ? (
            <button
              type="button"
              className="hidden sm:inline-flex h-10 max-w-[8rem] items-center gap-1.5 truncate rounded-xl border border-[var(--border)] px-2.5 text-xs font-medium"
              onClick={() => setPinModalOpen(true)}
              title={t('webPosSwitchUser')}
            >
              <UserCircle2 size={16} className="shrink-0" />
              <span className="truncate">{webposStaff.name}</span>
            </button>
          ) : null}
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] hover:bg-[var(--bg-muted)] disabled:opacity-40"
            aria-label={t('webPosSwitchUser')}
            onClick={() => setPinModalOpen(true)}
          >
            <UserCircle2 size={18} />
          </button>
          {canDrawer ? (
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] hover:bg-[var(--bg-muted)]"
              aria-label={t('webPosOpenDrawer')}
              title={t('webPosOpenDrawer')}
              onClick={() => void openCashDrawer()}
            >
              <Vault size={18} />
            </button>
          ) : null}
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
              aria-label={t('webPosPrinterTools')}
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen((v) => !v)}
            >
              <MoreHorizontal size={18} />
            </button>
            {settingsOpen ? (
              <div className="absolute right-0 top-[calc(100%+6px)] w-[min(20rem,calc(100vw-1.5rem))] rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 shadow-lg space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  <Printer size={14} />
                  {t('webPosPrinting')}
                </div>
                <label className="block space-y-1 text-sm">
                  <span className="text-xs text-[var(--text-muted)]">{t('webPosPrinter')}</span>
                  <select
                    className="input"
                    value={printerName}
                    onChange={(e) => setPrinterName(e.target.value)}
                    disabled={!agentOk}
                  >
                    <option value="">{t('webPosDefaultPrinter')}</option>
                    {printers.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                        {p.isDefault ? t('webPosDefaultSuffix') : ''}
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
                  {t('webPosAutoPrint')}
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  <button
                    type="button"
                    className="btn-secondary justify-start text-sm"
                    onClick={() => {
                      void refreshAgent();
                      toast.success(t('webPosPrintersRefreshed'));
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
                    {t('webPosReloadCatalog')}
                  </button>
                </div>
                <p className="text-[11px] leading-snug text-[var(--text-muted)]">
                  {agentOk ? t('webPosAgentOnline') : t('webPosAgentOffline')}
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
              <span className="hidden sm:inline">{t('webPosMenus')}</span>
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
                placeholder={t('webPosSearchProducts')}
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
                {t('webPosAllCategories')}
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
                {t('webPosNoProductsMatch')}
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
                            {isCombo ? t('webPosCombo') : t('webPosOpts')}
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
              <span className="block text-xs text-[var(--text-muted)]">{t('webPosOrderTotal')}</span>
              <span className="block truncate text-base font-bold tabular-nums">{money(totals.total)}</span>
            </span>
          </button>
          <button
            type="button"
            disabled={!cart.length || busy || paymentModalOpen}
            onClick={() => {
              if (!cart.length) {
                setMobileCartOpen(true);
                return;
              }
              void completeSale();
            }}
            className="shrink-0 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy && !paymentModalOpen ? '…' : t('webPosChargeShort')}
          </button>
        </div>
      </div>

      {/* Mobile cart sheet */}
      {mobileCartOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-stone-900/40"
            aria-label={t('webPosDismissCart')}
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

      <WebPosPinModal
        open={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onSuccess={onStaffPinSuccess}
      />

      <WebPosPaymentModal
        open={paymentModalOpen}
        phase={paymentPhase}
        amountLabel={money(totals.total)}
        message={paymentMessage}
        onCancel={() => {
          paymentAbortRef.current?.abort();
          setPaymentPhase('cancelled');
          setPaymentMessage(t('webPosPayCancelled'));
        }}
        onRetry={() => {
          closePaymentModal();
          void runTerminalPayment();
        }}
        onClose={closePaymentModal}
      />

      <WebPosOrdersPanel
        open={ordersOpen}
        onClose={() => setOrdersOpen(false)}
        onResumeHeld={(held) => {
          const data = held.cartJson as { cart?: CartLine[]; channel?: Channel } | CartLine[];
          if (Array.isArray(data)) {
            setCart(data);
          } else if (data?.cart) {
            setCart(data.cart);
            if (data.channel) setChannel(data.channel);
          }
          toast.success(t('webPosOrderResumed'));
        }}
      />

      <WebPosOnlineOrdersPanel
        open={onlineOrdersOpen}
        onClose={() => setOnlineOrdersOpen(false)}
        orders={onlineOrders}
        onRefresh={() => void pollOnlineOrders()}
      />

      {(channel === 'takeaway' || channel === 'delivery') && (
        <WebPosFulfillmentModal
          open={scheduleOpen}
          channel={channel}
          storeHours={(merchant?.storeHours || null) as StoreHours | null}
          leadMinutes={
            channel === 'delivery'
              ? Number(merchant?.deliveryEtaMinutes) || 45
              : Number(merchant?.pickupEtaMinutes) || 20
          }
          onClose={() => {
            setScheduleOpen(false);
            setPendingPayMethod(null);
          }}
          onConfirm={(when) => {
            setFulfillmentWhen(when);
            setScheduleOpen(false);
            if (channel === 'delivery' && !selectedCustomer) {
              setCustomerOpen(true);
              return;
            }
            if (pendingPayMethod) {
              const m = pendingPayMethod;
              setPendingPayMethod(null);
              void runCheckout(m);
            }
          }}
        />
      )}

      <WebPosCustomerPicker
        open={customerOpen}
        onClose={() => {
          setCustomerOpen(false);
          setPendingPayMethod(null);
        }}
        onSelect={(c) => {
          setSelectedCustomer(c);
          setCustomerOpen(false);
          if (pendingPayMethod) {
            const m = pendingPayMethod;
            setPendingPayMethod(null);
            if (!fulfillmentWhen && (channel === 'takeaway' || channel === 'delivery')) {
              setPendingPayMethod(m);
              setScheduleOpen(true);
              return;
            }
            void runCheckout(m);
          }
        }}
      />
    </div>
  );
}
