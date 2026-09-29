import { pool } from "./db";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

async function execSafe(sql: string, label: string) {
  try {
    await pool.query(sql);
  } catch (error: any) {
    console.warn(`[startup-migration skipped] ${label}: ${error?.message || error}`);
  }
}

export async function runStartupMigrations() {
  // These small idempotent migrations make local/dev databases safe after feature upgrades.
  // They prevent login/register from failing when an older PostgreSQL schema is missing newer columns.
  await execSafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`, "pgcrypto extension");

  await execSafe(`ALTER TYPE role ADD VALUE IF NOT EXISTS 'delivery_rider';`, "role delivery_rider enum");
  await execSafe(`ALTER TYPE role ADD VALUE IF NOT EXISTS 'admin';`, "role admin enum");

  for (const status of [
    "paid", "confirmed", "processing", "preparing", "ready_for_pickup", "searching_rider",
    "rider_searching", "rider_assigned", "rider_arrived_vendor", "picked_up", "on_the_way",
    "shipped", "delivered", "completed", "cancelled", "refunded",
  ]) {
    await execSafe(`ALTER TYPE order_status ADD VALUE IF NOT EXISTS '${status}';`, `order_status ${status}`);
  }

  await execSafe(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS address text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS city text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS region text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS area text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude real;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude real;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS location_accuracy real;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS gender text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS business_name text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS business_type text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS pin text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS national_id text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_documents jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'not_submitted';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_edit_locked boolean NOT NULL DEFAULT false;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_change_status text NOT NULL DEFAULT 'none';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_profile_changes jsonb DEFAULT '{}'::jsonb;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_change_note text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_change_requested_at timestamp;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_change_reviewed_at timestamp;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_points integer NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS total_orders integer NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS total_spent integer NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now();
    ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
  `, "users compatibility columns");



  await execSafe(`
    CREATE TABLE IF NOT EXISTS sessions (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar REFERENCES users(id) ON DELETE CASCADE,
      token text UNIQUE,
      audience text,
      expires_at timestamp,
      created_at timestamp NOT NULL DEFAULT now()
    );
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id varchar REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS token text UNIQUE;
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS audience text;
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_name text;
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_platform text;
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address text;
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent text;
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_seen_at timestamp NOT NULL DEFAULT now();
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS revoked_at timestamp;
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at timestamp;
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now();
    DELETE FROM sessions WHERE audience IS NULL OR token !~ '^[0-9a-f]{64}$';
    ALTER TABLE sessions ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE sessions ALTER COLUMN token SET NOT NULL;
    ALTER TABLE sessions ALTER COLUMN audience SET NOT NULL;
    ALTER TABLE sessions ALTER COLUMN expires_at SET NOT NULL;
  `, "sessions auth compatibility table");

  await execSafe(`
    CREATE TABLE IF NOT EXISTS auth_identities (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider text NOT NULL,
      provider_subject text NOT NULL,
      provider_email text,
      last_used_at timestamp NOT NULL DEFAULT now(),
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_identities_provider_subject ON auth_identities(provider, provider_subject);
    CREATE INDEX IF NOT EXISTS idx_auth_identities_user ON auth_identities(user_id);

    CREATE TABLE IF NOT EXISTS phone_otp_challenges (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      phone text NOT NULL,
      purpose text NOT NULL,
      audience text NOT NULL,
      role text,
      name text,
      code_hash text NOT NULL,
      attempts integer NOT NULL DEFAULT 0,
      expires_at timestamp NOT NULL,
      resend_available_at timestamp NOT NULL,
      consumed_at timestamp,
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_phone_otp_challenges_phone ON phone_otp_challenges(phone, audience, created_at DESC);

    CREATE TABLE IF NOT EXISTS external_auth_tokens (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      provider text NOT NULL,
      token_hash text NOT NULL UNIQUE,
      expires_at timestamp NOT NULL,
      used_at timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_external_auth_tokens_expiry ON external_auth_tokens(expires_at);
  `, "passwordless and social authentication");

  await execSafe(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash text NOT NULL UNIQUE,
      expires_at timestamp NOT NULL,
      used_at timestamp,
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expiry ON password_reset_tokens(expires_at);
  `, "password reset tokens");

  await execSafe(`
    CREATE TABLE IF NOT EXISTS admin_mfa_challenges (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash text NOT NULL,
      expires_at timestamp NOT NULL,
      attempts integer NOT NULL DEFAULT 0,
      used_at timestamp,
      ip_address text,
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_admin_mfa_challenges_user ON admin_mfa_challenges(user_id);
    CREATE INDEX IF NOT EXISTS idx_admin_mfa_challenges_expiry ON admin_mfa_challenges(expires_at);
  `, "administrator MFA challenges");

  await execSafe(`
    CREATE TABLE IF NOT EXISTS review_helpful_votes (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      review_id varchar NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
      user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_review_helpful_votes_review_user ON review_helpful_votes(review_id, user_id);
  `, "review helpful votes");

  await execSafe(`
    CREATE TABLE IF NOT EXISTS notifications (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar REFERENCES users(id) ON DELETE CASCADE,
      type text NOT NULL DEFAULT 'system',
      title text NOT NULL,
      body text NOT NULL,
      icon text,
      color text,
      action_route text,
      is_read boolean NOT NULL DEFAULT false,
      created_at timestamp NOT NULL DEFAULT now()
    );
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id varchar REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'system';
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body text NOT NULL DEFAULT '';
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS icon text;
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS color text;
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_route text;
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false;
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now();
  `, "notifications compatibility table");

  await execSafe(`
    CREATE TABLE IF NOT EXISTS push_devices (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expo_push_token text NOT NULL UNIQUE,
      audience text NOT NULL,
      platform text NOT NULL,
      device_name text,
      enabled boolean NOT NULL DEFAULT true,
      last_seen_at timestamp NOT NULL DEFAULT now(),
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_push_devices_user_enabled ON push_devices(user_id, enabled);

    CREATE TABLE IF NOT EXISTS notification_preferences (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      orders boolean NOT NULL DEFAULT true,
      delivery boolean NOT NULL DEFAULT true,
      payments boolean NOT NULL DEFAULT true,
      bookings boolean NOT NULL DEFAULT true,
      messages boolean NOT NULL DEFAULT true,
      promotions boolean NOT NULL DEFAULT false,
      security boolean NOT NULL DEFAULT true,
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
    ALTER TABLE push_notifications ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'system';
    ALTER TABLE push_notifications ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
    ALTER TABLE push_notifications ADD COLUMN IF NOT EXISTS receipt_id text;
    ALTER TABLE push_notifications ADD COLUMN IF NOT EXISTS last_error text;
  `, "push devices and notification preferences");

  await execSafe(`
    CREATE TABLE IF NOT EXISTS vendor_profiles (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      store_name text NOT NULL,
      shop_category text NOT NULL DEFAULT 'general',
      allowed_categories jsonb DEFAULT '[]'::jsonb,
      subcategories jsonb DEFAULT '[]'::jsonb,
      description text,
      cover_image text,
      logo text,
      location text,
      operating_hours text,
      delivery_zones jsonb DEFAULT '[]'::jsonb,
      support_phone text,
      support_email text,
      min_order_amount integer NOT NULL DEFAULT 0,
      return_policy text DEFAULT '7-day return policy for all items.',
      shipping_policy text DEFAULT 'Delivery within 2-5 business days across The Gambia.',
      total_sales integer NOT NULL DEFAULT 0,
      total_revenue integer NOT NULL DEFAULT 0,
      rating real NOT NULL DEFAULT 4.5,
      review_count integer NOT NULL DEFAULT 0,
      verification_status text NOT NULL DEFAULT 'pending',
      verification_note text,
      documents jsonb DEFAULT '[]'::jsonb,
      profile_edit_locked boolean NOT NULL DEFAULT false,
      profile_change_status text NOT NULL DEFAULT 'none',
      pending_profile_changes jsonb DEFAULT '{}'::jsonb,
      profile_change_note text,
      profile_change_requested_at timestamp,
      profile_change_reviewed_at timestamp,
      whatsapp text,
      facebook text,
      instagram text,
      business_registration_no text,
      tax_number text,
      bank_name text,
      account_name text,
      account_number text,
      mobile_money_provider text,
      mobile_money_number text,
      internal_notes text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS store_name text NOT NULL DEFAULT 'Store';
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS shop_category text NOT NULL DEFAULT 'general';
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS allowed_categories jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS subcategories jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS description text;
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS cover_image text;
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS logo text;
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS location text;
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS delivery_zones jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS whatsapp text;
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS mobile_money_number text;
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS account_number text;
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS payout_method text;
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS documents jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending';
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now();
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
  `, "vendor_profiles compatibility table");

  await execSafe(`
    CREATE TABLE IF NOT EXISTS provider_profiles (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      display_name text NOT NULL,
      bio text,
      profile_image text,
      cover_image text,
      location text,
      service_areas jsonb DEFAULT '["Banjul", "Serrekunda"]'::jsonb,
      portfolio jsonb DEFAULT '[]'::jsonb,
      certifications jsonb DEFAULT '[]'::jsonb,
      total_jobs integer NOT NULL DEFAULT 0,
      total_earnings integer NOT NULL DEFAULT 0,
      rating real NOT NULL DEFAULT 4.5,
      review_count integer NOT NULL DEFAULT 0,
      verification_status text NOT NULL DEFAULT 'pending',
      verification_note text,
      documents jsonb DEFAULT '[]'::jsonb,
      response_time text DEFAULT '< 1 hour',
      whatsapp text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
    ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS display_name text NOT NULL DEFAULT 'Provider';
    ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS bio text;
    ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS profile_image text;
    ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS cover_image text;
    ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS location text;
    ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS service_areas jsonb DEFAULT '["Banjul", "Serrekunda"]'::jsonb;
    ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS certifications jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS documents jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS whatsapp text;
    ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS payout_method text;
    ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS bank_name text;
    ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS account_name text;
    ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS account_number text;
    ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS mobile_money_provider text;
    ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS mobile_money_number text;
    ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending';
    ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now();
    ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
  `, "provider_profiles compatibility table");

  await execSafe(`
    CREATE TABLE IF NOT EXISTS delivery_riders (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      display_name text,
      bio text,
      profile_photo text,
      cover_image text,
      phone text,
      whatsapp text,
      current_address text,
      home_address text,
      city text,
      district text,
      region text,
      area text,
      service_zones jsonb DEFAULT '[]'::jsonb,
      vehicle_type text NOT NULL DEFAULT 'motorbike',
      vehicle_model text,
      vehicle_color text,
      vehicle_plate text,
      vehicle_registration_no text,
      license_number text,
      driving_license_expiry text,
      national_id_number text,
      emergency_contact_name text,
      emergency_contact_phone text,
      payout_method text,
      mobile_money_provider text,
      mobile_money_number text,
      bank_name text,
      account_name text,
      account_number text,
      internal_notes text,
      documents jsonb DEFAULT '[]'::jsonb,
      verification_status text NOT NULL DEFAULT 'pending',
      is_online boolean NOT NULL DEFAULT false,
      is_available boolean NOT NULL DEFAULT false,
      latitude real,
      longitude real,
      completed_deliveries integer NOT NULL DEFAULT 0,
      total_deliveries integer NOT NULL DEFAULT 0,
      total_earnings integer NOT NULL DEFAULT 0,
      rating real NOT NULL DEFAULT 5,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS display_name text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS bio text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS profile_photo text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS cover_image text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS phone text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS whatsapp text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS current_address text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS home_address text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS city text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS district text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS region text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS area text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS service_zones jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS vehicle_type text NOT NULL DEFAULT 'motorbike';
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS vehicle_model text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS vehicle_color text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS vehicle_plate text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS vehicle_registration_no text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS license_number text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS driving_license_expiry text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS national_id_number text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS emergency_contact_name text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS emergency_contact_phone text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS payout_method text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS mobile_money_provider text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS mobile_money_number text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS bank_name text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS account_name text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS account_number text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS internal_notes text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS documents jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending';
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT false;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS latitude real;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS longitude real;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS completed_deliveries integer NOT NULL DEFAULT 0;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS total_deliveries integer NOT NULL DEFAULT 0;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS total_earnings integer NOT NULL DEFAULT 0;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now();
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
  `, "delivery_riders compatibility table");

  await execSafe(`
    ALTER TABLE products ADD COLUMN IF NOT EXISTS area text;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS latitude real;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS longitude real;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 10;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS in_stock boolean NOT NULL DEFAULT true;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS sold_count integer NOT NULL DEFAULT 0;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS free_shipping boolean NOT NULL DEFAULT false;
  `, "products compatibility columns");

  await execSafe(`
    ALTER TABLE services ADD COLUMN IF NOT EXISTS service_areas jsonb DEFAULT '["Banjul", "Serrekunda", "Kanifing"]'::jsonb;
    ALTER TABLE services ADD COLUMN IF NOT EXISTS area text;
    ALTER TABLE services ADD COLUMN IF NOT EXISTS latitude real;
    ALTER TABLE services ADD COLUMN IF NOT EXISTS longitude real;
    ALTER TABLE services ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT true;
  `, "services compatibility columns");

  await execSafe(`
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
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_code text;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery text;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code text;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount integer NOT NULL DEFAULT 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
  `, "orders compatibility columns");

  await execSafe(`
    CREATE TABLE IF NOT EXISTS order_vendor_fulfillments (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id varchar NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      vendor_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subtotal integer NOT NULL CHECK (subtotal >= 0),
      status text NOT NULL DEFAULT 'pending',
      notes text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(),
      UNIQUE (order_id, vendor_id)
    );
    CREATE INDEX IF NOT EXISTS idx_order_vendor_fulfillments_vendor_created
      ON order_vendor_fulfillments(vendor_id, created_at DESC);
  `, "order vendor fulfillment table");

  await execSafe(`
    CREATE TABLE IF NOT EXISTS wallets (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      balance integer NOT NULL DEFAULT 0,
      pending_balance integer NOT NULL DEFAULT 0,
      locked_balance integer NOT NULL DEFAULT 0,
      currency text NOT NULL DEFAULT 'GMD',
      status text NOT NULL DEFAULT 'active',
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
    ALTER TABLE wallets ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
  `, "wallets table");

  await execSafe(`
    CREATE TABLE IF NOT EXISTS shopper_profiles (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      preferred_categories jsonb DEFAULT '[]'::jsonb,
      preferred_location text,
      default_delivery_address text,
      default_phone text,
      loyalty_tier text NOT NULL DEFAULT 'Bronze',
      wishlist_count integer NOT NULL DEFAULT 0,
      total_orders integer NOT NULL DEFAULT 0,
      total_spent integer NOT NULL DEFAULT 0,
      notes text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
  `, "shopper_profiles table");

  await execSafe(`
    ALTER TABLE IF EXISTS addresses ADD COLUMN IF NOT EXISTS latitude real;
    ALTER TABLE IF EXISTS addresses ADD COLUMN IF NOT EXISTS longitude real;
    ALTER TABLE IF EXISTS addresses ADD COLUMN IF NOT EXISTS location_accuracy real;
  `, "saved-address map coordinates");

  await execSafe(`
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
      delivery_id varchar,
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
      delivery_id varchar,
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
  `, "tracking/escrow tables");

  await execSafe(`
    WITH duplicate_active_deliveries AS (
      SELECT id,
             row_number() OVER (
               PARTITION BY order_id
               ORDER BY CASE status WHEN 'in_transit' THEN 1 WHEN 'picked_up' THEN 2 WHEN 'assigned' THEN 3 ELSE 4 END,
                        created_at DESC,
                        id DESC
             ) AS position
      FROM deliveries
      WHERE status NOT IN ('failed', 'cancelled', 'delivered')
    )
    UPDATE deliveries
    SET status = 'cancelled', updated_at = now()
    WHERE id IN (
      SELECT id FROM duplicate_active_deliveries WHERE position > 1
    );
    CREATE INDEX IF NOT EXISTS idx_rider_locations_delivery_created
      ON rider_locations(delivery_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_deliveries_order_created
      ON deliveries(order_id, created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_deliveries_one_active_order
      ON deliveries(order_id)
      WHERE status NOT IN ('failed', 'cancelled', 'delivered');
  `, "delivery map indexes and single active dispatch");




  await execSafe(`
    UPDATE users SET role = 'delivery_rider', verification_status = CASE WHEN verification_status = 'not_submitted' THEN 'pending' ELSE verification_status END
    WHERE id IN (SELECT user_id FROM delivery_riders) AND role IN ('user', 'shopper', 'customer');
    UPDATE users SET role = 'vendor', verification_status = CASE WHEN verification_status = 'not_submitted' THEN 'pending' ELSE verification_status END
    WHERE id IN (SELECT user_id FROM vendor_profiles) AND role IN ('user', 'shopper', 'customer');
    UPDATE users SET role = 'service_provider', verification_status = CASE WHEN verification_status = 'not_submitted' THEN 'pending' ELSE verification_status END
    WHERE id IN (SELECT user_id FROM provider_profiles) AND role IN ('user', 'shopper', 'customer');
  `, "role repair for existing profile accounts");

  await execSafe(`
    DELETE FROM profile_completion_checks older
    USING profile_completion_checks newer
    WHERE older.user_id = newer.user_id
      AND (older.updated_at, older.id) < (newer.updated_at, newer.id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_completion_checks_user_unique
      ON profile_completion_checks(user_id);
    CREATE INDEX IF NOT EXISTS idx_users_location ON users(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_products_location ON products(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_products_category_stock ON products(category, in_stock, stock);
    CREATE INDEX IF NOT EXISTS idx_services_location ON services(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_delivery_riders_availability ON delivery_riders(is_online, is_available, verification_status);
    CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_orders_rider_status ON orders(rider_id, status);
    CREATE INDEX IF NOT EXISTS idx_order_tracking_events_order_created ON order_tracking_events(order_id, created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_order_qr_codes_active_purpose ON order_qr_codes(order_id, purpose) WHERE status = 'active';
  `, "performance and integrity indexes");

  await execSafe(`
    CREATE TABLE IF NOT EXISTS payment_attempts (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id varchar NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      user_id varchar REFERENCES users(id) ON DELETE SET NULL,
      provider text NOT NULL DEFAULT 'wave',
      status text NOT NULL DEFAULT 'pending',
      amount integer NOT NULL CHECK (amount > 0),
      currency text NOT NULL,
      client_reference text NOT NULL UNIQUE,
      provider_session_id text UNIQUE,
      provider_transaction_id text,
      launch_url text,
      failure_code text,
      failure_message text,
      provider_payload jsonb DEFAULT '{}'::jsonb,
      expires_at timestamp,
      paid_at timestamp,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS payment_webhook_events (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      provider text NOT NULL DEFAULT 'wave',
      event_id text NOT NULL UNIQUE,
      event_type text NOT NULL,
      provider_session_id text,
      status text NOT NULL DEFAULT 'received',
      failure_message text,
      payload jsonb NOT NULL,
      received_at timestamp NOT NULL DEFAULT now(),
      processed_at timestamp
    );
    CREATE TABLE IF NOT EXISTS payment_refunds (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      payment_attempt_id varchar NOT NULL REFERENCES payment_attempts(id) ON DELETE CASCADE,
      order_id varchar NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      requested_by varchar REFERENCES users(id) ON DELETE SET NULL,
      provider text NOT NULL DEFAULT 'wave',
      amount integer NOT NULL CHECK (amount > 0),
      currency text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      reason text NOT NULL,
      failure_code text,
      failure_message text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(),
      completed_at timestamp
    );
    CREATE INDEX IF NOT EXISTS idx_payment_attempts_order_created ON payment_attempts(order_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_payment_attempts_user_created ON payment_attempts(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_payment_attempts_status ON payment_attempts(status);
    CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_session ON payment_webhook_events(provider_session_id);
    WITH ranked_active_attempts AS (
      SELECT id,
             row_number() OVER (PARTITION BY order_id, provider ORDER BY created_at DESC, id DESC) AS position
      FROM payment_attempts
      WHERE provider = 'wave' AND status IN ('pending', 'processing')
    )
    UPDATE payment_attempts
    SET status = 'failed',
        failure_code = 'superseded-checkout',
        failure_message = 'Closed while enforcing one active checkout per order',
        updated_at = now()
    WHERE id IN (SELECT id FROM ranked_active_attempts WHERE position > 1);
    DROP INDEX IF EXISTS idx_payment_refunds_attempt;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_refunds_attempt_unique ON payment_refunds(payment_attempt_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_attempts_active_wave_order
      ON payment_attempts(order_id, provider)
      WHERE provider = 'wave' AND status IN ('pending', 'processing');
  `, "Wave payment tables");

  try {
    const whatsappMigrationPath = fileURLToPath(new URL("../../../packages/database/migrations/whatsapp_commerce_migration.sql", import.meta.url));
    await execSafe(readFileSync(whatsappMigrationPath, "utf8"), "WhatsApp commerce tables");
  } catch (error: any) {
    console.warn(`[startup-migration skipped] WhatsApp commerce migration file: ${error?.message || error}`);
  }

  console.log("Database compatibility check completed.");
}
