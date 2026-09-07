-- MansaMart order tracking, QR, rider dispatch, and escrow migration
-- Run this manually if drizzle-kit push does not fully alter existing enum/table columns.

DO $$ BEGIN
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'paid';
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'confirmed';
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'preparing';
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'searching_rider';
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'rider_arrived_vendor';
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'on_the_way';
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'completed';
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'refunded';
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS area text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude real;
ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude real;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location_accuracy real;

ALTER TABLE products ADD COLUMN IF NOT EXISTS area text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS latitude real;
ALTER TABLE products ADD COLUMN IF NOT EXISTS longitude real;

ALTER TABLE services ADD COLUMN IF NOT EXISTS area text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS latitude real;
ALTER TABLE services ADD COLUMN IF NOT EXISTS longitude real;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_type text NOT NULL DEFAULT 'delivery';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS escrow_status text NOT NULL DEFAULT 'not_started';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS qr_code text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS qr_secret text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rider_id varchar REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_confirmed_at timestamp;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_confirmed_at timestamp;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_at timestamp;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_latitude real;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_longitude real;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_area text;

CREATE TABLE IF NOT EXISTS order_tracking_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id varchar NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  actor_id varchar REFERENCES users(id) ON DELETE SET NULL,
  actor_role text,
  status text NOT NULL,
  title text NOT NULL,
  message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_qr_codes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id varchar NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  purpose text NOT NULL DEFAULT 'order',
  status text NOT NULL DEFAULT 'active',
  used_by varchar REFERENCES users(id) ON DELETE SET NULL,
  used_at timestamp,
  expires_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rider_locations (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delivery_id varchar REFERENCES deliveries(id) ON DELETE SET NULL,
  latitude real NOT NULL,
  longitude real NOT NULL,
  accuracy real,
  heading real,
  speed real,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rider_earnings (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delivery_id varchar REFERENCES deliveries(id) ON DELETE SET NULL,
  order_id varchar REFERENCES orders(id) ON DELETE SET NULL,
  amount integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT now(),
  paid_at timestamp
);

CREATE TABLE IF NOT EXISTS escrow_transactions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id varchar NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payer_id varchar REFERENCES users(id) ON DELETE SET NULL,
  amount integer NOT NULL,
  product_amount integer NOT NULL DEFAULT 0,
  delivery_fee integer NOT NULL DEFAULT 0,
  commission_amount integer NOT NULL DEFAULT 0,
  vendor_amount integer NOT NULL DEFAULT 0,
  rider_amount integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'held',
  method text NOT NULL DEFAULT 'wallet',
  reference text,
  created_at timestamp NOT NULL DEFAULT now(),
  released_at timestamp
);

CREATE TABLE IF NOT EXISTS settlements (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id varchar REFERENCES orders(id) ON DELETE SET NULL,
  beneficiary_id varchar REFERENCES users(id) ON DELETE SET NULL,
  beneficiary_type text NOT NULL,
  amount integer NOT NULL,
  status text NOT NULL DEFAULT 'completed',
  note text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profile_completion_checks (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  missing_items jsonb DEFAULT '[]'::jsonb,
  restricted boolean NOT NULL DEFAULT false,
  last_reminder_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS push_notifications (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued',
  sent_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id varchar REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id varchar,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);
