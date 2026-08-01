# -*- coding: utf-8 -*-
from pathlib import Path

p = Path("dashboard/src/pages/merchant/WebPos.tsx")
text = p.read_text(encoding="utf-8")

old_channels = (
    "const CHANNELS: { id: Channel; label: string }[] = [\n"
    "  { id: 'takeaway', label: 'Take away' },\n"
    "  { id: 'dine_in', label: 'Dine in' },\n"
    "  { id: 'delivery', label: 'Delivery' },\n"
    "];\n\n"
)
if old_channels not in text:
    raise SystemExit("CHANNELS block not found")
text = text.replace(old_channels, "", 1)

needle = "  const { t } = useI18n();\n"
insert = (
    "  const { t } = useI18n();\n"
    "  const channels = useMemo(\n"
    "    () => [\n"
    "      { id: 'takeaway' as Channel, label: t('takeaway') },\n"
    "      { id: 'dine_in' as Channel, label: t('dineIn') },\n"
    "      { id: 'delivery' as Channel, label: t('delivery') },\n"
    "    ],\n"
    "    [t]\n"
    "  );\n"
)
if needle not in text:
    raise SystemExit("useI18n not found")
text = text.replace(needle, insert, 1)

# Use unicode escapes for ellipsis U+2026
ell = "\u2026"

