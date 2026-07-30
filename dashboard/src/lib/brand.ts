/** Product name shown in panel, shop chrome, emails, and receipts. */
export const APP_NAME = 'ChaslayReborn';

export const APP_PANEL_TITLE = `${APP_NAME} Admin`;

export const APP_TAGLINE = 'Restaurant POS & online ordering';

/** Browser tab title for online shop pages (merchant site + platform). */
export function shopDocumentTitle(pageOrMerchantName?: string | null): string {
  const label = pageOrMerchantName?.trim();
  return label ? `${label} · ${APP_NAME}` : APP_NAME;
}
