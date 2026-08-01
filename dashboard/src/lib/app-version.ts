/** Injected from dashboard/package.json at build time via vite.config.ts */
declare const __APP_VERSION__: string;

export const APP_VERSION =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

export const dashboardVersionLabel = `Dashboard v${APP_VERSION}`;

export const webPosVersionLabel = `WebPOS v${APP_VERSION}`;