pairs = [
    (f"Loading WebPOS{ell}", "{t('webPosLoading')}"),
    ("Current order", "{t('webPosCurrentOrder')}"),
    (
        "{cartCount === 0 ? 'No items yet' : `${cartCount} item${cartCount === 1 ? '' : 's'}`}",
        "{cartCount === 0\n"
        "                ? t('webPosNoItems')\n"
        "                : (cartCount === 1 ? t('webPosItemCount') : t('webPosItemCountPlural')).replace('{n}', String(cartCount))}",
    ),
    ('aria-label="Close cart"', "aria-label={t('webPosCloseCart')}"),
    ("{CHANNELS.map", "{channels.map"),
    ("Tap products to add them", "{t('webPosTapProducts')}"),
    ('aria-label="Remove item"', "aria-label={t('webPosRemoveItem')}"),
    ("<span>Subtotal</span>", "<span>{t('webPosSubtotal')}</span>"),
    ("Tax ({taxRate}%)", "{t('webPosTax').replace('{rate}', String(taxRate))}"),
    ("<span>Rounding</span>", "<span>{t('webPosRounding')}</span>"),
    (
        '<span className="text-base font-semibold">Total</span>',
        "<span className=\"text-base font-semibold\">{t('webPosTotal')}</span>",
    ),
    ("Express \u00b7 {money(totals.total)}", "{t('webPosExpress')} \u00b7 {money(totals.total)}"),
    (
        "                <Banknote size={16} />\n                Cash\n",
        "                <Banknote size={16} />\n                {t('webPosCash')}\n",
    ),
    (
        "                <CreditCard size={16} />\n                Card\n",
        "                <CreditCard size={16} />\n                {t('webPosCard')}\n",
    ),
    (
        "                <MonitorSmartphone size={16} />\n                Terminal\n",
        "                <MonitorSmartphone size={16} />\n                {t('webPosTerminal')}\n",
    ),
    (
        '<span className="mb-1 block font-medium text-[var(--text-muted)]">Terminal</span>',
        "<span className=\"mb-1 block font-medium text-[var(--text-muted)]\">{t('webPosTerminal')}</span>",
    ),
    (
        "          {busy && !paymentModalOpen\n"
        f"            ? 'Processing{ell}'\n"
        "            : paymentMethod === 'terminal' && cart.length\n"
        "              ? `Pay ${money(totals.total)} on terminal`\n"
        "              : cart.length\n"
        "                ? `Charge ${money(totals.total)}`\n"
        "                : 'Add items to charge'}",
        "          {busy && !paymentModalOpen\n"
        "            ? t('webPosProcessing')\n"
        "            : paymentMethod === 'terminal' && cart.length\n"
        "              ? t('webPosPayOnTerminal').replace('{amount}', money(totals.total))\n"
        "              : cart.length\n"
        "                ? t('webPosCharge').replace('{amount}', money(totals.total))\n"
        "                : t('webPosAddItemsToCharge')}",
    ),
    ("Re-print last receipt", "{t('webPosReprint')}"),
    ("Recent sales", "{t('webPosRecentSales')}"),
    (
        "{agentOk ? 'Printer ready' : 'Start print agent'}",
        "{agentOk ? t('webPosPrinterReady') : t('webPosStartPrintAgent')}",
    ),
    ("{merchant?.name || 'Store'}", "{merchant?.name || t('webPosStore')}"),
    ('title="Switch user"', "title={t('webPosSwitchUser')}"),
    ('aria-label="Switch user"', "aria-label={t('webPosSwitchUser')}"),
    ('aria-label="Open cash drawer"', "aria-label={t('webPosOpenDrawer')}"),
    ('title="Open cash drawer"', "title={t('webPosOpenDrawer')}"),
    ('aria-label="Printer & tools"', "aria-label={t('webPosPrinterTools')}"),
    ("                  Printing\n", "                  {t('webPosPrinting')}\n"),
    (
        '<span className="text-xs text-[var(--text-muted)]">Printer</span>',
        "<span className=\"text-xs text-[var(--text-muted)]\">{t('webPosPrinter')}</span>",
    ),
    ('<option value="">Default printer</option>', "<option value=\"\">{t('webPosDefaultPrinter')}</option>"),
    ("{p.isDefault ? ' (default)' : ''}", "{p.isDefault ? t('webPosDefaultSuffix') : ''}"),
    ("Auto-print after sale", "{t('webPosAutoPrint')}"),
    ("toast.success('Printers refreshed');", "toast.success(t('webPosPrintersRefreshed'));"),
    ("Refresh printers", "{t('webPosRefreshPrinters')}"),
    ("Reload catalog", "{t('webPosReloadCatalog')}"),
    (
        "                  {agentOk\n"
        "                    ? 'Print agent online \u2014 receipts print silently to your Windows printer (no popup).'\n"
        "                    : 'Start ChaslayReborn Print Agent on this PC: FoodTruckPOS\\\\print-agent\\\\start.bat \u2014 then Refresh printers. Set your thermal printer as Windows default, or pick it in the list above.'}",
        "                  {agentOk ? t('webPosAgentOnline') : t('webPosAgentOffline')}",
    ),
    ("              <span className=\"hidden sm:inline\">Menus</span>", "              <span className=\"hidden sm:inline\">{t('webPosMenus')}</span>"),
    (f'placeholder="Search products{ell}"', "placeholder={t('webPosSearchProducts')}"),
    ("\n                All\n", "\n                {t('webPosAllCategories')}\n"),
    ("No products match", "{t('webPosNoProductsMatch')}"),
    ("{isCombo ? 'Combo' : 'Opts'}", "{isCombo ? t('webPosCombo') : t('webPosOpts')}"),
    (
        '<span className="block text-xs text-[var(--text-muted)]">Order total</span>',
        "<span className=\"block text-xs text-[var(--text-muted)]\">{t('webPosOrderTotal')}</span>",
    ),
    (
        "{busy && !paymentModalOpen ? '\u2026' : 'Charge'}",
        "{busy && !paymentModalOpen ? '\u2026' : t('webPosChargeShort')}",
    ),
    ('aria-label="Dismiss cart"', "aria-label={t('webPosDismissCart')}"),
    (
        "toast.error(e.response?.data?.error || 'Failed to load WebPOS catalog');",
        "toast.error(e.response?.data?.error || t('webPosLoadFailed'));",
    ),
    (
        "toast.error('You do not have permission to open the cash drawer');",
        "toast.error(t('webPosDrawerDenied'));",
    ),
    ("toast.success('Cash drawer opened');", "toast.success(t('webPosDrawerOpened'));"),
    (
        "toast.error(e.message || 'Could not open cash drawer');",
        "toast.error(e.message || t('webPosDrawerFailed'));",
    ),
    (
        "toast.success(`Signed in as ${staff.name}`);",
        "toast.success(t('webPosSignedInAs').replace('{name}', staff.name));",
    ),
]

missing = 0
for a, b in pairs:
    if a not in text:
        print("MISSING:", repr(a[:90]))
        missing += 1
    else:
        text = text.replace(a, b, 1)
        print("OK:", repr(a[:50]))

p.write_text(text, encoding="utf-8")
print("done, missing=", missing)
