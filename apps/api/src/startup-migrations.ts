import { pool } from "./db";

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
      expires_at timestamp,
      created_at timestamp NOT NULL DEFAULT now()
    );
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id varchar REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS token text UNIQUE;
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at timestamp;
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now();
  `, "sessions auth compatibility table");

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
    UPDATE users SET role = 'delivery_rider', verification_status = CASE WHEN verification_status = 'not_submitted' THEN 'pending' ELSE verification_status END
    WHERE id IN (SELECT user_id FROM delivery_riders) AND role IN ('user', 'shopper', 'customer');
    UPDATE users SET role = 'vendor', verification_status = CASE WHEN verification_status = 'not_submitted' THEN 'pending' ELSE verification_status END
    WHERE id IN (SELECT user_id FROM vendor_profiles) AND role IN ('user', 'shopper', 'customer');
    UPDATE users SET role = 'service_provider', verification_status = CASE WHEN verification_status = 'not_submitted' THEN 'pending' ELSE verification_status END
    WHERE id IN (SELECT user_id FROM provider_profiles) AND role IN ('user', 'shopper', 'customer');
  `, "role repair for existing profile accounts");

  await execSafe(`
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

  console.log("Database compatibility check completed.");
}
