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

CREATE INDEX IF NOT EXISTS idx_payment_attempts_order_created
  ON payment_attempts(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_user_created
  ON payment_attempts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_status
  ON payment_attempts(status);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_session
  ON payment_webhook_events(provider_session_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_attempt
  ON payment_refunds(payment_attempt_id, created_at DESC);
