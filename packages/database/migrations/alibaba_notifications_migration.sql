ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'system';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dedupe_key text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_id varchar;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at timestamp;
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe_key ON notifications(dedupe_key) WHERE dedupe_key IS NOT NULL;

ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS push_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS email_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS whatsapp_phone text;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS whatsapp_opt_in_at timestamp;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS quiet_hours_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS quiet_hours_start text NOT NULL DEFAULT '22:00';
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS quiet_hours_end text NOT NULL DEFAULT '07:00';
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Africa/Banjul';
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS unread_escalation_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id varchar NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  provider_message_id text,
  template_name text,
  attempts integer NOT NULL DEFAULT 0,
  scheduled_at timestamp NOT NULL DEFAULT now(),
  sent_at timestamp,
  delivered_at timestamp,
  read_at timestamp,
  last_error text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_delivery_channel ON notification_deliveries(notification_id, channel);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_due ON notification_deliveries(status, scheduled_at);

ALTER TABLE whatsapp_threads ADD COLUMN IF NOT EXISTS first_unread_at timestamp;
ALTER TABLE whatsapp_threads ADD COLUMN IF NOT EXISTS first_response_at timestamp;
ALTER TABLE whatsapp_threads ADD COLUMN IF NOT EXISTS escalation_sent_at timestamp;
