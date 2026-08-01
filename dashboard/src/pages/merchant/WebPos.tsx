import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { RefreshCw } from 'lucide-react';
import { repairCatalogText } from '@/lib/text-encoding';
import { useI18n } from '@/lib/i18n';
import { roundMoney2, roundTo005, roundingAdjustment, computeMerchandiseTotals, scaleLinesByFactor, extractVatFromGross, resolvePosTaxRate } from '@/lib/money';
import { APP_NAME } from '@/lib/brand';
import {
  filterKitchenItems,
  generateKitchenTicketEscPos,
  generateKitchenTicketText,
  generateWebPosReceiptText,
  logoUrlToEscPos,
  nextWebPosTicketNumber,
  printersForRole,
  resolveReceiptLanguage,
  textToEscPos,
  uint8ToBase64,
  posOrderToWebPosReceipt,
  type PosOrderForReceipt,
  type PosPrintSettingsClient,
  type WebPosReceipt,
  type WebPosReceiptItem,
} from '@/lib/webpos-receipt';
import {
  normalizePosCheckoutSettings,
  type PosCheckoutSettings,
} from '@/lib/pos-checkout';
import WebPosFulfillmentModal, {
  type FulfillmentWhen,
} from '@/components/WebPosFulfillmentModal';
import WebPosCustomerPicker, {
  type WebPosCustomer,
} from '@/components/WebPosCustomerPicker';
import WebPosCheckoutModal, {
  type CheckoutResult,
} from '@/components/WebPosCheckoutModal';
import WebPosSplitBillModal, {
  type SplitPart,
} from '@/components/WebPosSplitBillModal';
import { localDateTimeToIso, type StoreHours } from '@/lib/shop-hours';
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
import WebPosTipKeypad from '@/components/WebPosTipKeypad';
import WebPosOnlineOrdersPanel, {
  type OnlineOrder,
} from '@/components/WebPosOnlineOrdersPanel';
import WebPosTopBar, { WebPosSettingsDropdown } from '@/components/webpos/WebPosTopBar';
import WebPosCartPanel from '@/components/webpos/WebPosCartPanel';
import WebPosProductArea from '@/components/webpos/WebPosProductArea';
import WebPosCheckoutView from '@/components/webpos/WebPosCheckoutView';
import WebPosSuccessView from '@/components/webpos/WebPosSuccessView';
import WebPosTablesView from '@/components/webpos/WebPosTablesView';
import WebPosBookingsView from '@/components/webpos/WebPosBookingsView';
import WebPosKitchenMessageModal from '@/components/webpos/WebPosKitchenMessageModal';
import WebPosOrderNoteModal from '@/components/webpos/WebPosOrderNoteModal';
import WebPosSetTableModal from '@/components/webpos/WebPosSetTableModal';
import WebPosSetTabModal from '@/components/webpos/WebPosSetTabModal';
import type { KeypadMode, PosChannel, PosTab, PosView } from '@/components/webpos/types';
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

type Channel = PosChannel;

type Product = {
  id: string;
  name: string;
  price: number | string;
  categoryId?: string | null;
  isTaxable?: boolean;
  isOpenPrice?: boolean;
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
  isOpenPrice?: boolean;
  courseNumber?: number;
  lineDiscountPercent?: number;
  sentToKitchen?: boolean;
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
  orderNumber?: string;
  backendOrderId?: string;
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
  posCheckoutSettings?: PosCheckoutSettings | null;
  shopLogoUrl?: string | null;
  panelLanguage?: string | null;
};

type CheckoutExtras = CheckoutResult;

function money(n: number) {
  return `CHF ${n.toFixed(2)}`;
}

