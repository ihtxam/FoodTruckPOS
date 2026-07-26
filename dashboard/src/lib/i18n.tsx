import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Locale = 'en' | 'fr' | 'de';

const dictionaries: Record<Locale, Record<string, string>> = {
  en: {
    overview: 'Overview',
    orders: 'Orders',
    products: 'Products',
    modifiers: 'Modifiers',
    categories: 'Categories',
    customers: 'Customers',
    loyalty: 'Loyalty',
    terminals: 'Adyen terminals',
    floorPlan: 'Floor plan',
    floorPlanEnabled: 'Enable floor plan / table service',
    paxOrderingEnabled: 'PAX per-person ordering & billing',
    webPos: 'WebPOS',
    billing: 'Billing',
    settings: 'Settings',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    language: 'Language',
    merchantDashboard: 'Merchant Dashboard',
    logout: 'Log out',
    takeaway: 'Take away',
    dineIn: 'Dine in',
    delivery: 'Delivery',
    shop: 'Online shop',
    deliveryZones: 'Delivery zones',
    storeHours: 'Store hours',
    subdomain: 'Shop subdomain',
    taxRates: 'Tax rates by channel',
    adyenCredentials: 'Adyen credentials',
    merchantAccount: 'Merchant account',
    apiKey: 'API key',
    clientId: 'Client ID',
    rfidReader: 'RFID card reader',
    tapCard: 'Tap RFID card',
    giftCard: 'Gift card',
    loyaltyCard: 'Loyalty card',
  },
  fr: {
    overview: 'Aperçu',
    orders: 'Commandes',
    products: 'Produits',
    modifiers: 'Modificateurs',
    categories: 'Catégories',
    customers: 'Clients',
    loyalty: 'Fidélité',
    terminals: 'Terminaux Adyen',
    floorPlan: 'Plan de salle',
    floorPlanEnabled: 'Activer plan de salle / tables',
    paxOrderingEnabled: 'Commande & addition par personne (PAX)',
    webPos: 'WebPOS',
    billing: 'Facturation',
    settings: 'Paramètres',
    save: 'Enregistrer',
    cancel: 'Annuler',
    delete: 'Supprimer',
    edit: 'Modifier',
    add: 'Ajouter',
    language: 'Langue',
    merchantDashboard: 'Espace commerçant',
    logout: 'Déconnexion',
    takeaway: 'À emporter',
    dineIn: 'Sur place',
    delivery: 'Livraison',
    shop: 'Boutique en ligne',
    deliveryZones: 'Zones de livraison',
    storeHours: 'Horaires',
    subdomain: 'Sous-domaine boutique',
    taxRates: 'Taxes par canal',
    adyenCredentials: 'Identifiants Adyen',
    merchantAccount: 'Compte marchand',
    apiKey: 'Clé API',
    clientId: 'ID client',
    rfidReader: 'Lecteur RFID',
    tapCard: 'Présenter la carte RFID',
    giftCard: 'Carte cadeau',
    loyaltyCard: 'Carte de fidélité',
  },
  de: {
    overview: 'Übersicht',
    orders: 'Bestellungen',
    products: 'Produkte',
    modifiers: 'Modifieren',
    categories: 'Kategorien',
    customers: 'Kunden',
    loyalty: 'Treue',
    terminals: 'Adyen-Terminals',
    floorPlan: 'Tischplan',
    floorPlanEnabled: 'Tischplan / Tischservice aktivieren',
    paxOrderingEnabled: 'PAX-Bestellung & Rechnung pro Person',
    webPos: 'WebPOS',
    billing: 'Abrechnung',
    settings: 'Einstellungen',
    save: 'Speichern',
    cancel: 'Abbrechen',
    delete: 'Löschen',
    edit: 'Bearbeiten',
    add: 'Hinzufügen',
    language: 'Sprache',
    merchantDashboard: 'Händler-Dashboard',
    logout: 'Abmelden',
    takeaway: 'Mitnehmen',
    dineIn: 'Vor Ort',
    delivery: 'Lieferung',
    shop: 'Online-Shop',
    deliveryZones: 'Lieferzonen',
    storeHours: 'Öffnungszeiten',
    subdomain: 'Shop-Subdomain',
    taxRates: 'Steuern nach Kanal',
    adyenCredentials: 'Adyen-Zugangsdaten',
    merchantAccount: 'Händlerkonto',
    apiKey: 'API-Schlüssel',
    clientId: 'Client-ID',
    rfidReader: 'RFID-Kartenleser',
    tapCard: 'RFID-Karte tippen',
    giftCard: 'Geschenkkarte',
    loyaltyCard: 'Treuekarte',
  },
};

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);
const STORAGE_KEY = 'manupos_panel_lang';

function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'fr' || value === 'de';
}

export function I18nProvider({ children, initialLocale }: { children: ReactNode; initialLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (isLocale(stored)) return stored;
    } catch {
      // ignore
    }
    return isLocale(initialLocale) ? initialLocale : 'en';
  });

  const setLocale = useCallback((next: Locale) => {
    if (!isLocale(next)) return;
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  // Apply server/initial locale only once on first mount if provided and no stored preference.
  useEffect(() => {
    if (!isLocale(initialLocale)) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!isLocale(stored)) {
        setLocaleState(initialLocale);
        localStorage.setItem(STORAGE_KEY, initialLocale);
      }
    } catch {
      setLocaleState(initialLocale);
    }
    // intentionally only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: (key: string) => dictionaries[locale][key] || dictionaries.en[key] || key,
    }),
    [locale, setLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      locale: 'en' as Locale,
      setLocale: (_locale: Locale) => undefined,
      t: (key: string) => dictionaries.en[key] || key,
    };
  }
  return ctx;
}
