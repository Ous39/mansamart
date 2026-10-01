ALTER TABLE bookings ADD COLUMN IF NOT EXISTS base_price integer NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS travel_fee integer NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_amount integer NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS selected_package jsonb;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS selected_add_ons jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_location text NOT NULL DEFAULT 'customer';