export default function WebPos({ appMode = true }: { appMode?: boolean }) {
  const { t, locale } = useI18n();
  const [loading, setLoading] = useState(true);
  const [merchant, setMerchant] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryId, setCategoryId] = useState<string | 'all'>('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [channel, setChannel] = useState<Channel | null>(null);
  const effectiveChannel: Channel = channel ?? 'takeaway';
  const [posTab, setPosTab] = useState<PosTab>('register');
  const [posView, setPosView] = useState<PosView>('register');
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [keypadMode, setKeypadMode] = useState<KeypadMode>('qty');
  const [keypadBuffer, setKeypadBuffer] = useState('');
  const [activeCourse, setActiveCourse] = useState(1);
  const [orderNote, setOrderNote] = useState('');
  const [tableId, setTableId] = useState<string | null>(null);
  const [tableLabel, setTableLabel] = useState<string | null>(null);
  const [tabNumber, setTabNumber] = useState<string | null>(null);
  const [kitchenMsgOpen, setKitchenMsgOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [setTableOpen, setSetTableOpen] = useState(false);
  const [setTabOpen, setSetTabOpen] = useState(false);
  const [postSuccessTarget, setPostSuccessTarget] = useState<'register' | 'tables'>(() =>
    (localStorage.getItem('manupos_webpos_post_success') as 'register' | 'tables') || 'register'
  );
  const [successInfo, setSuccessInfo] = useState<{ amount: number; changeDue: number | null } | null>(
    null
  );
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
  const [ordersRefreshToken, setOrdersRefreshToken] = useState(0);
  const [highlightOrderId, setHighlightOrderId] = useState<string | null>(null);
  const [onlineOrdersOpen, setOnlineOrdersOpen] = useState(false);
  const [onlineOrders, setOnlineOrders] = useState<OnlineOrder[]>([]);
  const knownOnlineIdsRef = useRef<Set<string> | null>(null);
  const onlinePanelOpenRef = useRef(false);
  const splitMasterIdRef = useRef<string | null>(null);
  const [fulfillmentWhen, setFulfillmentWhen] = useState<FulfillmentWhen | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<WebPosCustomer | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutSeedMethod, setCheckoutSeedMethod] = useState<
    PosPaymentMethod | 'express'
  >('cash');
  const [checkoutExtras, setCheckoutExtras] = useState<CheckoutExtras | null>(null);
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitQueue, setSplitQueue] = useState<SplitPart[]>([]);
  const [splitIndex, setSplitIndex] = useState(0);
  const [pendingPayMethod, setPendingPayMethod] = useState<PosPaymentMethod | 'express' | null>(
    null
  );
  const [pendingProduct, setPendingProduct] = useState<ShopProductForModifiers | null>(null);
  const [pendingCombo, setPendingCombo] = useState<ShopComboProduct | null>(null);
  const [pendingOpenPrice, setPendingOpenPrice] = useState<Product | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [webposStaff, setWebposStaff] = useState<WebPosStaffSession | null>(() => loadWebPosStaffSession());
  const [staffConfigured, setStaffConfigured] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  const cartCount = useMemo(() => cart.reduce((n, l) => n + l.quantity, 0), [cart]);

  const cartQtyByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of cart) {
      map.set(l.productId, (map.get(l.productId) || 0) + l.quantity);
    }
    return map;
  }, [cart]);

  const coursesEnabled = !!merchant?.coursesEnabled;
  const cartExpanded = cart.length > 0;
  const showSend = channel === 'takeaway' || channel === 'delivery';

  useEffect(() => {
    localStorage.setItem('manupos_webpos_post_success', postSuccessTarget);
  }, [postSuccessTarget]);

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
    const vat = merchant.vatRate;
    const ch = effectiveChannel;
    if (ch === 'dine_in') return resolvePosTaxRate(merchant.taxDineInRate, vat, 8.1);
    if (ch === 'delivery') {
      const delivery = resolvePosTaxRate(merchant.taxDeliveryRate, null, 0);
      if (delivery > 0) return delivery;
      return resolvePosTaxRate(merchant.taxTakeawayRate, vat, 2.6);
    }
    return resolvePosTaxRate(merchant.taxTakeawayRate, vat, 2.6);
  }, [merchant, effectiveChannel]);

  /** Menu prices include VAT — tax line shows extracted TVA, not added on top. */
  const vatIncludedInPrice = true;

  const checkoutSettings = useMemo(
    () => normalizePosCheckoutSettings(paymentConfig?.posCheckoutSettings),
    [paymentConfig?.posCheckoutSettings]
  );

  const roundingStep = checkoutSettings.roundingStep || 0.05;

  const fullTotals = useMemo(
    () => computeMerchandiseTotals(cart, taxRate, vatIncludedInPrice, roundingStep),
    [cart, taxRate, vatIncludedInPrice, roundingStep]
  );

  const activeSale = useMemo(() => {
    const part = splitQueue[splitIndex];
    if (!part) {
      return { lines: cart, totals: fullTotals, label: null as string | null };
    }
    if (part.lineIds.length > 0) {
      const lines = cart.filter((l) => part.lineIds.includes(l.lineId));
      const t = computeMerchandiseTotals(lines, taxRate, vatIncludedInPrice, roundingStep);
      return { lines, totals: { ...t, total: part.amount }, label: part.label };
    }
    const factor = fullTotals.total > 0 ? part.amount / fullTotals.total : 1;
    const lines = scaleLinesByFactor(cart, factor);
    const t = computeMerchandiseTotals(lines, taxRate, vatIncludedInPrice, roundingStep);
    return {
      lines,
      totals: {
        ...t,
        total: part.amount,
        rounding: roundMoney2(part.amount - t.gross),
      },
      label: part.label,
    };
  }, [cart, fullTotals, splitQueue, splitIndex, taxRate, vatIncludedInPrice, roundingStep]);

  /** @deprecated alias — full cart totals for sidebar display */
  const totals = splitQueue.length > 0 ? activeSale.totals : fullTotals;

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
      setCategories(
        (catRes.data.categories || catRes.data || []).map((c: any) => ({
          ...c,
          name: repairCatalogText(c.name),
        }))
      );
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
      const isOpen = p.isOpenPrice || p.productType === 'open_price';
      const existing = !isOpen
        ? prev.find(
            (l) =>
              l.productId === p.id &&
              !l.isOpenPrice &&
              lineSignature(l.selectedExtras, l.comboSelections) === sig
          )
        : undefined;
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
          isOpenPrice: isOpen,
          courseNumber: coursesEnabled ? activeCourse : undefined,
        },
      ];
    });
  };

  const onProductClick = (p: Product) => {
    if (p.isOpenPrice || p.productType === 'open_price') {
      setPendingOpenPrice(p);
      return;
    }
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

  const applyKeypadToLine = () => {
    if (!selectedLineId) return;
    const value = Number(keypadBuffer);
    if (!Number.isFinite(value)) {
      toast.error(t('webPosEnterPrice'));
      return;
    }
    setCart((prev) =>
      prev.map((l) => {
        if (l.lineId !== selectedLineId) return l;
        if (keypadMode === 'qty') {
          const quantity = Math.max(0, Math.round(value));
          if (quantity <= 0) return l;
          return {
            ...l,
            quantity,
            lineTotal: roundMoney2(l.unitPrice * quantity * (1 - (l.lineDiscountPercent || 0) / 100)),
          };
        }
        if (keypadMode === 'percent') {
          const pct = Math.max(0, Math.min(100, value));
          return {
            ...l,
            lineDiscountPercent: pct,
            lineTotal: roundMoney2(l.unitPrice * l.quantity * (1 - pct / 100)),
          };
        }
        const unitPrice = roundMoney2(Math.max(0, value));
        return {
          ...l,
          unitPrice,
          isOpenPrice: true,
          lineTotal: roundMoney2(unitPrice * l.quantity * (1 - (l.lineDiscountPercent || 0) / 100)),
        };
      }).filter((l) => l.quantity > 0)
    );
    setKeypadBuffer('');
  };

  const advanceCourse = () => {
    setActiveCourse((c) => c + 1);
    toast.success(`${t('webPosCourse')} ${activeCourse + 1}`);
  };

  const sendCoursesToKitchen = async () => {
    if (!cart.length) return;
    setBusy(true);
    try {
      const ticket = nextWebPosTicketNumber(merchant?.id);
      await printKitchenForCart(cart, effectiveChannel, {
        orderNumber: ticket.display,
        when: fulfillmentWhen,
      });
      toast.success(t('webPosHeldSentKitchen'));
    } catch (e: any) {
      toast.error(e.message || t('webPosKitchenPrintFailed'));
    } finally {
      setBusy(false);
    }
  };

  const printProvisionalReceipt = async () => {
    if (!cart.length) return;
    try {
      const ticket = nextWebPosTicketNumber(merchant?.id);
      const lang = resolveReceiptLanguage(printSettings, paymentConfig?.panelLanguage || locale);
      const receiptPayload: WebPosReceipt = {
        businessName: merchant?.name || APP_NAME,
        address: [merchant?.address, merchant?.city].filter(Boolean).join(', '),
        phone: merchant?.phone || undefined,
        vatNumber: merchant?.vatNumber || undefined,
        id: `prov-${Date.now()}`,
        orderDisplay: `${ticket.display} (PROV)`,
        orderNumber: ticket.orderNumber,
        completedAt: Date.now(),
        channel: effectiveChannel,
        paymentMethod: 'cash',
        tableLabel,
        items: cart.map((l) => ({
          name: lineExtrasLabel(l) ? `${l.name} (${lineExtrasLabel(l)})` : l.name,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
          productId: l.productId,
          categoryId: l.categoryId,
        })),
        subtotal: totals.subtotal,
        discount: 0,
        taxAmount: totals.tax,
        taxRate,
        rounding: totals.rounding,
        total: totals.total,
        vatIncludedInPrice,
        language: lang,
        paperWidthMm: printSettings?.paperWidthMm || 80,
        header: printSettings?.receiptHeader,
        footer: printSettings?.receiptFooter,
        showVat: printSettings?.receiptShowVatTable !== false,
        showStaff: printSettings?.receiptShowStaffLine !== false,
        staffName: webposStaff?.name,
      };
      const text = generateWebPosReceiptText(receiptPayload, locale);
      await printEscPosToTargets(text, { role: 'receipt' });
      toast.success(t('webPosProvisionalPrinted'));
    } catch (e: any) {
      toast.error(e.message || t('webPosPrintFailed'));
    }
  };

  const onKitchenMessage = (_message: string) => {
    toast.success(t('webPosKitchenMessageSent'));
  };

  const openRegisterCheckout = () => {
    if (!cart.length || busy) return;
    if (channel === 'delivery' && !fulfillmentWhen) {
      setPendingPayMethod('cash');
      setScheduleOpen(true);
      return;
    }
    if (channel === 'delivery' && !selectedCustomer) {
      setPendingPayMethod('cash');
      setCustomerOpen(true);
      return;
    }
    setPosView('checkout');
  };

  const completeCheckoutPay = async (
    method: PosPaymentMethod,
    amountTendered: number | null
  ) => {
    const part = splitQueue[splitIndex];
    const partTotal = part?.amount ?? totals.total;
    const extras: CheckoutResult = {
      method,
      discountPercent: 0,
      tipAmount: 0,
      roundingAmount: totals.rounding,
      total: partTotal,
      amountTendered:
        method === 'cash' ? amountTendered ?? partTotal : amountTendered,
      changeDue:
        method === 'cash' && amountTendered != null
          ? roundMoney2(amountTendered - partTotal)
          : null,
    };
    if (method === 'terminal') {
      setCheckoutExtras(extras);
      await runTerminalPayment(undefined, extras);
      return;
    }
    setBusy(true);
    try {
      const remaining = splitQueue.length > 0 && splitIndex + 1 < splitQueue.length;
      await finalizeSale(method, undefined, undefined, extras, true);
      if (remaining) {
        setSplitIndex((i) => i + 1);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || t('webPosSaleFailed'));
    } finally {
      setBusy(false);
    }
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

  const printPosOrderReceipt = async (order: PosOrderForReceipt, splitLabel?: string | null) => {
    const receiptPayload = posOrderToWebPosReceipt(order, {
      businessName: merchant?.name || APP_NAME,
      address: [merchant?.address, merchant?.city].filter(Boolean).join(', '),
      phone: merchant?.phone || undefined,
      vatNumber: merchant?.vatNumber || undefined,
      taxRate,
      vatIncludedInPrice,
      printSettings,
      panelLang: locale,
      splitLabel,
    });
    const receiptText = generateWebPosReceiptText(receiptPayload, locale);
    await printReceipt(receiptText, receiptPayload.receiptUrl);
  };

  const printKitchenForCart = async (
    lines: CartLine[],
    saleChannel: Channel,
    opts?: {
      orderNumber?: string | null;
      when?: FulfillmentWhen | null;
    }
  ) => {
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
    const customerName = selectedCustomer
      ? [selectedCustomer.firstName, selectedCustomer.lastName].filter(Boolean).join(' ')
      : '';
    const userName =
      (webposStaff?.name || '').trim() ||
      customerName ||
      null;
    const when = opts?.when !== undefined ? opts.when : fulfillmentWhen;
    const scheduledRaw = when?.mode === 'later' ? when.scheduledFor : null;
    const scheduledFor =
      scheduledRaw != null && scheduledRaw !== ''
        ? localDateTimeToIso(String(scheduledRaw)) || scheduledRaw
        : null;

    const kitchenOpts = {
      channel: saleChannel,
      language: lang,
      orderNumber: opts?.orderNumber || null,
      orderedAt: Date.now(),
      scheduledFor,
      userName,
      orderSource: 'WEBPOS' as const,
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

  const buildSalePayload = (
    clientId: string,
    method: PosPaymentMethod,
    whenOverride?: FulfillmentWhen | null,
    orderNumber?: string,
    extras?: CheckoutExtras | null,
    saleLines: CartLine[] = cart,
    saleTotals = activeSale.totals,
    splitMeta?: { masterOrderId?: string; splitCheckNumber?: number }
  ) => {
    const payLater = method === 'pay_later';
    const when = whenOverride !== undefined ? whenOverride : fulfillmentWhen;
    const scheduledRaw = when?.mode === 'later' ? when.scheduledFor : null;
    const scheduledFor =
      scheduledRaw != null && scheduledRaw !== ''
        ? localDateTimeToIso(String(scheduledRaw)) || scheduledRaw
        : null;
    const custName = selectedCustomer
      ? [selectedCustomer.firstName, selectedCustomer.lastName].filter(Boolean).join(' ')
      : undefined;
    const ship = selectedCustomer
      ? [selectedCustomer.defaultAddress, selectedCustomer.defaultZip, selectedCustomer.defaultCity]
          .filter(Boolean)
          .join(', ')
      : undefined;
    const discPct = extras?.discountPercent || 0;
    const merchandiseGross = vatIncludedInPrice
      ? roundMoney2(saleTotals.subtotal + saleTotals.tax)
      : saleTotals.subtotal;
    const discountAmount = roundMoney2((merchandiseGross * discPct) / 100);
    const tipAmount = roundMoney2(extras?.tipAmount || 0);
    const roundingAmount = roundMoney2(
      extras?.roundingAmount != null ? extras.roundingAmount : saleTotals.rounding
    );
    const saleTotal =
      extras?.total != null
        ? roundMoney2(extras.total)
        : roundTo005(merchandiseGross - discountAmount + tipAmount);
    return {
      clientId,
      orderNumber,
      paymentMethod: method,
      paymentStatus: payLater ? 'awaiting_payment' : 'completed',
      status: payLater ? (scheduledFor ? 'accepted' : 'preparing') : 'completed',
      subtotal: saleTotals.subtotal,
      taxAmount: saleTotals.tax,
      discountAmount,
      tipAmount,
      roundingAmount,
      amountTendered: extras?.amountTendered ?? null,
      changeDue: extras?.changeDue ?? null,
      staffName: webposStaff?.name || null,
      total: saleTotal,
      fulfillmentChannel: effectiveChannel,
      completedAt: payLater ? undefined : Date.now(),
      scheduledFor,
      customerId: selectedCustomer?.id || null,
      customerName: custName || null,
      customerPhone: selectedCustomer?.phone || null,
      customerEmail: selectedCustomer?.email || null,
      shippingAddress: ship || null,
      tableId: tableId || null,
      tableLabel: tableLabel || null,
      guestCount: tabNumber || null,
      masterOrderId: splitMeta?.masterOrderId || null,
      splitCheckNumber: splitMeta?.splitCheckNumber ?? null,
      notes: [
        roundingAmount
          ? `Rounding ${roundingAmount > 0 ? '+' : ''}${roundingAmount.toFixed(2)}`
          : '',
        tipAmount > 0 ? `Tip CHF ${tipAmount.toFixed(2)}` : '',
        extras?.amountTendered != null
          ? `Tendered CHF ${extras.amountTendered.toFixed(2)}`
          : '',
        extras?.changeDue != null ? `Change CHF ${extras.changeDue.toFixed(2)}` : '',
        when?.mode === 'later' ? `Pickup/delivery: ${when.label}` : '',
      ]
        .filter(Boolean)
        .join(' · ') || undefined,
      items: saleLines.map((l) => ({
        productClientId: l.productId,
        productId: l.productId,
        productName: l.name,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        totalPrice: l.lineTotal,
        taxAmount: l.taxable
          ? vatIncludedInPrice
            ? extractVatFromGross(l.lineTotal, taxRate)
            : roundMoney2((l.lineTotal * taxRate) / 100)
          : 0,
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
        isOpenPrice: !!l.isOpenPrice,
      })),
    };
  };

  const closePaymentModal = () => {
    paymentAbortRef.current?.abort();
    paymentAbortRef.current = null;
    setPaymentModalOpen(false);
    setPaymentMessage('');
  };

  const finalizeSale = async (
    method: PosPaymentMethod,
    presetClientId?: string,
    whenOverride?: FulfillmentWhen | null,
    extrasOverride?: CheckoutExtras | null,
    showSuccessScreen = false
  ) => {
    const ticket = nextWebPosTicketNumber(merchant?.id);
    const clientId = presetClientId || `webpos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const whenSnapshot =
      whenOverride !== undefined ? whenOverride : fulfillmentWhen;
    const extras = extrasOverride !== undefined ? extrasOverride : checkoutExtras;
    const saleLines = activeSale.lines;
    const saleTotals = activeSale.totals;
    const splitMeta =
      splitQueue.length > 0 && splitMasterIdRef.current
        ? { masterOrderId: splitMasterIdRef.current, splitCheckNumber: splitIndex + 1 }
        : undefined;
    const sale = buildSalePayload(
      clientId,
      method,
      whenSnapshot,
      ticket.orderNumber,
      extras,
      saleLines,
      saleTotals,
      splitMeta
    );

    const pushRes = await api.post('/sync/push-sales', { sales: [sale] });
    const backendOrderId =
      pushRes.data?.results?.find((r: { clientId?: string }) => r.clientId === clientId)?.orderId ||
      pushRes.data?.results?.[0]?.orderId ||
      null;

    const receiptUrl = buildReceiptUrl(clientId);
    const lang = resolveReceiptLanguage(
      printSettings,
      paymentConfig?.panelLanguage || locale
    );
    const paperWidthMm = printSettings?.paperWidthMm || 80;
    const cartSnapshot = [...cart];
    const channelSnapshot = effectiveChannel;
    const shipAddr =
      sale.shippingAddress ||
      (selectedCustomer
        ? [selectedCustomer.defaultAddress, selectedCustomer.defaultZip, selectedCustomer.defaultCity]
            .filter(Boolean)
            .join(', ')
        : '') ||
      undefined;
    const receiptPayload: WebPosReceipt = {
      businessName: merchant?.name || APP_NAME,
      address: [merchant?.address, merchant?.city].filter(Boolean).join(', '),
      phone: merchant?.phone || undefined,
      vatNumber: merchant?.vatNumber || undefined,
      id: clientId,
      orderDisplay: ticket.display,
      orderNumber: ticket.orderNumber,
      completedAt: Date.now(),
      channel: effectiveChannel,
      paymentMethod: method,
      customerName: sale.customerName || undefined,
      customerPhone: sale.customerPhone || undefined,
      shippingAddress: effectiveChannel === 'delivery' ? shipAddr : undefined,
      tableLabel,
      items: saleLines.map((l) => {
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
      subtotal: saleTotals.subtotal,
      discount: 0,
      taxAmount: saleTotals.tax,
      taxRate,
      rounding: saleTotals.rounding,
      tipAmount: sale.tipAmount,
      total: sale.total,
      vatIncludedInPrice,
      splitLabel: activeSale.label,
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
          orderNumber: ticket.orderNumber,
          backendOrderId: backendOrderId || undefined,
          total: sale.total,
          paymentMethod: method,
          channel: effectiveChannel,
          completedAt: Date.now(),
          synced: true,
        },
        ...prev,
      ].slice(0, 30)
    );
    setOrdersRefreshToken((n) => n + 1);
    const moreSplits = splitQueue.length > 0 && splitIndex + 1 < splitQueue.length;
    if (!moreSplits) {
      setCart([]);
      setFulfillmentWhen(null);
      setSelectedCustomer(null);
      setSplitQueue([]);
      setSplitIndex(0);
      splitMasterIdRef.current = null;
      setSelectedLineId(null);
      setKeypadBuffer('');
      setOrderNote('');
      setTableId(null);
      setTableLabel(null);
      setTabNumber(null);
      setActiveCourse(1);
      setChannel(null);
    }
    setCheckoutExtras(null);
    setCheckoutOpen(false);
    const payLater = method === 'pay_later';
    const paidTotal = sale.total;
    if (showSuccessScreen && !payLater && !moreSplits) {
      setSuccessInfo({
        amount: paidTotal,
        changeDue: extras?.changeDue ?? null,
      });
      setPosView('success');
    } else if (!showSuccessScreen || payLater || moreSplits) {
      toast.success(
        payLater
          ? t('webPosProgrammedSaved')
          : moreSplits
            ? t('webPosSplitNext').replace('{n}', String(splitIndex + 2)).replace('{total}', String(splitQueue.length))
            : t('webPosSaleCompleteAmount').replace('{amount}', money(paidTotal))
      );
    }
    const shouldPrintReceipt =
      !payLater && autoPrint && printSettings?.autoPrintReceipt !== false;
    if (shouldPrintReceipt) {
      try {
        await printReceipt(receiptText, receiptUrl);
      } catch (e: any) {
        toast.error(e.message || t('webPosPrintFailed'));
      }
    }
    if (!moreSplits || splitIndex === 0) {
      try {
        await printKitchenForCart(cartSnapshot, channelSnapshot, {
          orderNumber: ticket.display,
          when: whenSnapshot,
        });
      } catch (e: any) {
        toast.error(e.message || t('webPosKitchenPrintFailed'));
      }
    }
  };

  const beginCheckout = (method: PosPaymentMethod | 'express') => {
    if (!cart.length || busy || paymentModalOpen || checkoutOpen) return;
    // Takeaway defaults to ASAP — only open the time popup via "Tap to set time".
    // Delivery still asks for a time if none was chosen yet.
    if (channel === 'delivery' && !fulfillmentWhen) {
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

  const runCheckout = async (
    method: PosPaymentMethod | 'express',
    whenOverride?: FulfillmentWhen | null
  ) => {
    if (whenOverride !== undefined) setFulfillmentWhen(whenOverride);
    if (method === 'express') {
      setBusy(true);
      try {
        await finalizeSale('cash', undefined, whenOverride, {
          method: 'cash',
          discountPercent: 0,
          tipAmount: 0,
          roundingAmount: totals.rounding,
          total: totals.total,
          amountTendered: totals.total,
          changeDue: 0,
        }, true);
      } catch (e: any) {
        toast.error(e.response?.data?.error || e.message || t('webPosSaleFailed'));
      } finally {
        setBusy(false);
      }
      return;
    }
    setCheckoutSeedMethod(method);
    setPosView('checkout');
  };

  const completeFromCheckout = async (result: CheckoutResult) => {
    const part = splitQueue[splitIndex];
    const adjusted: CheckoutResult = part
      ? {
          ...result,
          total: part.amount,
          amountTendered:
            result.method === 'cash'
              ? result.amountTendered ?? part.amount
              : result.amountTendered,
          changeDue:
            result.method === 'cash' && result.amountTendered != null
              ? roundMoney2(result.amountTendered - part.amount)
              : result.changeDue,
        }
      : result;
    setCheckoutExtras(adjusted);
    setCheckoutOpen(false);
    if (adjusted.method === 'terminal') {
      setPaymentMethod('terminal');
      await runTerminalPayment(undefined, adjusted);
      return;
    }
    setBusy(true);
    try {
      const remaining = splitQueue.length > 0 && splitIndex + 1 < splitQueue.length;
      await finalizeSale(adjusted.method, undefined, undefined, adjusted, true);
      if (remaining) {
        setSplitIndex((i) => i + 1);
        setCheckoutSeedMethod('cash');
        setPosView('checkout');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || t('webPosSaleFailed'));
      setPosView('checkout');
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
          const ticket = nextWebPosTicketNumber(merchant?.id);
          await printKitchenForCart(cart, channel, {
            orderNumber: ticket.display,
            when: fulfillmentWhen,
          });
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

  const runTerminalPayment = async (
    whenOverride?: FulfillmentWhen | null,
    extras?: CheckoutExtras | null
  ) => {
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
          amount: activeSale.totals.total,
          terminalId: selectedTerminalId,
          currency: 'CHF',
          saleRef: clientId,
        },
        { signal: abort.signal, timeout: 170_000 }
      );

      const result = res.data.result as { status: string; message?: string; reference?: string };

      if (result.status === 'approved') {
        closePaymentModal();
        await finalizeSale('terminal', clientId, whenOverride, extras, true);
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
  const canCancelOrders =
    !staffConfigured || (!!webposStaff && hasPermission(staffPerms, 'CANCEL_ORDERS'));
  const canRefundOrders =
    !staffConfigured || (!!webposStaff && hasPermission(staffPerms, 'REFUND_ORDERS'));

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

  const customerLabel = selectedCustomer
    ? [selectedCustomer.firstName, selectedCustomer.lastName].filter(Boolean).join(' ') ||
      selectedCustomer.phone ||
      null
    : null;

  const onlinePendingCount = onlineOrders.filter(
    (o) => o.status === 'pending' || o.status === 'pending_approval'
  ).length;

  const tableBadge =
    tableLabel || tabNumber
      ? [tableLabel, tabNumber ? `#${tabNumber}` : ''].filter(Boolean).join(' · ')
      : null;

  const onPosTabChange = (tab: PosTab) => {
    setPosTab(tab);
    setPosView(tab);
    if (tab === 'orders') setOrdersOpen(true);
  };

  return (
    <div
      className={`webpos-shell ${
        appMode ? 'h-dvh' : '-m-3 sm:-m-4 h-[calc(100dvh-4rem)]'
      } flex flex-col bg-stone-100`}
    >
      <WebPosTopBar
        activeTab={posTab}
        posView={posView}
        onTabChange={onPosTabChange}
        merchantName={merchant?.name || t('webPosStore')}
        agentOk={agentOk}
        search={search}
        onSearchChange={setSearch}
        showSearch={posView === 'register'}
        onlinePendingCount={onlinePendingCount}
        staffName={webposStaff?.name}
        canDrawer={canDrawer}
        appMode={appMode}
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen((v) => !v)}
        settingsRef={settingsRef}
        onOnlineOrders={() => {
          setOnlineOrdersOpen(true);
          stopOrderAlertLoop();
        }}
        onSwitchUser={() => setPinModalOpen(true)}
        onOpenDrawer={() => void openCashDrawer()}
        onShowPanel={showPanelMenus}
        tableBadge={tableBadge}
        settingsPanel={
          <WebPosSettingsDropdown
            printerName={printerName}
            printers={printers}
            agentOk={agentOk}
            autoPrint={autoPrint}
            postSuccessTarget={postSuccessTarget}
            onPrinterChange={setPrinterName}
            onAutoPrintChange={setAutoPrint}
            onPostSuccessChange={setPostSuccessTarget}
            onRefreshPrinters={() => {
              void refreshAgent();
              toast.success(t('webPosPrintersRefreshed'));
            }}
            onReloadCatalog={() => {
              void load();
              setSettingsOpen(false);
            }}
          />
        }
      />

      <div className="flex min-h-0 flex-1 flex-col">
        {posView === 'checkout' ? (
          <WebPosCheckoutView
            total={activeSale.totals.total}
            splitLabel={activeSale.label}
            splitGuestCount={splitQueue.length || undefined}
            settings={checkoutSettings}
            methods={{
              cash: enabledMethods.cash,
              card: enabledMethods.card,
              terminal: enabledMethods.terminal,
              payLater: (channel === 'takeaway' || channel === 'delivery') && canPay,
            }}
            busy={busy || paymentModalOpen}
            onBack={() => setPosView('register')}
            onQuickBill={() => void expressSale()}
            onSplit={
              checkoutSettings.splitBillsEnabled && !splitQueue.length
                ? () => {
                    setSplitOpen(true);
                  }
                : undefined
            }
            onPay={(method, amountTendered) => void completeCheckoutPay(method, amountTendered)}
          />
        ) : posView === 'success' && successInfo ? (
          <WebPosSuccessView
            amount={successInfo.amount}
            changeDue={successInfo.changeDue}
            onContinue={() => {
              setSuccessInfo(null);
              const next = postSuccessTarget;
              setPosTab(next);
              setPosView(next);
            }}
          />
        ) : posView === 'tables' ? (
          <WebPosTablesView
            selectedTableId={tableId}
            onSelectTable={(table) => {
              setTableId(table.id);
              setTableLabel(table.label);
              setChannel('dine_in');
              setPosTab('register');
              setPosView('register');
            }}
          />
        ) : posView === 'bookings' ? (
          <WebPosBookingsView />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <WebPosCartPanel
              cart={cart}
              totals={totals}
              taxRate={taxRate}
              money={money}
              expanded={cartExpanded}
              selectedLineId={selectedLineId}
              onSelectLine={setSelectedLineId}
              keypadMode={keypadMode}
              onKeypadModeChange={setKeypadMode}
              keypadBuffer={keypadBuffer}
              onKeypadBufferChange={setKeypadBuffer}
              onKeypadApply={applyKeypadToLine}
              channel={channel}
              onChannelChange={(ch) => {
                setChannel(ch);
                setFulfillmentWhen(null);
                if (ch !== 'delivery') setSelectedCustomer(null);
              }}
              activeCourse={activeCourse}
              coursesEnabled={coursesEnabled}
              orderNote={orderNote}
              tableLabel={tableLabel}
              tabNumber={tabNumber}
              customerLabel={customerLabel}
              busy={busy || paymentModalOpen}
              onCustomer={() => setCustomerOpen(true)}
              onNote={() => setNoteOpen(true)}
              onProvisionalReceipt={() => void printProvisionalReceipt()}
              onHold={() => void holdCurrentOrder(false)}
              onCourse={advanceCourse}
              onKitchenMessage={() => setKitchenMsgOpen(true)}
              onSetTable={() => setSetTableOpen(true)}
              onSetTab={() => setSetTabOpen(true)}
              onSend={() => void sendCoursesToKitchen()}
              onPayment={openRegisterCheckout}
              showSend={showSend}
            />
            <WebPosProductArea
              categories={categories}
              products={visibleProducts}
              categoryId={categoryId}
              onCategoryChange={setCategoryId}
              onProductClick={onProductClick}
              cartQtyByProduct={cartQtyByProduct}
              productHasCombo={(p) => productHasComboSlots(p)}
              productHasMods={(p) => productHasModifiers(p as ShopProductForModifiers)}
            />
          </div>
        )}
      </div>

      <WebPosKitchenMessageModal
        open={kitchenMsgOpen}
        onClose={() => setKitchenMsgOpen(false)}
        onSend={onKitchenMessage}
      />
      <WebPosOrderNoteModal
        open={noteOpen}
        initial={orderNote}
        onClose={() => setNoteOpen(false)}
        onSave={setOrderNote}
      />
      <WebPosSetTableModal
        open={setTableOpen}
        onClose={() => setSetTableOpen(false)}
        selectedTableId={tableId}
        onSelect={(table) => {
          setTableId(table.id);
          setTableLabel(table.label);
          setChannel('dine_in');
        }}
      />
      <WebPosSetTabModal
        open={setTabOpen}
        onClose={() => setSetTabOpen(false)}
        current={tabNumber}
        onConfirm={setTabNumber}
      />

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

      <WebPosTipKeypad
        open={!!pendingOpenPrice}
        title={
          pendingOpenPrice
            ? `${t('webPosEnterPrice')} — ${pendingOpenPrice.name}`
            : t('webPosEnterPrice')
        }
        onClose={() => setPendingOpenPrice(null)}
        onConfirm={(amount) => {
          if (!pendingOpenPrice) return;
          if (amount <= 0) {
            toast.error(t('webPosEnterPrice'));
            return;
          }
          addConfiguredProduct(pendingOpenPrice, amount, [], []);
          setPendingOpenPrice(null);
        }}
      />

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
        onClose={() => {
          setOrdersOpen(false);
          setHighlightOrderId(null);
          setPosTab('register');
          setPosView('register');
        }}
        refreshToken={ordersRefreshToken}
        canCancel={canCancelOrders}
        canRefund={canRefundOrders}
        highlightOrderId={highlightOrderId}
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
        onPrintOrder={async (order, splitLabel) => {
          try {
            await printPosOrderReceipt(order, splitLabel);
          } catch (e: any) {
            toast.error(e.message || t('webPosPrintFailed'));
          }
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
              // Pass `when` directly — setState is async and would otherwise print ASAP
              void runCheckout(m, when);
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
            // Delivery still needs a time if not set; takeaway stays ASAP by default.
            if (!fulfillmentWhen && channel === 'delivery') {
              setPendingPayMethod(m);
              setScheduleOpen(true);
              return;
            }
            void runCheckout(m);
          }
        }}
      />

      <WebPosCheckoutModal
        open={checkoutOpen}
        subtotal={activeSale.totals.subtotal}
        taxAmount={activeSale.totals.tax}
        taxRate={taxRate}
        vatIncludedInPrice={vatIncludedInPrice}
        settings={checkoutSettings}
        methods={{
          cash: paymentConfig?.methods.cash !== false,
          card: paymentConfig?.methods.card !== false,
          terminal: paymentConfig?.methods.terminal === true,
          payLater: true,
        }}
        initialMethod={checkoutSeedMethod}
        onClose={() => {
          setCheckoutOpen(false);
          setSplitQueue([]);
          setSplitIndex(0);
          splitMasterIdRef.current = null;
        }}
        onConfirm={(r) => void completeFromCheckout(r)}
        onSplit={
          checkoutSettings.splitBillsEnabled && !splitQueue.length
            ? () => {
                setCheckoutOpen(false);
                setSplitOpen(true);
              }
            : undefined
        }
      />

      <WebPosSplitBillModal
        open={splitOpen}
        lines={cart.map((l) => ({
          id: l.lineId,
          name: l.name,
          quantity: l.quantity,
          lineTotal: l.lineTotal,
        }))}
        total={totals.total}
        maxParts={checkoutSettings.maxSplitParts}
        onClose={() => setSplitOpen(false)}
        onConfirm={(parts) => {
          setSplitOpen(false);
          splitMasterIdRef.current = crypto.randomUUID();
          setSplitQueue(parts);
          setSplitIndex(0);
          setCheckoutSeedMethod('cash');
          setPosView('checkout');
        }}
      />
    </div>
  );
}
