BEGIN;

ALTER TABLE addresses ADD COLUMN IF NOT EXISTS latitude real;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS longitude real;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS location_accuracy real;

CREATE INDEX IF NOT EXISTS idx_rider_locations_delivery_created
  ON rider_locations(delivery_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deliveries_order_created
  ON deliveries(order_id, created_at DESC);

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_deliveries_one_active_order
  ON deliveries(order_id)
  WHERE status NOT IN ('failed', 'cancelled', 'delivered');

COMMIT;
