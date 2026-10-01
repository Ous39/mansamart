ALTER TABLE order_vendor_fulfillments ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE order_vendor_fulfillments ADD COLUMN IF NOT EXISTS confirmed_at timestamp;
ALTER TABLE order_vendor_fulfillments ADD COLUMN IF NOT EXISTS preparing_at timestamp;
ALTER TABLE order_vendor_fulfillments ADD COLUMN IF NOT EXISTS ready_at timestamp;
ALTER TABLE order_vendor_fulfillments ADD COLUMN IF NOT EXISTS cancelled_at timestamp;

CREATE INDEX IF NOT EXISTS idx_order_vendor_fulfillments_vendor_status_updated
  ON order_vendor_fulfillments (vendor_id, status, updated_at DESC);
