CREATE TABLE IF NOT EXISTS whatsapp_connections (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_phone text NOT NULL,
  display_name text,
  waba_id text,
  phone_number_id text,
  status text NOT NULL DEFAULT 'pending',
  ai_enabled boolean NOT NULL DEFAULT true,
  human_handoff_enabled boolean NOT NULL DEFAULT true,
  catalog_sync_enabled boolean NOT NULL DEFAULT true,
  welcome_message text DEFAULT 'Welcome to our MansaMart shop. What are you looking for today?',
  fallback_message text DEFAULT 'A member of the shop team will reply shortly.',
  connected_at timestamp,
  last_webhook_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_connections_vendor_unique ON whatsapp_connections(vendor_id);
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_connections_phone_number_id_unique ON whatsapp_connections(phone_number_id);

CREATE TABLE IF NOT EXISTS whatsapp_customers (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone text NOT NULL,
  display_name text,
  opt_in_status text NOT NULL DEFAULT 'unknown',
  tags jsonb DEFAULT '[]'::jsonb,
  total_orders integer NOT NULL DEFAULT 0,
  total_spent integer NOT NULL DEFAULT 0,
  last_message_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_customers_vendor_phone_unique ON whatsapp_customers(vendor_id, phone);

CREATE TABLE IF NOT EXISTS whatsapp_threads (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id varchar NOT NULL REFERENCES whatsapp_customers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open',
  mode text NOT NULL DEFAULT 'ai',
  unread_count integer NOT NULL DEFAULT 0,
  last_message_preview text,
  last_message_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_threads_vendor_customer_unique ON whatsapp_threads(vendor_id, customer_id);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id varchar NOT NULL REFERENCES whatsapp_threads(id) ON DELETE CASCADE,
  provider_message_id text,
  direction text NOT NULL,
  type text NOT NULL DEFAULT 'text',
  body text,
  ai_generated boolean NOT NULL DEFAULT false,
  token_usage integer NOT NULL DEFAULT 0,
  delivery_status text NOT NULL DEFAULT 'received',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_provider_message_unique ON whatsapp_messages(provider_message_id);

CREATE TABLE IF NOT EXISTS whatsapp_carts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id varchar NOT NULL REFERENCES whatsapp_customers(id) ON DELETE CASCADE,
  order_id varchar REFERENCES orders(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  items jsonb DEFAULT '[]'::jsonb,
  subtotal integer NOT NULL DEFAULT 0,
  delivery_fee integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  expires_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS whatsapp_campaigns (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  template_name text,
  message text NOT NULL,
  audience jsonb DEFAULT '{"optInOnly":true}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  recipient_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  delivered_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  scheduled_at timestamp,
  sent_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_token_accounts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 50000,
  lifetime_purchased integer NOT NULL DEFAULT 0,
  lifetime_used integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ai_token_accounts_vendor_unique ON ai_token_accounts(vendor_id);

CREATE TABLE IF NOT EXISTS ai_usage_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id varchar REFERENCES whatsapp_threads(id) ON DELETE SET NULL,
  message_id varchar REFERENCES whatsapp_messages(id) ON DELETE SET NULL,
  model text NOT NULL DEFAULT 'catalog-assistant',
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  phone_number_id text,
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'received',
  payload jsonb NOT NULL,
  failure_message text,
  received_at timestamp NOT NULL DEFAULT now(),
  processed_at timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_webhook_events_event_unique ON whatsapp_webhook_events(event_id);
