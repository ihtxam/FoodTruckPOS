import {
  Bell,
  Menu,
  MoreHorizontal,
  PanelLeft,
  RefreshCw,
  Search,
  UserCircle2,
  Vault,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { webPosVersionLabel } from '@/lib/app-version';
import type { PosTab, PosView } from './types';

type Props = {
  activeTab: PosTab;
  posView: PosView;
  onTabChange: (tab: PosTab) => void;
  merchantName?: string;
  agentOk: boolean;
  search: string;
  onSearchChange: (q: string) => void;
  showSearch: boolean;
  onlinePendingCount: number;
  staffName?: string | null;
  canDrawer: boolean;
  appMode: boolean;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  settingsPanel: React.ReactNode;
  settingsRef: React.RefObject<HTMLDivElement | null>;
  onOnlineOrders: () => void;
  onSwitchUser: () => void;
  onOpenDrawer: () => void;
  onShowPanel: () => void;
  tableBadge?: string | null;
  shiftsEnabled?: boolean;
  shiftOpen?: boolean;
  onCloseShift?: () => void;
  onStartShift?: () => void;
};

export default function WebPosTopBar({
  activeTab,
  posView,
  onTabChange,
  merchantName,
  agentOk,
  search,
  onSearchChange,
  showSearch,
  onlinePendingCount,
  staffName,
  canDrawer,
  appMode,
  settingsOpen,
  onToggleSettings,
  settingsPanel,
  settingsRef,
  onOnlineOrders,
  onSwitchUser,
  onOpenDrawer,
  onShowPanel,
  tableBadge,
  shiftsEnabled,
  shiftOpen,
  onCloseShift,
  onStartShift,
}: Props) {
  const { t } = useI18n();
  const inCheckout = posView === 'checkout' || posView === 'success';

  const tabs: Array<{ id: PosTab; label: string }> = [
    { id: 'tables', label: t('webPosTabTables') },
    { id: 'register', label: t('webPosTabRegister') },
    { id: 'orders', label: t('webPosTabOrders') },
    { id: 'bookings', label: t('webPosTabBookings') },
  ];

  return (
    <header className="relative z-20 shrink-0 border-b border-stone-200 bg-white">
      <div className="flex items-center gap-2 px-3 py-2 sm:px-4">
        <nav className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const active = !inCheckout && activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                disabled={inCheckout}
                className={`shrink-0 px-3 pb-2 pt-1 text-sm font-semibold transition ${
                  active
                    ? 'border-b-2 border-[var(--webpos-accent)] text-[var(--webpos-accent-text)]'
                    : 'border-b-2 border-transparent text-stone-500 hover:text-stone-800 disabled:opacity-50'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
          {!inCheckout && activeTab === 'register' ? (
            <span className="webpos-accent-chip mb-1 ml-1 shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide">
              {t('webPosDirectSale')}
            </span>
          ) : null}
          {tableBadge ? (
            <span className="mb-1 ml-1 shrink-0 rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800 ring-1 ring-sky-200">
              {tableBadge}
            </span>
          ) : null}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          {showSearch ? (
            <label className="relative hidden sm:block">
              <Search
                size={15}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400"
              />
              <input
                className="h-9 w-44 rounded-lg border border-stone-200 bg-stone-50 pl-8 pr-2 text-sm lg:w-52"
                placeholder={t('webPosSearchProducts')}
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                autoComplete="off"
              />
            </label>
          ) : null}

          {shiftsEnabled ? (
            <button
              type="button"
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold ${
                shiftOpen
                  ? 'bg-[var(--webpos-accent)] text-white hover:opacity-90'
                  : 'border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
              }`}
              onClick={() => (shiftOpen ? onCloseShift?.() : onStartShift?.())}
              title={shiftOpen ? t('webPosShiftClose') : t('webPosShiftStart')}
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  shiftOpen ? 'bg-white' : 'bg-amber-500'
                }`}
              />
              <span className="hidden sm:inline">
                {shiftOpen ? t('webPosShiftClose') : t('webPosShiftStart')}
              </span>
              <span className="sm:hidden">{shiftOpen ? t('webPosShiftOpenBadge') : t('webPosShiftMenu')}</span>
            </button>
          ) : null}

          <button
            type="button"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 hover:bg-stone-50"
            onClick={onOnlineOrders}
            title={t('webPosOnlineOrders')}
          >
            <Bell size={17} />
            {onlinePendingCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {onlinePendingCount}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            className="hidden h-9 max-w-[7rem] items-center gap-1 truncate rounded-lg border border-stone-200 px-2 text-xs font-medium sm:inline-flex"
            onClick={onSwitchUser}
            title={staffName || t('webPosSwitchUser')}
          >
            <UserCircle2 size={16} className="shrink-0" />
            <span className="truncate">{staffName || t('webPosSwitchUser')}</span>
          </button>

          {canDrawer ? (
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 hover:bg-stone-50"
              onClick={onOpenDrawer}
              title={t('webPosOpenDrawer')}
            >
              <Vault size={17} />
            </button>
          ) : null}

          <div className="relative" ref={settingsRef}>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 hover:bg-stone-50"
              aria-expanded={settingsOpen}
              onClick={onToggleSettings}
            >
              <Menu size={17} />
            </button>
            {settingsOpen ? settingsPanel : null}
          </div>

          {appMode ? (
            <button
              type="button"
              className="hidden h-9 items-center gap-1 rounded-lg border border-stone-200 px-2 text-xs font-medium hover:bg-stone-50 lg:inline-flex"
              onClick={onShowPanel}
            >
              <PanelLeft size={15} />
              {t('webPosMenus')}
            </button>
          ) : null}
        </div>
      </div>
      {merchantName ? (
        <p className="hidden px-4 pb-1 text-[10px] text-stone-400 sm:block">
          {merchantName}
          {!agentOk ? ` · ${t('webPosStartPrintAgent')}` : ''}
          {shiftsEnabled && shiftOpen ? ` · ${t('webPosShiftOpenBadge')}` : ''}
        </p>
      ) : null}
    </header>
  );
}

export function WebPosSettingsDropdown({
  printerName,
  printers,
  agentOk,
  autoPrint,
  postSuccessTarget,
  onPrinterChange,
  onAutoPrintChange,
  onPostSuccessChange,
  onRefreshPrinters,
  onReloadCatalog,
  shiftsEnabled,
  shiftOpen,
  onCloseShift,
  onStartShift,
}: {
  printerName: string;
  printers: Array<{ name: string; isDefault?: boolean }>;
  agentOk: boolean;
  autoPrint: boolean;
  postSuccessTarget: 'register' | 'tables';
  onPrinterChange: (name: string) => void;
  onAutoPrintChange: (v: boolean) => void;
  onPostSuccessChange: (v: 'register' | 'tables') => void;
  onRefreshPrinters: () => void;
  onReloadCatalog: () => void;
  shiftsEnabled?: boolean;
  shiftOpen?: boolean;
  onCloseShift?: () => void;
  onStartShift?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-[min(20rem,calc(100vw-1.5rem))] space-y-3 rounded-xl border border-stone-200 bg-white p-3 shadow-xl">
      {shiftsEnabled ? (
        <div className="space-y-2 border-b border-stone-100 pb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            {t('webPosShiftMenu')}
          </p>
          {shiftOpen ? (
            <button
              type="button"
              className="flex w-full items-center justify-center rounded-xl bg-[var(--webpos-accent)] py-2.5 text-sm font-bold text-white hover:opacity-90"
              onClick={onCloseShift}
            >
              {t('webPosShiftClose')}
            </button>
          ) : (
            <button
              type="button"
              className="flex w-full items-center justify-center rounded-xl bg-[var(--webpos-accent)] py-2.5 text-sm font-bold text-white hover:opacity-90"
              onClick={onStartShift}
            >
              {t('webPosShiftStart')}
            </button>
          )}
          <p className="text-[11px] text-stone-500">
            {shiftOpen ? t('webPosShiftOpenHint') : t('webPosShiftClosedHint')}
          </p>
        </div>
      ) : null}
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
        <MoreHorizontal size={14} />
        {t('webPosPrinting')}
      </div>
      <label className="block space-y-1 text-sm">
        <span className="text-xs text-stone-500">{t('webPosPrinter')}</span>
        <select
          className="input w-full text-sm"
          value={printerName}
          onChange={(e) => onPrinterChange(e.target.value)}
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
          onChange={(e) => onAutoPrintChange(e.target.checked)}
        />
        {t('webPosAutoPrint')}
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-xs text-stone-500">{t('webPosPostSuccessNav')}</span>
        <select
          className="input w-full text-sm"
          value={postSuccessTarget}
          onChange={(e) => onPostSuccessChange(e.target.value as 'register' | 'tables')}
        >
          <option value="register">{t('webPosTabRegister')}</option>
          <option value="tables">{t('webPosTabTables')}</option>
        </select>
      </label>
      <div className="grid grid-cols-1 gap-1.5">
        <button type="button" className="btn-secondary justify-start text-sm" onClick={onRefreshPrinters}>
          <RefreshCw size={14} />
          {t('webPosRefreshPrinters')}
        </button>
        <button type="button" className="btn-secondary justify-start text-sm" onClick={onReloadCatalog}>
          <RefreshCw size={14} />
          {t('webPosReloadCatalog')}
        </button>
      </div>
      <p className="text-[11px] leading-snug text-stone-500">
        {agentOk ? t('webPosAgentOnline') : t('webPosAgentOffline')}
      </p>
      <p className="border-t border-stone-100 pt-2 text-center text-[11px] text-stone-400">
        {webPosVersionLabel}
      </p>
    </div>
  );
}
