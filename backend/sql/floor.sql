-- Floor sync: table orders + print jobs for waiter ? main POS coordination

CREATE TABLE IF NOT EXISTS floor_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_name TEXT,
  role TEXT NOT NULL DEFAULT 'STANDARD' CHECK (role IN ('MAIN_POS', 'WAITER', 'STANDARD')),
  lan_host TEXT,
  app_version TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, device_id)
);

CREATE TABLE IF NOT EXISTS floor_table_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  local_order_id TEXT NOT NULL,
  table_id BIGINT NOT NULL DEFAULT 0,
  table_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'OPEN',
  service_type TEXT NOT NULL DEFAULT 'DINE_IN',
  user_id BIGINT NOT NULL DEFAULT 0,
  user_name TEXT NOT NULL DEFAULT '',
  cart_json JSONB NOT NULL DEFAULT '{}',
  source_device_id TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, local_order_id)
);

CREATE TABLE IF NOT EXISTS floor_print_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('KITCHEN', 'RECEIPT')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'DONE', 'FAILED')),
  payload JSONB NOT NULL DEFAULT '{}',
  source_device_id TEXT NOT NULL DEFAULT '',
  target_role TEXT NOT NULL DEFAULT 'MAIN_POS',
  order_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_floor_orders_tenant_updated ON floor_table_orders(tenant_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_floor_print_pending ON floor_print_jobs(tenant_id, status, created_at)
  WHERE status = 'PENDING';
