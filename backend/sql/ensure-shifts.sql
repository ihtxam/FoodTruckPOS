-- Cash shifts for WebPOS (idempotent).
-- Deploy normally runs `drizzle-kit push` via the migrate container.
-- If Settings ? POS ? Operations toggle save fails, or WebPOS never shows
-- Start/Close shift, apply this once against Postgres:
--
--   psql "$DATABASE_URL" -f backend/sql/ensure-shifts.sql
--
-- Or from the api/migrate container:
--   docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < backend/sql/ensure-shifts.sql

ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS shifts_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS pos_color_theme varchar(20) NOT NULL DEFAULT 'teal';

CREATE TABLE IF NOT EXISTS pos_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES merchant_staff(id) ON DELETE SET NULL,
  staff_name varchar(255),
  status varchar(20) NOT NULL DEFAULT 'open',
  opened_at timestamp NOT NULL DEFAULT now(),
  closed_at timestamp,
  opening_cash numeric(12, 2) NOT NULL DEFAULT 0,
  closing_cash_counted numeric(12, 2),
  expected_cash numeric(12, 2),
  cash_sales numeric(12, 2) DEFAULT 0,
  card_sales numeric(12, 2) DEFAULT 0,
  terminal_sales numeric(12, 2) DEFAULT 0,
  other_sales numeric(12, 2) DEFAULT 0,
  order_count integer DEFAULT 0,
  variance numeric(12, 2),
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pos_shifts_merchant_idx ON pos_shifts (merchant_id);
CREATE INDEX IF NOT EXISTS pos_shifts_status_idx ON pos_shifts (merchant_id, status);
CREATE INDEX IF NOT EXISTS pos_shifts_opened_idx ON pos_shifts (merchant_id, opened_at);
