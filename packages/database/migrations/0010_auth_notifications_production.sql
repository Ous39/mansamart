ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_name text;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_platform text;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_seen_at timestamp NOT NULL DEFAULT now();
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS revoked_at timestamp;

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

ALTER TABLE push_notifications ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'system';
ALTER TABLE push_notifications ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
ALTER TABLE push_notifications ADD COLUMN IF NOT EXISTS receipt_id text;
ALTER TABLE push_notifications ADD COLUMN IF NOT EXISTS last_error text;
