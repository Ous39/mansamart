BEGIN;

-- Bind every session to the application that created it and invalidate legacy
-- plaintext/unscoped sessions. New session values are SHA-256 digests.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS audience text;
DELETE FROM sessions
WHERE audience IS NULL OR token !~ '^[0-9a-f]{64}$';
ALTER TABLE sessions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE sessions ALTER COLUMN token SET NOT NULL;
ALTER TABLE sessions ALTER COLUMN audience SET NOT NULL;
ALTER TABLE sessions ALTER COLUMN expires_at SET NOT NULL;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamp NOT NULL,
  used_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user
  ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expiry
  ON password_reset_tokens(expires_at);

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
CREATE INDEX IF NOT EXISTS idx_admin_mfa_challenges_user
  ON admin_mfa_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_mfa_challenges_expiry
  ON admin_mfa_challenges(expires_at);

CREATE TABLE IF NOT EXISTS review_helpful_votes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id varchar NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_helpful_votes_review_user
  ON review_helpful_votes(review_id, user_id);

-- Older deployments could create one profile-completion row per request.
-- Keep only the newest row before enforcing one row per user.
DELETE FROM profile_completion_checks older
USING profile_completion_checks newer
WHERE older.user_id = newer.user_id
  AND (older.updated_at, older.id) < (newer.updated_at, newer.id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_completion_checks_user_unique
  ON profile_completion_checks(user_id);

-- Only one live Wave checkout may exist for an order. Older competing attempts
-- are closed before adding the database-level race-condition guard.
WITH ranked_active_attempts AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY order_id, provider
           ORDER BY created_at DESC, id DESC
         ) AS position
  FROM payment_attempts
  WHERE provider = 'wave' AND status IN ('pending', 'processing')
)
UPDATE payment_attempts
SET status = 'failed',
    failure_code = 'superseded-checkout',
    failure_message = 'Closed while enforcing one active checkout per order',
    updated_at = now()
WHERE id IN (
  SELECT id FROM ranked_active_attempts WHERE position > 1
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_attempts_active_wave_order
  ON payment_attempts(order_id, provider)
  WHERE provider = 'wave' AND status IN ('pending', 'processing');

-- MansaMart currently supports one full provider refund per payment attempt.
DROP INDEX IF EXISTS idx_payment_refunds_attempt;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_refunds_attempt_unique
  ON payment_refunds(payment_attempt_id);

COMMIT;
