ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at timestamp;

CREATE TABLE IF NOT EXISTS admin_access_profiles (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  staff_role text NOT NULL DEFAULT 'super_admin', permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  department text NOT NULL DEFAULT 'management', status text NOT NULL DEFAULT 'active',
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_access_profiles_user_unique ON admin_access_profiles(user_id);

CREATE TABLE IF NOT EXISTS platform_settings (
  key text PRIMARY KEY, value jsonb NOT NULL, category text NOT NULL DEFAULT 'general', description text,
  is_sensitive boolean NOT NULL DEFAULT false, updated_by varchar REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operational_incidents (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), type text NOT NULL, severity text NOT NULL DEFAULT 'medium',
  title text NOT NULL, description text, entity_type text, entity_id varchar, status text NOT NULL DEFAULT 'open',
  assigned_to varchar REFERENCES users(id) ON DELETE SET NULL, resolution text, resolved_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_operational_incidents_status_created ON operational_incidents(status, created_at DESC);

INSERT INTO platform_settings (key, value, category, description) VALUES
  ('maintenance_mode', 'false'::jsonb, 'operations', 'Temporarily prevent non-admin marketplace activity'),
  ('wave_enabled', 'false'::jsonb, 'payments', 'Enable Wave only after GMD and merchant approval'),
  ('whatsapp_enabled', 'false'::jsonb, 'notifications', 'Enable approved Meta WhatsApp templates'),
  ('new_vendor_registration', 'true'::jsonb, 'marketplace', 'Allow new vendor applications'),
  ('new_rider_registration', 'true'::jsonb, 'delivery', 'Allow new rider applications')
ON CONFLICT (key) DO NOTHING;
