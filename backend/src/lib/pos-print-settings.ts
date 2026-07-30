/** Cloud POS / WebPOS receipt + printer settings (shared with Android later). */

export type PosPrinterProfile = {
  id: string;
  /** Windows printer name (print-agent) or device label */
  name: string;
  enabled?: boolean;
  paperWidthMm?: 58 | 80;
  printReceipts?: boolean;
  printKitchenTickets?: boolean;
  printEndOfDayReports?: boolean;
  printAllProducts?: boolean;
  linkedCategoryIds?: string[];
  linkedProductIds?: string[];
};

export type PosPrintSettings = {
  receiptHeader?: string;
  receiptFooter?: string;
  kitchenTicketHeader?: string;
  kitchenTicketFooter?: string;
  /** Kitchen item text scale: 1=normal, 2=double height (~12pt tall), 3=double width+height */
  kitchenItemTextScale?: 1 | 2 | 3;
  /** Kitchen header text scale */
  kitchenHeaderTextScale?: 1 | 2 | 3;
  /** Bold kitchen item/header text (default true when scale > 1) */
  kitchenBoldText?: boolean;
  receiptShowVatTable?: boolean;
  receiptShowStaffLine?: boolean;
  receiptShowQrCode?: boolean;
  /** Default paper width when printer profile has none */
  paperWidthMm?: 58 | 80;
  /** Receipt language; "panel" follows panelLanguage */
  receiptLanguage?: "en" | "fr" | "de" | "panel";
  /** Override logo; empty/null falls back to shopLogoUrl */
  receiptLogoUrl?: string | null;
  autoPrintReceipt?: boolean;
  autoPrintKitchen?: boolean;
  printers?: PosPrinterProfile[];
};

export const DEFAULT_POS_PRINT_SETTINGS: Required<
  Omit<PosPrintSettings, "receiptLogoUrl" | "printers">
> & { receiptLogoUrl: string | null; printers: PosPrinterProfile[] } = {
  receiptHeader: "",
  receiptFooter: "Merci / Danke / Thank you",
  kitchenTicketHeader: "",
  kitchenTicketFooter: "",
  kitchenItemTextScale: 2,
  kitchenHeaderTextScale: 2,
  kitchenBoldText: true,
  receiptShowVatTable: true,
  receiptShowStaffLine: true,
  receiptShowQrCode: true,
  paperWidthMm: 80,
  receiptLanguage: "panel",
  receiptLogoUrl: null,
  autoPrintReceipt: true,
  autoPrintKitchen: true,
  printers: [],
};

export function normalizePosPrintSettings(raw: unknown): PosPrintSettings {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const paper = Number(src.paperWidthMm) === 58 ? 58 : 80;
  const lang = String(src.receiptLanguage || "panel").toLowerCase();
  const receiptLanguage = (["en", "fr", "de", "panel"] as const).includes(lang as "en")
    ? (lang as PosPrintSettings["receiptLanguage"])
    : "panel";

  const printersRaw = Array.isArray(src.printers) ? src.printers : [];
  const printers: PosPrinterProfile[] = printersRaw
    .map((p, i) => {
      if (!p || typeof p !== "object") return null;
      const row = p as Record<string, unknown>;
      const name = String(row.name || "").trim().slice(0, 200);
      if (!name) return null;
      return {
        id: String(row.id || `p-${i}-${Date.now()}`).slice(0, 64),
        name,
        enabled: row.enabled !== false,
        paperWidthMm: Number(row.paperWidthMm) === 58 ? 58 : 80,
        printReceipts: !!row.printReceipts,
        printKitchenTickets: !!row.printKitchenTickets,
        printEndOfDayReports: !!row.printEndOfDayReports,
        printAllProducts: row.printAllProducts !== false,
        linkedCategoryIds: Array.isArray(row.linkedCategoryIds)
          ? row.linkedCategoryIds.map(String).slice(0, 200)
          : [],
        linkedProductIds: Array.isArray(row.linkedProductIds)
          ? row.linkedProductIds.map(String).slice(0, 500)
          : [],
      } as PosPrinterProfile;
    })
    .filter(Boolean) as PosPrinterProfile[];

  const itemScale = Number(src.kitchenItemTextScale);
  const headerScale = Number(src.kitchenHeaderTextScale);
  const kitchenItemTextScale = (itemScale === 1 || itemScale === 3 ? itemScale : 2) as 1 | 2 | 3;
  const kitchenHeaderTextScale = (headerScale === 1 || headerScale === 3 ? headerScale : 2) as
    | 1
    | 2
    | 3;

  return {
    receiptHeader: String(src.receiptHeader ?? "").slice(0, 2000),
    receiptFooter: String(src.receiptFooter ?? DEFAULT_POS_PRINT_SETTINGS.receiptFooter).slice(0, 2000),
    kitchenTicketHeader: String(src.kitchenTicketHeader ?? "").slice(0, 2000),
    kitchenTicketFooter: String(src.kitchenTicketFooter ?? "").slice(0, 2000),
    kitchenItemTextScale,
    kitchenHeaderTextScale,
    kitchenBoldText: src.kitchenBoldText !== false,
    receiptShowVatTable: src.receiptShowVatTable !== false,
    receiptShowStaffLine: src.receiptShowStaffLine !== false,
    receiptShowQrCode: src.receiptShowQrCode !== false,
    paperWidthMm: paper,
    receiptLanguage,
    receiptLogoUrl:
      src.receiptLogoUrl === null || src.receiptLogoUrl === undefined
        ? null
        : String(src.receiptLogoUrl).trim().slice(0, 500) || null,
    autoPrintReceipt: src.autoPrintReceipt !== false,
    autoPrintKitchen: src.autoPrintKitchen !== false,
    printers,
  };
}

export const POS_CANCEL_REASONS = [
  { id: "could_not_process", en: "Could not process order", fr: "Commande impossible ù traiter", de: "Bestellung konnte nicht verarbeitet werden" },
  { id: "kitchen_busy", en: "Kitchen too busy", fr: "Cuisine trop occupùe", de: "Kùche ùberlastet" },
  { id: "client_cancel", en: "Client cancellation", fr: "Annulation client", de: "Stornierung durch Gast" },
  { id: "out_of_stock", en: "Out of stock", fr: "Rupture de stock", de: "Nicht vorrùtig" },
  { id: "wrong_order", en: "Wrong order entered", fr: "Mauvaise commande saisie", de: "Falsche Bestellung erfasst" },
  { id: "other", en: "Other", fr: "Autre", de: "Sonstiges" },
] as const;
