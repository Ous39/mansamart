ALTER TABLE products ADD COLUMN IF NOT EXISTS image_studio jsonb NOT NULL DEFAULT '{"background":"white","originalImages":[],"edited":false}'::jsonb;
ALTER TABLE services ADD COLUMN IF NOT EXISTS gallery jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE services ADD COLUMN IF NOT EXISTS packages jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE services ADD COLUMN IF NOT EXISTS add_ons jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE services ADD COLUMN IF NOT EXISTS service_location text NOT NULL DEFAULT 'customer';
ALTER TABLE services ADD COLUMN IF NOT EXISTS travel_fee integer NOT NULL DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS deposit_percent integer NOT NULL DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS minimum_lead_hours integer NOT NULL DEFAULT 2;
ALTER TABLE services ADD COLUMN IF NOT EXISTS cancellation_policy text;
