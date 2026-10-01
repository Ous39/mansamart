ALTER TABLE delivery_requests ADD COLUMN IF NOT EXISTS decline_reason text;

CREATE TABLE IF NOT EXISTS rider_safety_incidents (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delivery_id varchar REFERENCES deliveries(id) ON DELETE SET NULL,
  type text NOT NULL,
  severity text NOT NULL DEFAULT 'high',
  description text NOT NULL,
  latitude real,
  longitude real,
  status text NOT NULL DEFAULT 'open',
  created_at timestamp NOT NULL DEFAULT now(),
  resolved_at timestamp
);

CREATE INDEX IF NOT EXISTS idx_rider_safety_incidents_rider_created
  ON rider_safety_incidents (rider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rider_safety_incidents_status
  ON rider_safety_incidents (status, created_at DESC);
