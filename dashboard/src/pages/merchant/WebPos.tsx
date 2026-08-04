import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { RefreshCw } from 'lucide-react';
import api from '@/lib/api';
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
import {
  WebPosStartShiftModal,
  WebPosCloseShiftModal,
  WebPosShiftClosedModal,
} from '@/components/webpos/WebPosShiftModals';
import { generateEodReportText } from '@/lib/webpos-receipt';
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
import WebPosCancelModal, {
  type CancelScope,
} from '@/components/webpos/WebPosCancelModal';
import WebPosGiftCardModal, {
  type GiftCardCartMeta,
  type GiftCardPayResult,
  type GiftCardSettingsClient,
} from '@/components/webpos/WebPosGiftCardModal';
import type { AppliedPayment } from '@/components/webpos/WebPosCheckoutView';
import type {
  GiftCardLineMeta,
  KeypadMode,
  OpenCartDraft,
  PosChannel,
  PosTab,
  PosView,
} from '@/components/webpos/types';
import { openCartDraftKey } from '@/components/webpos/types';
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
  sku?: string | null;
  barcode?: string | null;
  allowExtras?: boolean;
  extras?: Array<{ id: string; name: string; price: number; isDefault?: boolean }>;
  modifierGroups?: ShopModifierGroup[];
  comboSlots?: ComboSlot[];
};

type Category = { id: string; name: string; color?: string | null };

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
  giftCard?: GiftCardLineMeta;
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

