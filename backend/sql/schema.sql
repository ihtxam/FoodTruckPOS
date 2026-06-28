CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  currency_symbol TEXT NOT NULL DEFAULT 'CHF',
  api_key TEXT UNIQUE,
  shop_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_api_key ON tenants(api_key) WHERE api_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_model TEXT,
  app_version TEXT,
  customer_name TEXT,
  plan_label TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  expires_at BIGINT NOT NULL,
  activated_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  UNIQUE (tenant_id, device_id)
);

CREATE TABLE IF NOT EXISTS activation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  label TEXT,
  bound_device_id TEXT,
  valid_days INT NOT NULL DEFAULT 365,
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  color_hex TEXT,
  online_visible BOOLEAN NOT NULL DEFAULT TRUE,
  kiosk_visible BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(6, 3) NOT NULL DEFAULT 0,
  sku TEXT,
  image_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  in_stock BOOLEAN NOT NULL DEFAULT TRUE,
  online_visible BOOLEAN NOT NULL DEFAULT TRUE,
  kiosk_visible BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS online_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'ONLINE',
  status TEXT NOT NULL DEFAULT 'NEW',
  service_type TEXT NOT NULL DEFAULT 'TAKEAWAY',
  fulfillment_type TEXT NOT NULL DEFAULT 'PICKUP',
  customer_name TEXT,
  customer_phone TEXT,
  delivery_address TEXT,
  pickup_time_ms BIGINT,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  pos_ack_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);
CREATE INDEX IF NOT EXISTS idx_categories_tenant_updated ON categories(tenant_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_products_tenant_updated ON products(tenant_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_online_orders_tenant_status ON online_orders(tenant_id, status, created_at);

-- Safe upgrades for existing databases
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS api_key TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS shop_enabled BOOLEAN NOT NULL DEFAULT TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS tenants_api_key_unique ON tenants(api_key) WHERE api_key IS NOT NULL;
