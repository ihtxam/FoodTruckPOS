-- Gift Card + Loyalty schema (Phase 1)
-- Run against the FoodTruckPOS Postgres database when drizzle-kit push is unavailable.

ALTER TABLE merchants ADD COLUMN IF NOT EXISTS webpos_gift_card_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS gift_card_settings jsonb;

ALTER TABLE loyalty_cards ADD COLUMN IF NOT EXISTS suspended_reason text;
ALTER TABLE loyalty_transactions ADD COLUMN IF NOT EXISTS balance_after numeric(10, 2);
ALTER TABLE loyalty_transactions ADD COLUMN IF NOT EXISTS description text;

CREATE TABLE IF NOT EXISTS gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  card_number varchar(255) NOT NULL,
  card_media_type varchar(20) NOT NULL DEFAULT 'physical',
  balance numeric(10, 2) NOT NULL DEFAULT 0,
  status varchar(50) NOT NULL DEFAULT 'active',
  suspended_reason text,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  membership_enabled boolean NOT NULL DEFAULT false,
  points_balance integer NOT NULL DEFAULT 0,
  holder_name varchar(255),
  holder_email varchar(255),
  holder_phone varchar(40),
  ecard_email varchar(255),
  ecard_code varchar(64),
  issued_at timestamp NOT NULL DEFAULT now(),
  expires_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS gift_cards_merchant_card_number_idx
  ON gift_cards(merchant_id, card_number);
CREATE UNIQUE INDEX IF NOT EXISTS gift_cards_ecard_code_idx ON gift_cards(ecard_code);
CREATE INDEX IF NOT EXISTS gift_cards_merchant_id_idx ON gift_cards(merchant_id);
CREATE INDEX IF NOT EXISTS gift_cards_status_idx ON gift_cards(status);
CREATE INDEX IF NOT EXISTS gift_cards_customer_id_idx ON gift_cards(customer_id);

CREATE TABLE IF NOT EXISTS gift_card_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES gift_cards(id) ON DELETE CASCADE,
  transaction_type varchar(50) NOT NULL,
  amount numeric(10, 2),
  balance_after numeric(10, 2),
  points integer,
  points_after integer,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  description text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gift_card_transactions_merchant_id_idx
  ON gift_card_transactions(merchant_id);
CREATE INDEX IF NOT EXISTS gift_card_transactions_card_id_idx
  ON gift_card_transactions(card_id);
CREATE INDEX IF NOT EXISTS gift_card_transactions_order_id_idx
  ON gift_card_transactions(order_id);