type PosPaymentMethod = 'cash' | 'card' | 'terminal' | 'pay_later' | 'gift_card';

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
    giftCard?: boolean;
  };
  terminalReady: boolean;
  adyenConfigured: boolean;
  defaultTerminalId: string | null;
  terminals: WebPosTerminal[];
  posPrintSettings?: PosPrintSettingsClient | null;
  posCheckoutSettings?: PosCheckoutSettings | null;
  giftCardSettings?: GiftCardSettingsClient | null;
  shopLogoUrl?: string | null;
  panelLanguage?: string | null;
  shiftsEnabled?: boolean;
  posColorTheme?: string;
  coursesEnabled?: boolean;
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
  const [orderSent, setOrderSent] = useState(false);
  const [coursesBulkSent, setCoursesBulkSent] = useState(false);
  const [orderNote, setOrderNote] = useState('');
  const [tableId, setTableId] = useState<string | null>(null);
  const [tableLabel, setTableLabel] = useState<string | null>(null);
  const [tabNumber, setTabNumber] = useState<string | null>(null);
  const [expressSuccessOpen, setExpressSuccessOpen] = useState(false);
  const [shiftsEnabled, setShiftsEnabled] = useState(false);
  const [posColorTheme, setPosColorTheme] = useState('teal');
  const [openShift, setOpenShift] = useState<{
    id: string;
    openingCash: number;
    openedAt: string;
  } | null>(null);
  const [shiftLive, setShiftLive] = useState<{
    cashSales: number;
    cardSales: number;
    terminalSales: number;
    totalSales: number;
    orderCount: number;
    expectedCash: number;
  } | null>(null);
  const [startShiftOpen, setStartShiftOpen] = useState(false);
  const [closeShiftOpen, setCloseShiftOpen] = useState(false);
  const [shiftClosedOpen, setShiftClosedOpen] = useState(false);
  const [shiftBalanced, setShiftBalanced] = useState(true);
  const [shiftBusy, setShiftBusy] = useState(false);
  const pendingAfterShift = useRef<(() => void) | null>(null);
  const [lastClosedShift, setLastClosedShift] = useState<{
    openingCash: number;
    closingCashCounted: number;
    expectedCash: number;
    cashSales: number;
    cardSales: number;
    terminalSales: number;
    otherSales: number;
    orderCount: number;
    variance: number | null;
    reportPeriod: { from: string; to: string };
  } | null>(null);
  const [kitchenMsgOpen, setKitchenMsgOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [setTableOpen, setSetTableOpen] = useState(false);
  const [setTabOpen, setSetTabOpen] = useState(false);
  const [postSuccessTarget, setPostSuccessTarget] = useState<'register' | 'tables'>(() => {
    const stored = localStorage.getItem('manupos_webpos_post_success');
    return stored === 'tables' || stored === 'register' ? stored : 'register';
  });
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
  const [provisionalPrinted, setProvisionalPrinted] = useState(false);
  const [cancelModal, setCancelModal] = useState<{
    scope: CancelScope;
    lineId?: string;
  } | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutSeedMethod, setCheckoutSeedMethod] = useState<
    PosPaymentMethod | 'express'
  >('cash');
  const [checkoutExtras, setCheckoutExtras] = useState<CheckoutExtras | null>(null);
  const [giftCardOpsOpen, setGiftCardOpsOpen] = useState(false);
  const [giftCardPayOpen, setGiftCardPayOpen] = useState(false);
  const [giftCardPayDue, setGiftCardPayDue] = useState(0);
  const [giftPayInject, setGiftPayInject] = useState<AppliedPayment | null>(null);
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
  const [pinModalMode, setPinModalMode] = useState<'gate' | 'switch'>('gate');
  const [webposStaff, setWebposStaff] = useState<WebPosStaffSession | null>(() => loadWebPosStaffSession());
  const [staffConfigured, setStaffConfigured] = useState(false);
  const scanBufferRef = useRef('');
  const scanTimerRef = useRef<number | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  /** Session-only open carts keyed by table / tab / channel */
  const openCartDraftsRef = useRef<Map<string, OpenCartDraft>>(new Map());
  const [draftVersion, setDraftVersion] = useState(0);
  const draftTableIds = useMemo(
    () =>
      [...openCartDraftsRef.current.keys()]
        .filter((k) => k.startsWith('table:'))
        .map((k) => k.slice(6)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draftVersion]
  );

  const cartCount = useMemo(() => cart.reduce((n, l) => n + l.quantity, 0), [cart]);

  const cartQtyByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of cart) {
      map.set(l.productId, (map.get(l.productId) || 0) + l.quantity);
    }
    return map;
  }, [cart]);

  const hideTab = !!tableLabel;
  const pinGateRequired = staffConfigured && !webposStaff;

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

  /** Menu prices include VAT (gross); prices are not tax-exclusive. */
  const vatIncludedInPrice = merchant?.taxIncludedInPrice === true;

  const checkoutSettings = useMemo(
    () => normalizePosCheckoutSettings(paymentConfig?.posCheckoutSettings),
    [paymentConfig?.posCheckoutSettings]
  );
  const posMode = checkoutSettings.posMode === 'retail' ? 'retail' : 'restaurant';
  const isRetail = posMode === 'retail';
  const retailTakeawayEnabled = checkoutSettings.retailTakeawayEnabled;
  const retailDeliveryEnabled = checkoutSettings.retailDeliveryEnabled;
  const showChannelTabs = isRetail
    ? retailTakeawayEnabled || retailDeliveryEnabled
    : true;
  const channelTabOptions: Array<'takeaway' | 'delivery'> = isRetail
    ? [
        ...(retailTakeawayEnabled ? (['takeaway'] as const) : []),
        ...(retailDeliveryEnabled ? (['delivery'] as const) : []),
      ]
    : ['takeaway', 'delivery'];
  const kitchenEnabled = !isRetail;
  const coursesEnabled = !!merchant?.coursesEnabled && kitchenEnabled;
  const showSend =
    kitchenEnabled &&
    (channel === 'takeaway' || channel === 'delivery' || !!tableLabel);
  const cartSide = checkoutSettings.cartSide === 'left' ? 'left' : 'right';
  const courseSendMode = checkoutSettings.courseSendMode || 'fire_per_course';

  const courseNumbers = useMemo(() => {
    const set = new Set<number>();
    for (const l of cart) {
      if (l.courseNumber) set.add(l.courseNumber);
    }
    if (coursesEnabled && cart.length > 0) set.add(activeCourse);
    return Array.from(set).sort((a, b) => a - b);
  }, [cart, activeCourse, coursesEnabled]);

  useEffect(() => {
    const fromSettings = checkoutSettings.postSuccessTarget;
    if (fromSettings === 'tables' || fromSettings === 'register') {
      setPostSuccessTarget(isRetail ? 'register' : fromSettings);
    }
  }, [checkoutSettings.postSuccessTarget, isRetail]);

  // Retail has no tables tab — keep post-success on register.
  useEffect(() => {
    if (isRetail && postSuccessTarget === 'tables') {
      setPostSuccessTarget('register');
    }
  }, [isRetail, postSuccessTarget]);

  useEffect(() => {
    if (isRetail && (posTab === 'tables' || posTab === 'bookings')) {
      setPosTab('register');
      setPosView('register');
    }
  }, [isRetail, posTab]);

  const showFireCourseButton =
    coursesEnabled &&
    courseSendMode === 'fire_per_course' &&
    coursesBulkSent &&
    activeCourse > 1;
  const hasUnsentItems = cart.some((l) => !l.sentToKitchen);
  const showNewOrderButton =
    orderSent &&
    !showFireCourseButton &&
    !(courseSendMode === 'fire_per_course' && hasUnsentItems);
  const sendLabel = useMemo(() => {
    if (showFireCourseButton) {
      return t('webPosFireCourse').replace('{n}', String(activeCourse));
    }
    return t('webPosSend');
  }, [showFireCourseButton, activeCourse, t]);

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

  /** @deprecated alias - full cart totals for sidebar display */
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

  const shiftsEnabledRef = useRef(shiftsEnabled);
  shiftsEnabledRef.current = shiftsEnabled;
  const shiftMigrateToastRef = useRef(false);

  const refreshCurrentShift = useCallback(async (enabled?: boolean) => {
    const on = enabled ?? shiftsEnabledRef.current;
    if (!on) {
      setOpenShift(null);
      setShiftLive(null);
      return;
    }
    try {
      const res = await api.get('/merchant/pos/shifts/current');
      const shift = res.data.shift as {
        id: string;
        openingCash: number;
        openedAt: string;
      } | null;
      const live = res.data.live as {
        cashSales: number;
        cardSales: number;
        terminalSales: number;
        totalSales: number;
        orderCount: number;
        expectedCash: number;
      } | null;
      if (shift) {
        setOpenShift({
          id: shift.id,
          openingCash: Number(shift.openingCash) || 0,
          openedAt: String(shift.openedAt),
        });
        setShiftLive(live);
      } else {
        setOpenShift(null);
        setShiftLive(null);
      }
    } catch (e: any) {
      const msg = String(e?.response?.data?.error || e?.message || '');
      // Surface missing DB migration once so shift UI is not silently dead.
      if (
        on &&
        !shiftMigrateToastRef.current &&
        /shifts_enabled|pos_shifts|does not exist|column/i.test(msg)
      ) {
        shiftMigrateToastRef.current = true;
        toast.error(
          `${t('webPosShiftStartFailed')}: DB migrate required (backend/sql/ensure-shifts.sql)`
        );
      }
    }
  }, [t]);

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
      const cfg = webposRes.data.config as (WebPosPaymentConfig & {
        shiftsSchemaMissing?: boolean;
      }) | null;
      // Either source can enable; avoids hiding shifts when one payload omits the flag.
      const shiftsOn = !!(cfg?.shiftsEnabled || merch?.shiftsEnabled);
      const theme =
        (cfg?.posColorTheme || merch?.posColorTheme || 'teal').toLowerCase();
      setShiftsEnabled(shiftsOn);
      shiftsEnabledRef.current = shiftsOn;
      if (cfg?.shiftsSchemaMissing && !shiftMigrateToastRef.current) {
        shiftMigrateToastRef.current = true;
        toast.error(
          `${t('webPosShiftStartFailed')}: DB migrate required (backend/sql/ensure-shifts.sql)`
        );
      }
      setPosColorTheme(
        ['teal', 'green', 'blue', 'violet'].includes(theme) ? theme : 'teal'
      );
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
      const hasPins = staffList.some(
        (s: { pinSet?: boolean; isActive?: boolean }) => s.pinSet && s.isActive !== false
      );
      setStaffConfigured(hasPins);
      if (hasPins && !loadWebPosStaffSession()) {
        setPinModalMode('gate');
        setPinModalOpen(true);
      }
      const prods = prodRes.data.products || prodRes.data || [];
      setProducts(
        prods.map((p: any) => ({
          ...p,
          name: repairCatalogText(p.name),
          price: Number(p.price),
          sku: p.sku ?? null,
          barcode: p.barcode ?? null,
        }))
      );
      await refreshAgent();
      await refreshCurrentShift(shiftsOn);
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('webPosLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [refreshAgent, refreshCurrentShift, t]);

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

  // Browsers block audio until a user gesture - unlock AudioContext on first tap
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

  const ensureShift = useCallback(
    (action: () => void) => {
      if (!shiftsEnabled || openShift) {
        action();
        return;
      }
      pendingAfterShift.current = action;
      setStartShiftOpen(true);
    },
    [shiftsEnabled, openShift]
  );

  const addConfiguredProduct = (
    p: Product,
    unitPrice: number,
    selectedExtras: ShopSelectedExtra[] = [],
    comboSelections: ShopComboSelection[] = []
  ) => {
    const doAdd = () => {
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
    ensureShift(doAdd);
  };

  const onProductClick = (p: Product) => {
    ensureShift(() => {
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
      // Bypass ensureShift re-entry - shift already confirmed
      const price = roundMoney2(Number(p.price) || 0);
      setCart((prev) => {
        const existing = prev.find(
          (l) =>
            l.productId === p.id &&
            !l.isOpenPrice &&
            lineSignature(l.selectedExtras, l.comboSelections) === ''
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
            lineId: `${p.id}-${Date.now()}-plain`,
            productId: p.id,
            name: p.name,
            quantity: 1,
            unitPrice: price,
            lineTotal: price,
            taxable: p.isTaxable !== false,
            categoryId: p.categoryId,
            selectedExtras: [],
            comboSelections: [],
            isOpenPrice: false,
            courseNumber: coursesEnabled ? activeCourse : undefined,
          },
        ];
      });
    });
  };

  const handleStartShift = async (openingCash: number) => {
    setShiftBusy(true);
    try {
      const res = await api.post('/merchant/pos/shifts/start', {
        openingCash,
        staffId: webposStaff?.id || null,
        staffName: webposStaff?.name || null,
      });
      const shift = res.data.shift as {
        id: string;
        openingCash: number;
        openedAt: string;
      };
      setOpenShift({
        id: shift.id,
        openingCash: Number(shift.openingCash) || 0,
        openedAt: String(shift.openedAt),
      });
      setShiftLive({
        cashSales: 0,
        cardSales: 0,
        terminalSales: 0,
        totalSales: 0,
        orderCount: 0,
        expectedCash: Number(shift.openingCash) || 0,
      });
      setStartShiftOpen(false);
      toast.success(t('webPosShiftStarted'));
      const pending = pendingAfterShift.current;
      pendingAfterShift.current = null;
      if (pending) pending();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('webPosShiftStartFailed'));
    } finally {
      setShiftBusy(false);
    }
  };

  const openCloseShiftModal = async () => {
    if (!openShift) return;
    setSettingsOpen(false);
    await refreshCurrentShift(true);
    setCloseShiftOpen(true);
  };

  const handleCloseShift = async (closingCash: number) => {
    setShiftBusy(true);
    try {
      const res = await api.post('/merchant/pos/shifts/close', {
        closingCashCounted: closingCash,
      });
      const shift = res.data.shift as {
        openingCash: number;
        closingCashCounted: number;
        expectedCash: number;
        cashSales: number;
        cardSales: number;
        terminalSales: number;
        otherSales: number;
        orderCount: number;
        variance: number | null;
      };
      const reportPeriod = res.data.reportPeriod as { from: string; to: string };
      const balanced = !!res.data.balanced;
      setLastClosedShift({
        openingCash: Number(shift.openingCash) || 0,
        closingCashCounted: Number(shift.closingCashCounted) || 0,
        expectedCash: Number(shift.expectedCash) || 0,
        cashSales: Number(shift.cashSales) || 0,
        cardSales: Number(shift.cardSales) || 0,
        terminalSales: Number(shift.terminalSales) || 0,
        otherSales: Number(shift.otherSales) || 0,
        orderCount: Number(shift.orderCount) || 0,
        variance: shift.variance != null ? Number(shift.variance) : null,
        reportPeriod,
      });
      setShiftBalanced(balanced);
      setOpenShift(null);
      setShiftLive(null);
      setCloseShiftOpen(false);
      setShiftClosedOpen(true);
      toast.success(t('webPosShiftClosedToast'));
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('webPosShiftCloseFailed'));
    } finally {
      setShiftBusy(false);
    }
  };

  const printShiftEod = async () => {
    if (!lastClosedShift) {
      toast.error(t('webPosShiftNoReport'));
      return;
    }
    try {
      const fromYmd = lastClosedShift.reportPeriod.from.slice(0, 10);
      const toYmd = lastClosedShift.reportPeriod.to.slice(0, 10);
      let report: {
        salesCount: number;
        revenue: number;
        subtotal?: number;
        taxTotal: number;
        netTotal?: number;
        tipsTotal?: number;
        grandTotal?: number;
        refundTotal: number;
        cancelledCount: number;
        cancelledTotal: number;
        cashTotal: number;
        cardTotal: number;
        terminalTotal: number;
        coversServed?: number | null;
        vatRows?: Array<{ label: string; net: number; tva: number; brut: number }>;
        productsSold: Array<{ name: string; quantity: number; total: number }>;
        paymentRows: Array<{ method: string; count: number; total: number; percent?: number }>;
        orderTypeRows?: Array<{ label: string; count: number; total: number; percent?: number }>;
        channelRows?: Array<{ channel: string; count: number; total: number }>;
        range?: { label: string; from: string; to: string };
      } | null = null;
      // Waiters without VIEW_REPORTS/END_OF_DAY only get their own shift totals (no company EOD).
      const mayFetchCompanyEod =
        !staffConfigured ||
        (!!webposStaff &&
          (hasPermission(webposStaff.permissions, 'VIEW_REPORTS') ||
            hasPermission(webposStaff.permissions, 'END_OF_DAY')));
      if (mayFetchCompanyEod) {
        try {
          const repRes = await api.get('/merchant/reports/eod', {
            params: { preset: 'custom', from: fromYmd, to: toYmd },
          });
          report = repRes.data.report;
        } catch {
          report = null;
        }
      }
      const totalSales =
        lastClosedShift.cashSales +
        lastClosedShift.cardSales +
        lastClosedShift.terminalSales +
        lastClosedShift.otherSales;
      const lang = resolveReceiptLanguage(printSettings, locale);
      const text = generateEodReportText({
        label: report?.range?.label || t('webPosShiftEodLabel'),
        periodFrom: lastClosedShift.reportPeriod.from,
        periodTo: lastClosedShift.reportPeriod.to,
        salesCount: report?.salesCount ?? lastClosedShift.orderCount,
        revenue: report?.revenue ?? totalSales,
        subtotal: report?.subtotal ?? totalSales,
        taxTotal: report?.taxTotal ?? 0,
        netTotal: report?.netTotal,
        tipsTotal: report?.tipsTotal,
        grandTotal: report?.grandTotal ?? totalSales,
        refundTotal: report?.refundTotal ?? 0,
        cancelledCount: report?.cancelledCount ?? 0,
        cancelledTotal: report?.cancelledTotal ?? 0,
        cashTotal: report?.cashTotal ?? lastClosedShift.cashSales,
        cardTotal: report?.cardTotal ?? lastClosedShift.cardSales,
        terminalTotal: report?.terminalTotal ?? lastClosedShift.terminalSales,
        coversServed: report?.coversServed,
        vatRows: report?.vatRows,
        productsSold: report?.productsSold ?? [],
        paymentRows:
          report?.paymentRows ??
          [
            { method: 'cash', count: 0, total: lastClosedShift.cashSales },
            { method: 'card', count: 0, total: lastClosedShift.cardSales },
            { method: 'terminal', count: 0, total: lastClosedShift.terminalSales },
          ].filter((r) => r.total > 0),
        orderTypeRows: report?.orderTypeRows,
        channelRows: report?.channelRows,
        businessName: merchant?.name || APP_NAME,
        language: lang,
        paperWidthMm: printSettings?.paperWidthMm || 80,
        header: printSettings?.receiptHeader,
        footer: printSettings?.receiptFooter,
        shiftCash: {
          openingFloat: lastClosedShift.openingCash,
          cashSales: lastClosedShift.cashSales,
          expectedCash: lastClosedShift.expectedCash,
          closingCashCounted: lastClosedShift.closingCashCounted,
          variance: lastClosedShift.variance,
          staffName: webposStaff?.name || null,
        },
      });
      await printEscPosToTargets(text, { role: 'eod' });
    } catch (e: any) {
      toast.error(e.message || t('webPosPrintFailed'));
    }
  };

  const handleRestartShift = () => {
    setShiftClosedOpen(false);
    pendingAfterShift.current = null;
    setStartShiftOpen(true);
  };

  /** EOD print/download when cash shifts are disabled (late-night venues). */
  const printTodayEod = async () => {
    try {
      const repRes = await api.get('/merchant/reports/eod', { params: { preset: 'today' } });
      const report = repRes.data.report as {
        salesCount: number;
        revenue: number;
        subtotal?: number;
        taxTotal: number;
        netTotal?: number;
        tipsTotal?: number;
        grandTotal?: number;
        refundTotal: number;
        cancelledCount: number;
        cancelledTotal: number;
        cashTotal: number;
        cardTotal: number;
        terminalTotal: number;
        coversServed?: number | null;
        vatRows?: Array<{ label: string; net: number; tva: number; brut: number }>;
        productsSold: Array<{ name: string; quantity: number; total: number }>;
        paymentRows: Array<{ method: string; count: number; total: number; percent?: number }>;
        orderTypeRows?: Array<{ label: string; count: number; total: number; percent?: number }>;
        channelRows?: Array<{ channel: string; count: number; total: number }>;
        range?: { label: string; from: string; to: string };
        shiftCash?: Array<{
          openingFloat: number;
          cashSales: number;
          expectedCash: number;
          closingCashCounted?: number | null;
          variance?: number | null;
          staffName?: string | null;
        }>;
      };
      const lang = resolveReceiptLanguage(printSettings, locale);
      const text = generateEodReportText({
        label: report?.range?.label || t('webPosEodReport'),
        periodFrom: report?.range?.from,
        periodTo: report?.range?.to,
        salesCount: report?.salesCount ?? 0,
        revenue: report?.revenue ?? 0,
        subtotal: report?.subtotal ?? report?.revenue ?? 0,
        taxTotal: report?.taxTotal ?? 0,
        netTotal: report?.netTotal,
        tipsTotal: report?.tipsTotal,
        grandTotal: report?.grandTotal ?? report?.revenue ?? 0,
        refundTotal: report?.refundTotal ?? 0,
        cancelledCount: report?.cancelledCount ?? 0,
        cancelledTotal: report?.cancelledTotal ?? 0,
        cashTotal: report?.cashTotal ?? 0,
        cardTotal: report?.cardTotal ?? 0,
        terminalTotal: report?.terminalTotal ?? 0,
        coversServed: report?.coversServed,
        vatRows: report?.vatRows,
        productsSold: report?.productsSold ?? [],
        paymentRows: report?.paymentRows ?? [],
        orderTypeRows: report?.orderTypeRows,
        channelRows: report?.channelRows,
        businessName: merchant?.name || APP_NAME,
        language: lang,
        paperWidthMm: printSettings?.paperWidthMm || 80,
        header: printSettings?.receiptHeader,
        footer: printSettings?.receiptFooter,
        shiftCash: report?.shiftCash,
      });
      await printEscPosToTargets(text, { role: 'eod' });
      toast.success(t('webPosEodPrinted'));
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || t('webPosPrintFailed'));
    }
  };

  const lineTotalFor = (unitPrice: number, quantity: number, discountPercent = 0) =>
    roundMoney2(unitPrice * quantity * (1 - discountPercent / 100));

  const removeSelectedLine = (line: CartLine) => {
    if (line.sentToKitchen) {
      setCancelModal({ scope: 'item', lineId: line.lineId });
      return;
    }
    setCart((prev) => prev.filter((l) => l.lineId !== line.lineId));
    setSelectedLineId(null);
    setKeypadBuffer('');
  };

  /** Apply a numeric buffer to the selected cart line. Live typing keeps the buffer. */
  const applyKeypadValue = (
    raw: string,
    opts?: { clearBuffer?: boolean; allowQtyDelete?: boolean; silentInvalid?: boolean }
  ) => {
    if (!selectedLineId) return;
    const clearBuffer = opts?.clearBuffer ?? false;
    const allowQtyDelete = opts?.allowQtyDelete ?? false;
    const silentInvalid = opts?.silentInvalid ?? false;

    // Incomplete entry while typing (e.g. ".", "12.")
    if (raw === '' || raw === '-' || raw === '.' || raw === '-.' || raw.endsWith('.')) {
      if (!silentInvalid && clearBuffer) toast.error(t('webPosEnterPrice'));
      return;
    }

    const value = Number(raw);
    if (!Number.isFinite(value)) {
      if (!silentInvalid) toast.error(t('webPosEnterPrice'));
      return;
    }

    const selected = cart.find((l) => l.lineId === selectedLineId);
    if (!selected) return;

    if (keypadMode === 'qty' && Math.round(value) <= 0) {
      if (!allowQtyDelete) return;
      removeSelectedLine(selected);
      return;
    }

    if (selected.sentToKitchen && (keypadMode === 'qty' || keypadMode === 'price')) {
      if (!silentInvalid) toast.error(t('webPosCancelSentToEdit'));
      return;
    }

    setCart((prev) =>
      prev.map((l) => {
        if (l.lineId !== selectedLineId) return l;
        if (keypadMode === 'qty') {
          const quantity = Math.max(1, Math.round(value));
          return {
            ...l,
            quantity,
            lineTotal: lineTotalFor(l.unitPrice, quantity, l.lineDiscountPercent || 0),
          };
        }
        if (keypadMode === 'percent') {
          const pct = Math.max(0, Math.min(100, value));
          return {
            ...l,
            lineDiscountPercent: pct,
            lineTotal: lineTotalFor(l.unitPrice, l.quantity, pct),
          };
        }
        const unitPrice = roundMoney2(Math.max(0, value));
        return {
          ...l,
          unitPrice,
          isOpenPrice: true,
          lineTotal: lineTotalFor(unitPrice, l.quantity, l.lineDiscountPercent || 0),
        };
      })
    );
    if (clearBuffer) setKeypadBuffer('');
  };

  const applyKeypadToLine = () => {
    applyKeypadValue(keypadBuffer, { clearBuffer: true, allowQtyDelete: true });
  };

  const handleKeypadBufferChange = (buf: string) => {
    setKeypadBuffer(buf);
    applyKeypadValue(buf, { clearBuffer: false, allowQtyDelete: false, silentInvalid: true });
  };

  const handleKeypadModeChange = (mode: KeypadMode) => {
    setKeypadMode(mode);
    setKeypadBuffer('');
  };

  const handleSelectLine = (lineId: string | null) => {
    setSelectedLineId(lineId);
    setKeypadBuffer('');
  };

  const handleKeypadAdjust = (delta: number) => {
    if (!selectedLineId) return;
    const selected = cart.find((l) => l.lineId === selectedLineId);
    if (!selected) return;

    if (keypadMode === 'qty' || keypadMode === 'price') {
      if (selected.sentToKitchen) {
        toast.error(t('webPosCancelSentToEdit'));
        return;
      }
    }

    setKeypadBuffer('');

    if (keypadMode === 'qty') {
      const next = selected.quantity + delta;
      if (next <= 0) {
        removeSelectedLine(selected);
        return;
      }
      setCart((prev) =>
        prev.map((l) =>
          l.lineId !== selectedLineId
            ? l
            : {
                ...l,
                quantity: next,
                lineTotal: lineTotalFor(l.unitPrice, next, l.lineDiscountPercent || 0),
              }
        )
      );
      return;
    }

    if (keypadMode === 'percent') {
      const pct = Math.max(0, Math.min(100, (selected.lineDiscountPercent || 0) + delta));
      setCart((prev) =>
        prev.map((l) =>
          l.lineId !== selectedLineId
            ? l
            : {
                ...l,
                lineDiscountPercent: pct,
                lineTotal: lineTotalFor(l.unitPrice, l.quantity, pct),
              }
        )
      );
      return;
    }

    const unitPrice = roundMoney2(Math.max(0, selected.unitPrice + delta));
    setCart((prev) =>
      prev.map((l) =>
        l.lineId !== selectedLineId
          ? l
          : {
              ...l,
              unitPrice,
              isOpenPrice: true,
              lineTotal: lineTotalFor(unitPrice, l.quantity, l.lineDiscountPercent || 0),
            }
      )
    );
  };

  const handleKeypadBackspace = () => {
    if (!selectedLineId) return;

    if (keypadBuffer.length > 0) {
      const next = keypadBuffer.slice(0, -1);
      setKeypadBuffer(next);
      if (next !== '' && next !== '-' && next !== '.' && next !== '-.' && !next.endsWith('.')) {
        applyKeypadValue(next, { clearBuffer: false, allowQtyDelete: false, silentInvalid: true });
      }
      return;
    }

    const selected = cart.find((l) => l.lineId === selectedLineId);
    if (!selected) return;

    // 1st ⌫ (buffer empty): zero item price
    if (selected.unitPrice !== 0) {
      if (selected.sentToKitchen) {
        toast.error(t('webPosCancelSentToEdit'));
        return;
      }
      setCart((prev) =>
        prev.map((l) =>
          l.lineId !== selectedLineId
            ? l
            : {
                ...l,
                unitPrice: 0,
                isOpenPrice: true,
                lineTotal: 0,
              }
        )
      );
      return;
    }

    // 2nd ⌫: remove line
    removeSelectedLine(selected);
  };

  const advanceCourse = () => {
    if (!coursesEnabled) return;
    // Stamp current cart items without a course onto the active course, then open next
    setCart((prev) =>
      prev.map((l) =>
        l.courseNumber ? l : { ...l, courseNumber: activeCourse }
      )
    );
    const next = Math.max(activeCourse, ...courseNumbers, 0) + 1;
    setActiveCourse(next);
    toast.success(`${t('webPosCourse')} ${next}`);
  };

  const fireCourseLines = async (lines: CartLine[], courseOnly?: number) => {
    const ticket = nextWebPosTicketNumber(merchant?.id);
    await printKitchenForCart(lines, effectiveChannel, {
      orderNumber: ticket.display,
      when: fulfillmentWhen,
      courseOnly,
    });
    const ids = new Set(lines.map((l) => l.lineId));
    setCart((prev) =>
      prev.map((l) => (ids.has(l.lineId) ? { ...l, sentToKitchen: true } : l))
    );
  };

  /** Clear operator editing UI without deleting table/tab kitchen drafts. */
  const releaseOperatorAfterKitchen = (
    sentCart: CartLine[],
    opts?: { draftActiveCourse?: number }
  ) => {
    const wasTable = !!tableId;
    const pendingCourses = sentCart
      .filter((l) => !l.sentToKitchen)
      .map((l) => l.courseNumber || 1)
      .sort((a, b) => a - b);
    const draftActiveCourse =
      opts?.draftActiveCourse ?? pendingCourses[0] ?? activeCourse;
    if (tableId || tabNumber) {
      const key = openCartDraftKey({ tableId, tabNumber, channel: tableId ? 'dine_in' : channel });
      openCartDraftsRef.current.set(key, {
        cart: sentCart,
        channel: tableId ? 'dine_in' : channel,
        tableId,
        tableLabel,
        tabNumber,
        orderNote,
        activeCourse: draftActiveCourse,
        orderSent: true,
        coursesBulkSent: true,
        selectedLineId: null,
        keypadBuffer: '',
      });
      setDraftVersion((n) => n + 1);
    }
    setCart([]);
    setSelectedLineId(null);
    setKeypadBuffer('');
    setOrderNote('');
    setTableId(null);
    setTableLabel(null);
    setTabNumber(null);
    setActiveCourse(1);
    setOrderSent(false);
    setCoursesBulkSent(false);
    setChannel(null);
    setFulfillmentWhen(null);
    setSelectedCustomer(null);
    setProvisionalPrinted(false);
    if (wasTable) {
      setPosTab('tables');
      setPosView('tables');
    } else {
      setPosTab('register');
      setPosView('register');
    }
  };

  const sendCoursesToKitchen = async () => {
    if (!cart.length) return;
    setBusy(true);
    try {
      if (showFireCourseButton) {
        const lines = cart.filter(
          (l) => (l.courseNumber || 1) === activeCourse && !l.sentToKitchen
        );
        if (!lines.length) {
          toast.error(t('webPosNoItemsInCourse'));
          return;
        }
        await fireCourseLines(lines, activeCourse);
        toast.success(t('webPosFireCourseDone').replace('{n}', String(activeCourse)));
        const sentIds = new Set(lines.map((l) => l.lineId));
        const sentCart = cart.map((l) =>
          sentIds.has(l.lineId) ? { ...l, sentToKitchen: true } : l
        );
        releaseOperatorAfterKitchen(sentCart);
        return;
      }

      const stamped = cart.map((l) =>
        l.courseNumber || !coursesEnabled
          ? l
          : { ...l, courseNumber: activeCourse }
      );
      const unsent = stamped.filter((l) => !l.sentToKitchen);
      let toSend: CartLine[];
      if (coursesEnabled && courseSendMode === 'fire_per_course') {
        // SEND fires Course 1; later courses wait for FIRE Course N
        const course1 = unsent.filter((l) => (l.courseNumber || 1) === 1);
        if (course1.length) {
          toSend = course1;
        } else if (unsent.length) {
          const minCourse = Math.min(...unsent.map((l) => l.courseNumber || 1));
          toSend = unsent.filter((l) => (l.courseNumber || 1) === minCourse);
        } else {
          toSend = stamped;
        }
      } else {
        toSend = unsent.length > 0 ? unsent : stamped;
      }

      await fireCourseLines(toSend);
      setOrderSent(true);
      setCoursesBulkSent(true);
      toast.success(t('webPosHeldSentKitchen'));
      const sentIds = new Set(toSend.map((l) => l.lineId));
      const sentCart = stamped.map((l) =>
        sentIds.has(l.lineId) ? { ...l, sentToKitchen: true } : l
      );
      releaseOperatorAfterKitchen(sentCart);
    } catch (e: any) {
      toast.error(e.message || t('webPosKitchenPrintFailed'));
    } finally {
      setBusy(false);
    }
  };

  const snapshotOpenCartDraft = (): OpenCartDraft => ({
    cart,
    channel,
    tableId,
    tableLabel,
    tabNumber,
    orderNote,
    activeCourse,
    orderSent,
    coursesBulkSent,
    selectedLineId,
    keypadBuffer,
  });

  const saveOpenCartDraft = (override?: Partial<OpenCartDraft>) => {
    const snap = { ...snapshotOpenCartDraft(), ...override };
    const key = openCartDraftKey({
      tableId: snap.tableId,
      tabNumber: snap.tabNumber,
      channel: snap.channel,
    });
    if (snap.cart.length > 0 || snap.orderSent) {
      openCartDraftsRef.current.set(key, snap);
    } else {
      openCartDraftsRef.current.delete(key);
    }
    setDraftVersion((n) => n + 1);
    return key;
  };

  const applyOpenCartDraft = (draft: OpenCartDraft) => {
    setCart(draft.cart);
    setChannel(draft.channel);
    setTableId(draft.tableId);
    setTableLabel(draft.tableLabel);
    setTabNumber(draft.tabNumber);
    setOrderNote(draft.orderNote);
    setActiveCourse(draft.activeCourse);
    setOrderSent(draft.orderSent);
    setCoursesBulkSent(draft.coursesBulkSent);
    setSelectedLineId(draft.selectedLineId);
    setKeypadBuffer(draft.keypadBuffer);
  };

  /** Attach current cart lines to a table (Set table) — never wipe the cart. */
  const assignCartToTable = (table: { id: string; label: string }) => {
    const fromKey = openCartDraftKey({ tableId, tabNumber, channel });
    const toKey = openCartDraftKey({ tableId: table.id, channel: 'dine_in' });
    const existing = fromKey !== toKey ? openCartDraftsRef.current.get(toKey) : undefined;

    const movingCart = cart;
    let nextCart = movingCart;
    let nextNote = orderNote;
    let nextCourse = activeCourse;
    let nextOrderSent = orderSent;
    let nextCoursesBulkSent = coursesBulkSent;

    if (existing && (existing.cart.length > 0 || existing.orderSent)) {
      const existingIds = new Set(existing.cart.map((l) => l.lineId));
      const incoming = movingCart.filter((l) => !existingIds.has(l.lineId));
      nextCart = [...existing.cart, ...incoming];
      nextOrderSent = existing.orderSent || orderSent;
      nextCoursesBulkSent = existing.coursesBulkSent || coursesBulkSent;
      nextCourse = Math.max(existing.activeCourse || 1, activeCourse || 1);
      if (existing.orderNote && orderNote && existing.orderNote !== orderNote) {
        nextNote = `${existing.orderNote} · ${orderNote}`;
      } else {
        nextNote = orderNote || existing.orderNote || '';
      }
    }

    if (fromKey !== toKey) {
      openCartDraftsRef.current.delete(fromKey);
    }

    setCart(nextCart);
    setTableId(table.id);
    setTableLabel(table.label);
    setChannel('dine_in');
    setTabNumber(null);
    setOrderNote(nextNote);
    setActiveCourse(nextCourse);
    setOrderSent(nextOrderSent);
    setCoursesBulkSent(nextCoursesBulkSent);
    setFulfillmentWhen(null);

    openCartDraftsRef.current.set(toKey, {
      cart: nextCart,
      channel: 'dine_in',
      tableId: table.id,
      tableLabel: table.label,
      tabNumber: null,
      orderNote: nextNote,
      activeCourse: nextCourse,
      orderSent: nextOrderSent,
      coursesBulkSent: nextCoursesBulkSent,
      selectedLineId,
      keypadBuffer,
    });
    setDraftVersion((n) => n + 1);
    setPosTab('register');
    setPosView('register');
  };

  /** Open a table from the Tables plan (load that table's draft / empty order). */
  const switchToTableOrder = (table: { id: string; label: string }) => {
    saveOpenCartDraft();
    const key = openCartDraftKey({ tableId: table.id, channel: 'dine_in' });
    const existing = openCartDraftsRef.current.get(key);
    if (existing) {
      applyOpenCartDraft(existing);
    } else {
      setCart([]);
      setSelectedLineId(null);
      setKeypadBuffer('');
      setOrderNote('');
      setTabNumber(null);
      setActiveCourse(1);
      setOrderSent(false);
      setCoursesBulkSent(false);
      setFulfillmentWhen(null);
      setSelectedCustomer(null);
      setTableId(table.id);
      setTableLabel(table.label);
      setChannel('dine_in');
    }
    setPosTab('register');
    setPosView('register');
  };

  const startNewOrder = () => {
    const key = openCartDraftKey({ tableId, tabNumber, channel });
    openCartDraftsRef.current.delete(key);
    setDraftVersion((n) => n + 1);
    setCart([]);
    setSelectedLineId(null);
    setKeypadBuffer('');
    setOrderNote('');
    setTableId(null);
    setTableLabel(null);
    setTabNumber(null);
    setActiveCourse(1);
    setOrderSent(false);
    setCoursesBulkSent(false);
    setChannel(null);
    setFulfillmentWhen(null);
    setSelectedCustomer(null);
    setProvisionalPrinted(false);
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
      setProvisionalPrinted(true);
      toast.success(t('webPosProvisionalPrinted'));
    } catch (e: any) {
      toast.error(e.message || t('webPosPrintFailed'));
    }
  };

  const onKitchenMessage = async (message: string) => {
    try {
      const ticket = nextWebPosTicketNumber(merchant?.id);
      const msgLine = {
        name: `★ ${message}`,
        quantity: 1,
        unitPrice: 0,
        lineTotal: 0,
      };
      await printKitchenForCart(
        [
          {
            lineId: 'msg',
            productId: 'kitchen-msg',
            name: msgLine.name,
            quantity: 1,
            unitPrice: 0,
            lineTotal: 0,
            taxable: false,
            selectedExtras: [],
            comboSelections: [],
          },
        ],
        effectiveChannel,
        { orderNumber: ticket.display, when: fulfillmentWhen }
      );
      toast.success(t('webPosKitchenMessageSent'));
    } catch (e: any) {
      toast.error(e.message || t('webPosKitchenPrintFailed'));
    }
  };

  const asapFulfillment = (): FulfillmentWhen => ({
    mode: 'asap',
    scheduledFor: null,
    label: t('webPosAsap'),
  });

  const openRegisterCheckout = () => {
    if (!cart.length || busy) return;
    if (
      (channel === 'delivery' || channel === 'takeaway') &&
      !fulfillmentWhen
    ) {
      setFulfillmentWhen(asapFulfillment());
    }
    if (channel === 'delivery' && !selectedCustomer) {
      setPendingPayMethod('cash');
      setCustomerOpen(true);
      return;
    }
    setPosView('checkout');
  };

  const leaveTableForChannel = () => {
    saveOpenCartDraft();
    if (tableId) {
      openCartDraftsRef.current.delete(openCartDraftKey({ tableId, channel: 'dine_in' }));
      setTableId(null);
      setTableLabel(null);
      setDraftVersion((n) => n + 1);
    }
  };

  const selectFulfillmentChannel = (ch: 'takeaway' | 'delivery') => {
    leaveTableForChannel();
    const channelChanged = channel !== ch;
    setChannel(ch);
    // Default ASAP immediately — no modal. Keep existing when re-tapping same channel.
    if (channelChanged || !fulfillmentWhen) {
      setFulfillmentWhen(asapFulfillment());
    }
  };

  const convertChannel = () => {
    if (isRetail) {
      const opts = channelTabOptions.length
        ? channelTabOptions
        : (['takeaway'] as Array<'takeaway' | 'delivery'>);
      if (opts.length < 2) return;
      const idx = Math.max(0, opts.indexOf((channel as 'takeaway' | 'delivery') || opts[0]));
      const next = opts[(idx + 1) % opts.length];
      leaveTableForChannel();
      setChannel(next);
      setFulfillmentWhen(asapFulfillment());
      return;
    }
    const next: Channel =
      channel === 'takeaway'
        ? 'delivery'
        : channel === 'delivery'
          ? 'dine_in'
          : 'takeaway';
    if (next !== 'dine_in') leaveTableForChannel();
    setChannel(next);
    if (next === 'dine_in') {
      setFulfillmentWhen(null);
      return;
    }
    setFulfillmentWhen(asapFulfillment());
  };

  const confirmCancelCart = async (reason: string) => {
    if (!cancelModal) return;
    const scope = cancelModal.scope;
    const lineId = cancelModal.lineId;
    const linesToCancel =
      scope === 'item'
        ? cart.filter((l) => l.lineId === lineId && l.sentToKitchen)
        : cart.filter((l) => l.sentToKitchen);

    setCancelModal(null);
    setBusy(true);
    try {
      if (linesToCancel.length) {
        const ticket = nextWebPosTicketNumber(merchant?.id);
        await printKitchenForCart(linesToCancel, effectiveChannel, {
          orderNumber: ticket.display,
          when: fulfillmentWhen,
          cancelled: true,
          cancelReason: reason,
          forcePrint: true,
        });
      }
      if (scope === 'item' && lineId) {
        setCart((prev) => prev.filter((l) => l.lineId !== lineId));
        if (selectedLineId === lineId) setSelectedLineId(null);
        toast.success(t('webPosItemCancelled'));
      } else {
        startNewOrder();
        toast.success(t('webPosOrderCancelled'));
      }
    } catch (e: any) {
      toast.error(e.message || t('webPosCancelFailed'));
    } finally {
      setBusy(false);
    }
  };

  const addGiftCardLine = (meta: GiftCardCartMeta, lineName: string) => {
    const amount = roundMoney2(meta.amount);
    const line: CartLine = {
      lineId: `gc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: `__gift_card_${meta.op}__`,
      name: lineName,
      quantity: 1,
      unitPrice: amount,
      lineTotal: amount,
      taxable: false,
      selectedExtras: [],
      comboSelections: [],
      isOpenPrice: true,
      giftCard: {
        op: meta.op,
        cardNumber: meta.cardNumber,
        cardId: meta.cardId,
        mediaType: meta.mediaType,
        amount,
      },
    };
    setCart((prev) => [...prev, line]);
    setSelectedLineId(line.lineId);
    setPosTab('register');
    setPosView('register');
    toast.success(t('giftCardAddedToCart'));
  };

  const creditGiftCardLines = async (saleLines: CartLine[], orderId?: string | null) => {
    for (const line of saleLines) {
      if (!line.giftCard) continue;
      try {
        await api.post('/gift-cards/credit', {
          type: line.giftCard.op,
          cardId: line.giftCard.cardId,
          cardNumber: line.giftCard.cardNumber,
          cardMediaType: line.giftCard.mediaType,
          amount: line.giftCard.amount,
          orderId: orderId || undefined,
          createIfMissing: line.giftCard.op === 'sell',
        });
      } catch (e: any) {
        toast.error(e.response?.data?.error || t('giftCardCreditFailed'));
      }
    }
  };

  const redeemGiftCardPayments = async (
    payments: AppliedPayment[],
    orderId?: string | null
  ) => {
    for (const p of payments) {
      if (p.method !== 'gift_card' || !p.giftCardId) continue;
      try {
        await api.post('/gift-cards/redeem', {
          cardId: p.giftCardId,
          amount: p.amount,
          orderId: orderId || undefined,
          allowPartial: true,
        });
      } catch (e: any) {
        toast.error(e.response?.data?.error || t('giftCardRedeemFailed'));
        throw e;
      }
    }
  };

  const completeMultiTenderCheckout = async (
    payments: AppliedPayment[],
    changeDue: number,
    tipAmount = 0
  ) => {
    const tip = roundMoney2(Math.max(0, tipAmount));
    const part = splitQueue[splitIndex];
    const partTotal = roundMoney2((part?.amount ?? totals.total) + tip);
    const primary = payments.find((p) => p.method === 'terminal')
      || payments.find((p) => p.method === 'card')
      || payments.find((p) => p.method === 'gift_card')
      || payments[0];
    if (!primary) return;
    const amountTendered = roundMoney2(payments.reduce((s, p) => s + p.amount, 0));
    const extras: CheckoutResult = {
      method: (primary.method === 'gift_card' ? 'card' : primary.method) as CheckoutResult['method'],
      discountPercent: 0,
      tipAmount: tip,
      roundingAmount: totals.rounding,
      total: partTotal,
      amountTendered,
      changeDue: changeDue > 0 ? changeDue : null,
    };
    if (primary.method === 'terminal' && payments.length === 1) {
      setCheckoutExtras(extras);
      await runTerminalPayment(undefined, extras);
      return;
    }
    setBusy(true);
    try {
      // Deduct gift balance before persisting sale (fail closed on empty/suspended cards)
      await redeemGiftCardPayments(payments);
      const remainingSplits = splitQueue.length > 0 && splitIndex + 1 < splitQueue.length;
      const saleMethod: PosPaymentMethod =
        primary.method === 'pay_later'
          ? 'pay_later'
          : primary.method === 'gift_card'
            ? 'gift_card'
            : primary.method;
      await finalizeSale(saleMethod, undefined, undefined, extras, true);
      if (remainingSplits) {
        setSplitIndex((i) => i + 1);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || t('webPosSaleFailed'));
    } finally {
      setBusy(false);
    }
  };

  const runExpressPay = async (method: PosPaymentMethod) => {
    if (!cart.length || busy) return;
    let whenForPay: FulfillmentWhen | undefined;
    if (
      (channel === 'delivery' || channel === 'takeaway') &&
      !fulfillmentWhen
    ) {
      whenForPay = asapFulfillment();
      setFulfillmentWhen(whenForPay);
    }
    if (channel === 'delivery' && !selectedCustomer) {
      setPendingPayMethod(method);
      setCustomerOpen(true);
      return;
    }
    const extras: CheckoutResult = {
      method,
      discountPercent: 0,
      tipAmount: 0,
      roundingAmount: totals.rounding,
      total: totals.total,
      amountTendered: totals.total,
      changeDue: 0,
    };
    if (method === 'terminal') {
      setCheckoutExtras(extras);
      await runTerminalPayment(undefined, extras);
      return;
    }
    const paidAmount = totals.total;
    setBusy(true);
    try {
      // Express: popup only - never auto-print receipt
      await finalizeSale(method, undefined, whenForPay, extras, false, {
        skipReceiptPrint: true,
      });
      setSuccessInfo({ amount: paidAmount, changeDue: 0 });
      setExpressSuccessOpen(true);
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
      courseOnly?: number;
      cancelled?: boolean;
      cancelReason?: string | null;
      /** Cancel tickets always print even if auto-print kitchen is off */
      forcePrint?: boolean;
    }
  ) => {
    if (printSettings?.autoPrintKitchen === false && !opts?.forcePrint && !opts?.cancelled) return;
    const lang = resolveReceiptLanguage(printSettings, printSettings?.receiptLanguage === 'panel' ? locale : printSettings?.receiptLanguage || locale);
    const kitchenPrinters = (printSettings?.printers || []).filter(
      (p) => p.enabled !== false && p.printKitchenTickets && p.name
    );
    const filteredLines = (
      opts?.courseOnly != null
        ? lines.filter((l) => (l.courseNumber || 1) === opts.courseOnly)
        : lines
    ).filter((l) => !l.giftCard && !String(l.productId || '').startsWith('__gift_card_'));
    if (!filteredLines.length) return;
    const receiptItems = filteredLines.map((l) => {
      const detail = lineExtrasLabel(l);
      return {
        name: detail ? `${l.name} (${detail})` : l.name,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
        productId: l.productId,
        categoryId: l.categoryId,
        courseNumber: l.courseNumber,
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
      groupByCourse: coursesEnabled && !opts?.cancelled,
      tableLabel: tableLabel || null,
      cancelled: !!opts?.cancelled,
      cancelReason: opts?.cancelReason || null,
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
    showSuccessScreen = false,
    opts?: { skipReceiptPrint?: boolean }
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

    // Credit gift-card sell/reload lines after successful payment persistence
    await creditGiftCardLines(saleLines, backendOrderId);

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
    if (shiftsEnabled) void refreshCurrentShift(true);
    const moreSplits = splitQueue.length > 0 && splitIndex + 1 < splitQueue.length;
    if (!moreSplits) {
      const paidKey = openCartDraftKey({ tableId, tabNumber, channel });
      openCartDraftsRef.current.delete(paidKey);
      setDraftVersion((n) => n + 1);
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
      setOrderSent(false);
      setCoursesBulkSent(false);
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
      setExpressSuccessOpen(false);
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
      !opts?.skipReceiptPrint &&
      !payLater &&
      autoPrint &&
      printSettings?.autoPrintReceipt !== false;
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
    if (method === 'pay_later' && (channel === 'dine_in' || !channel)) {
      setChannel('takeaway');
    }
    const scheduleChannel =
      method === 'pay_later' && (channel === 'dine_in' || !channel)
        ? 'takeaway'
        : channel;
    let whenForCheckout: FulfillmentWhen | undefined;
    if (
      (scheduleChannel === 'takeaway' || scheduleChannel === 'delivery') &&
      !fulfillmentWhen
    ) {
      whenForCheckout = asapFulfillment();
      setFulfillmentWhen(whenForCheckout);
    }
    if (scheduleChannel === 'delivery' && !selectedCustomer) {
      setPendingPayMethod(method);
      setCustomerOpen(true);
      return;
    }
    void runCheckout(method, whenForCheckout);
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
  const canViewReports =
    !staffConfigured ||
    (!!webposStaff &&
      (hasPermission(staffPerms, 'VIEW_REPORTS') || hasPermission(staffPerms, 'END_OF_DAY')));
  const showEodButton = !shiftsEnabled && canViewReports;

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
    setPinModalOpen(false);
    toast.success(t('webPosSignedInAs').replace('{name}', staff.name));
    void refreshCurrentShift();
  };

  const openSwitchUserPin = () => {
    setPinModalMode('switch');
    setPinModalOpen(true);
  };

  const findProductByScanCode = useCallback(
    (code: string): Product | null => {
      const q = code.trim();
      if (!q) return null;
      const lower = q.toLowerCase();
      return (
        products.find(
          (p) =>
            (p.barcode && String(p.barcode).trim() === q) ||
            (p.sku && String(p.sku).trim().toLowerCase() === lower)
        ) || null
      );
    },
    [products]
  );

  const handleBarcodeScan = useCallback(
    (code: string) => {
      if (pinGateRequired || pinModalOpen) return;
      if (posView !== 'register') return;
      if (
        pendingProduct ||
        pendingCombo ||
        pendingOpenPrice ||
        checkoutOpen ||
        paymentModalOpen ||
        giftCardOpsOpen ||
        giftCardPayOpen ||
        splitOpen ||
        scheduleOpen ||
        customerOpen ||
        kitchenMsgOpen ||
        noteOpen ||
        setTableOpen ||
        setTabOpen ||
        cancelModal ||
        expressSuccessOpen
      ) {
        return;
      }
      const product = findProductByScanCode(code);
      if (!product) {
        toast.error(t('webPosBarcodeNotFound').replace('{code}', code));
        return;
      }
      onProductClick(product);
    },
    // onProductClick is stable enough for scan; listed intentionally
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      pinGateRequired,
      pinModalOpen,
      posView,
      pendingProduct,
      pendingCombo,
      pendingOpenPrice,
      checkoutOpen,
      paymentModalOpen,
      giftCardOpsOpen,
      giftCardPayOpen,
      splitOpen,
      scheduleOpen,
      customerOpen,
      kitchenMsgOpen,
      noteOpen,
      setTableOpen,
      setTabOpen,
      cancelModal,
      expressSuccessOpen,
      findProductByScanCode,
      t,
    ]
  );

  // Keyboard-wedge barcode scanner: buffer printable keys, Enter submits.
  useEffect(() => {
    const clearScanTimer = () => {
      if (scanTimerRef.current != null) {
        window.clearTimeout(scanTimerRef.current);
        scanTimerRef.current = null;
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (pinGateRequired || pinModalOpen || posView !== 'register') return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target?.isContentEditable
      ) {
        return;
      }
      if (e.key === 'Enter') {
        const code = scanBufferRef.current.trim();
        scanBufferRef.current = '';
        clearScanTimer();
        if (code.length >= 3) {
          e.preventDefault();
          handleBarcodeScan(code);
        }
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        scanBufferRef.current += e.key;
        clearScanTimer();
        scanTimerRef.current = window.setTimeout(() => {
          scanBufferRef.current = '';
          scanTimerRef.current = null;
        }, 120);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearScanTimer();
    };
  }, [handleBarcodeScan, pinGateRequired, pinModalOpen, posView]);

  const enabledMethods = {
    express: (paymentConfig?.methods.express ?? true) && canPay,
    cash: (paymentConfig?.methods.cash ?? true) && canPay,
    card: (paymentConfig?.methods.card ?? true) && canPay,
    terminal: (paymentConfig?.methods.terminal ?? false) && canPay,
    giftCard: (paymentConfig?.methods.giftCard === true) && canPay,
  };
  const giftCardsFeatureOn =
    paymentConfig?.giftCardSettings?.enabled === true || enabledMethods.giftCard;

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

  if (pinGateRequired) {
    return (
      <div
        className={`webpos-shell ${
          appMode ? 'h-dvh' : '-m-3 sm:-m-4 h-[calc(100dvh-4rem)]'
        } flex flex-col bg-stone-950`}
        data-theme={posColorTheme || 'teal'}
      >
        <WebPosPinModal
          open
          mode="gate"
          onClose={() => {
            /* gate cannot be dismissed without PIN */
          }}
          onSuccess={onStaffPinSuccess}
        />
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
    if (tab === 'tables' || tab === 'orders' || tab === 'bookings') {
      saveOpenCartDraft();
    }
    setPosTab(tab);
    setPosView(tab);
  };

  return (
    <div
      className={`webpos-shell ${
        appMode ? 'h-dvh' : '-m-3 sm:-m-4 h-[calc(100dvh-4rem)]'
      } flex flex-col bg-stone-100`}
      data-theme={posColorTheme || 'teal'}
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
        onSwitchUser={openSwitchUserPin}
        onOpenDrawer={() => void openCashDrawer()}
        onShowPanel={showPanelMenus}
        tableBadge={tableBadge}
        shiftsEnabled={shiftsEnabled}
        shiftOpen={!!openShift}
        onCloseShift={() => void openCloseShiftModal()}
        onStartShift={() => {
          setSettingsOpen(false);
          setStartShiftOpen(true);
        }}
        showEodButton={showEodButton}
        onEodReport={() => {
          setSettingsOpen(false);
          void printTodayEod();
        }}
        hideTablesTab={isRetail}
        hideBookingsTab={isRetail}
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
            shiftsEnabled={shiftsEnabled}
            shiftOpen={!!openShift}
            onCloseShift={() => void openCloseShiftModal()}
            onStartShift={() => {
              setSettingsOpen(false);
              setStartShiftOpen(true);
            }}
            showEodButton={showEodButton}
            onEodReport={() => {
              setSettingsOpen(false);
              void printTodayEod();
            }}
          />
        }
      />

      {shiftsEnabled && !openShift && !startShiftOpen ? (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-3 py-2 sm:px-4">
          <p className="min-w-0 text-xs font-medium text-amber-950 sm:text-sm">
            {t('webPosShiftClosedHint')}
          </p>
          <button
            type="button"
            className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
            onClick={() => setStartShiftOpen(true)}
          >
            {t('webPosShiftStart')}
          </button>
        </div>
      ) : null}

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
              giftCard: enabledMethods.giftCard,
              payLater: (channel === 'takeaway' || channel === 'delivery') && canPay,
            }}
            busy={busy || paymentModalOpen}
            customerLabel={customerLabel}
            onSplit={
              checkoutSettings.splitBillsEnabled && !splitQueue.length
                ? () => {
                    setSplitOpen(true);
                  }
                : undefined
            }
            onGiftCardRequest={(due) => {
              setGiftCardPayDue(due);
              setGiftCardPayOpen(true);
            }}
            injectPayment={giftPayInject}
            onInjectPaymentConsumed={() => setGiftPayInject(null)}
            onComplete={(payments, changeDue, tipAmount) =>
              void completeMultiTenderCheckout(payments, changeDue, tipAmount)
            }
          />
        ) : posView === 'success' && successInfo ? (
          <WebPosSuccessView
            amount={successInfo.amount}
            changeDue={successInfo.changeDue}
            onBack={() => {
              setSuccessInfo(null);
              setPosView('register');
              setPosTab('register');
            }}
            onPrint={() => {
              if (lastReceipt) void printReceipt(lastReceipt, lastReceiptUrl || undefined);
              else toast.error(t('webPosPrintFailed'));
            }}
            onOpenDrawer={canDrawer ? () => void openCashDrawer() : undefined}
            onSendReceipt={() => {
              if (lastReceiptUrl && navigator.clipboard?.writeText) {
                void navigator.clipboard.writeText(lastReceiptUrl);
                toast.success(t('webPosReceiptLinkCopied'));
              } else {
                toast.success(t('webPosSendReceiptHint'));
              }
            }}
            onContinue={() => {
              setSuccessInfo(null);
              const next = isRetail ? 'register' : postSuccessTarget;
              setPosTab(next);
              setPosView(next);
            }}
          />
        ) : posView === 'tables' ? (
          <WebPosTablesView
            selectedTableId={tableId}
            draftTableIds={draftTableIds}
            onSelectTable={(table) => switchToTableOrder(table)}
          />
        ) : posView === 'bookings' ? (
          <WebPosBookingsView />
        ) : posView === 'orders' ? (
          <WebPosOrdersPanel
            embedded
            open
            onClose={() => {
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
              const sent = held.status === 'sent_to_kitchen';
              setOrderSent(sent);
              setCoursesBulkSent(sent);
              setPosTab('register');
              setPosView('register');
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
        ) : (
          <div
            className={`flex min-h-0 flex-1 flex-col lg:flex-row ${
              cartSide === 'right' ? 'lg:flex-row-reverse' : ''
            }`}
          >
            <WebPosCartPanel
              cart={cart}
              totals={totals}
              taxRate={taxRate}
              money={money}
              selectedLineId={selectedLineId}
              onSelectLine={handleSelectLine}
              keypadMode={keypadMode}
              onKeypadModeChange={handleKeypadModeChange}
              keypadBuffer={keypadBuffer}
              onKeypadBufferChange={handleKeypadBufferChange}
              onKeypadApply={applyKeypadToLine}
              onKeypadAdjust={handleKeypadAdjust}
              onKeypadBackspace={handleKeypadBackspace}
              channel={channel}
              onChannelChange={selectFulfillmentChannel}
              activeCourse={activeCourse}
              coursesEnabled={coursesEnabled}
              courseNumbers={courseNumbers}
              onSelectCourse={setActiveCourse}
              orderNote={orderNote}
              tableLabel={tableLabel}
              tabNumber={tabNumber}
              customerLabel={customerLabel}
              fulfillmentLabel={fulfillmentWhen?.label || null}
              fulfillmentIsLater={fulfillmentWhen?.mode === 'later'}
              busy={busy || paymentModalOpen}
              orderSent={orderSent}
              showNewOrder={showNewOrderButton}
              sendLabel={sendLabel}
              onCustomer={() => setCustomerOpen(true)}
              onProvisionalReceipt={() => void printProvisionalReceipt()}
              onToggleChannel={convertChannel}
              onCourse={advanceCourse}
              onKitchenMessage={() => setKitchenMsgOpen(true)}
              onSetTable={() => setSetTableOpen(true)}
              onSetTab={() => setSetTabOpen(true)}
              onSend={() => void sendCoursesToKitchen()}
              onNewOrder={startNewOrder}
              onPayment={openRegisterCheckout}
              onCancelOrder={() => {
                const can =
                  cart.length > 0 &&
                  (provisionalPrinted || orderSent || cart.some((l) => l.sentToKitchen));
                if (!can) {
                  toast.error(t('webPosCancelNeedSend'));
                  return;
                }
                setCancelModal({ scope: 'order' });
              }}
              onCancelItem={() => {
                const line = cart.find((l) => l.lineId === selectedLineId);
                if (!line?.sentToKitchen) {
                  toast.error(t('webPosCancelItemNeedSent'));
                  return;
                }
                setCancelModal({ scope: 'item', lineId: line.lineId });
              }}
              onPayLater={() => beginCheckout('pay_later')}
              onEditFulfillment={() => {
                if (channel === 'takeaway' || channel === 'delivery') {
                  setScheduleOpen(true);
                }
              }}
              showSend={showSend}
              hideTab={hideTab}
              canCancelOrder={
                cart.length > 0 &&
                (provisionalPrinted || orderSent || cart.some((l) => l.sentToKitchen))
              }
              canCancelItem={!!cart.find((l) => l.lineId === selectedLineId)?.sentToKitchen}
              dockSide={cartSide}
              showChannelTabs={showChannelTabs}
              channelTabOptions={channelTabOptions}
              kitchenEnabled={kitchenEnabled}
              onHoldOrder={() => void holdCurrentOrder(false)}
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
              expressCheckout={enabledMethods.express}
              expressMethods={{
                cash: enabledMethods.cash,
                card: enabledMethods.card,
                terminal: enabledMethods.terminal,
              }}
              onExpressPay={(m) => void runExpressPay(m)}
              expressDisabled={!cart.length || busy || paymentModalOpen}
              giftCardsEnabled={giftCardsFeatureOn}
              onGiftCards={() => setGiftCardOpsOpen(true)}
            />
          </div>
        )}

        {expressSuccessOpen && successInfo ? (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
            <div className="w-full max-w-md">
              <WebPosSuccessView
                compact
                amount={successInfo.amount}
                changeDue={successInfo.changeDue}
                onPrint={() => {
                  if (lastReceipt) void printReceipt(lastReceipt, lastReceiptUrl || undefined);
                  else toast.error(t('webPosPrintFailed'));
                }}
                onOpenDrawer={canDrawer ? () => void openCashDrawer() : undefined}
                onContinue={() => {
                  setExpressSuccessOpen(false);
                  setSuccessInfo(null);
                }}
              />
            </div>
          </div>
        ) : null}
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
          setSetTableOpen(false);
          assignCartToTable(table);
        }}
      />
      <WebPosSetTabModal
        open={setTabOpen}
        onClose={() => setSetTabOpen(false)}
        current={tabNumber}
        onConfirm={(tab) => {
          saveOpenCartDraft();
          const key = openCartDraftKey({ tabNumber: tab, channel: channel || 'takeaway' });
          const existing = openCartDraftsRef.current.get(key);
          if (existing) {
            applyOpenCartDraft(existing);
          } else {
            setTabNumber(tab);
            setTableId(null);
            setTableLabel(null);
          }
        }}
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
            ? `${t('webPosEnterPrice')} - ${pendingOpenPrice.name}`
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
        open={pinModalOpen && !pinGateRequired}
        mode={pinModalMode}
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
              // Pass `when` directly - setState is async and would otherwise print ASAP
              void runCheckout(m, when);
            }
          }}
        />
      )}

      <WebPosCancelModal
        open={!!cancelModal}
        scope={cancelModal?.scope || 'order'}
        itemLabel={
          cancelModal?.scope === 'item'
            ? (() => {
                const line = cart.find((l) => l.lineId === cancelModal.lineId);
                return line ? `${line.quantity}x ${line.name}` : null;
              })()
            : null
        }
        onClose={() => setCancelModal(null)}
        onConfirm={(reason) => void confirmCancelCart(reason)}
      />

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
            // Default ASAP when takeaway/delivery has no time yet.
            const when =
              !fulfillmentWhen &&
              (channel === 'delivery' || channel === 'takeaway')
                ? asapFulfillment()
                : undefined;
            if (when) setFulfillmentWhen(when);
            void runCheckout(m, when);
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

      <WebPosGiftCardModal
        open={giftCardOpsOpen}
        mode="ops"
        settings={paymentConfig?.giftCardSettings || null}
        onClose={() => setGiftCardOpsOpen(false)}
        onAddToCart={addGiftCardLine}
        onAttachCustomer={(c) => {
          setSelectedCustomer({
            id: c.id,
            firstName: c.firstName || '',
            lastName: c.lastName || '',
            email: c.email || null,
            phone: c.phone || null,
          } as WebPosCustomer);
        }}
      />
      <WebPosGiftCardModal
        open={giftCardPayOpen}
        mode="pay"
        settings={paymentConfig?.giftCardSettings || null}
        amountDue={giftCardPayDue}
        onClose={() => setGiftCardPayOpen(false)}
        onAddToCart={() => undefined}
        onPayConfirm={(result: GiftCardPayResult) => {
          setGiftPayInject({
            id: `gc-pay-${Date.now()}`,
            method: 'gift_card',
            amount: result.amount,
            giftCardId: result.cardId,
            giftCardNumber: result.cardNumber,
          });
        }}
        onAttachCustomer={(c) => {
          setSelectedCustomer({
            id: c.id,
            firstName: c.firstName || '',
            lastName: c.lastName || '',
            email: c.email || null,
            phone: c.phone || null,
          } as WebPosCustomer);
        }}
      />

      <WebPosStartShiftModal
        open={startShiftOpen}
        busy={shiftBusy}
        onCancel={() => {
          setStartShiftOpen(false);
          pendingAfterShift.current = null;
        }}
        onConfirm={(cash) => void handleStartShift(cash)}
      />
      <WebPosCloseShiftModal
        open={closeShiftOpen}
        busy={shiftBusy}
        openingCash={openShift?.openingCash ?? 0}
        live={shiftLive}
        onCancel={() => setCloseShiftOpen(false)}
        onConfirm={(cash) => void handleCloseShift(cash)}
      />
      <WebPosShiftClosedModal
        open={shiftClosedOpen}
        balanced={shiftBalanced}
        onPrintEod={() => void printShiftEod()}
        onRestart={handleRestartShift}
        onStay={() => setShiftClosedOpen(false)}
      />
    </div>
  );
}
