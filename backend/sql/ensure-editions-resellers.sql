-- Idempotent: editions, resellers, merchant FKs
-- Run: psql ... < backend/sql/ensure-editions-resellers.sql

CREATE TABLE IF NOT EXISTS resellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(40),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  branding JSONB,
  created_by_superadmin_id UUID REFERENCES superadmins(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS resellers_email_idx ON resellers (email);
CREATE INDEX IF NOT EXISTS resellers_status_idx ON resellers (status);

CREATE TABLE IF NOT EXISTS editions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type VARCHAR(20) NOT NULL DEFAULT 'platform',
  owner_id UUID,
  name VARCHAR(150) NOT NULL,
  note TEXT,
  business_category VARCHAR(20) NOT NULL DEFAULT 'both',
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS editions_owner_idx ON editions (owner_type, owner_id);
CREATE INDEX IF NOT EXISTS editions_name_idx ON editions (name);

ALTER TABLE merchants ADD COLUMN IF NOT EXISTS reseller_id UUID REFERENCES resellers(id) ON DELETE SET NULL;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS edition_id UUID REFERENCES editions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS merchants_reseller_idx ON merchants (reseller_id);
CREATE INDEX IF NOT EXISTS merchants_edition_idx ON merchants (edition_id);
