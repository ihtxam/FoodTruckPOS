import { createContext, useContext, type ReactNode } from 'react';

export type CmsMenuCategory = {
  id: string;
  name: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    description?: string;
    image?: string;
  }>;
};

export type CmsShopContextValue = {
  shopKey: string;
  basePath: string;
  menu: CmsMenuCategory[];
  storeHours: Record<string, Record<string, Array<{ open: string; close: string }>>>;
  merchantName?: string;
};

const CmsShopContext = createContext<CmsShopContextValue | null>(null);

export function CmsShopProvider({
  value,
  children,
}: {
  value: CmsShopContextValue;
  children: ReactNode;
}) {
  return <CmsShopContext.Provider value={value}>{children}</CmsShopContext.Provider>;
}

export function useCmsShop() {
  return useContext(CmsShopContext);
}
