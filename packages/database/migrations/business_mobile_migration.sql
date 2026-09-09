CREATE TABLE IF NOT EXISTS order_vendor_fulfillments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id varchar NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  vendor_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subtotal integer NOT NULL CHECK (subtotal >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready_for_pickup', 'cancelled')),
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (order_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_order_vendor_fulfillments_vendor_created
  ON order_vendor_fulfillments(vendor_id, created_at DESC);

ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS payout_method text;
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS payout_method text;
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS account_name text;
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS account_number text;
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS mobile_money_provider text;
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS mobile_money_number text;

INSERT INTO order_vendor_fulfillments (order_id, vendor_id, subtotal, status)
SELECT
  o.id,
  COALESCE(item->>'vendorId', p.vendor_id),
  SUM(((item->>'price')::numeric * (item->>'quantity')::numeric))::integer,
  CASE
    WHEN o.status::text IN ('confirmed', 'processing', 'preparing') THEN 'preparing'
    WHEN o.status::text IN ('ready_for_pickup', 'searching_rider', 'rider_searching', 'rider_assigned', 'rider_arrived_vendor', 'picked_up', 'on_the_way', 'shipped', 'delivered', 'completed') THEN 'ready_for_pickup'
    WHEN o.status::text = 'cancelled' THEN 'cancelled'
    ELSE 'pending'
  END
FROM orders o
CROSS JOIN LATERAL jsonb_array_elements(o.items) item
LEFT JOIN products p ON p.id = item->>'productId'
WHERE COALESCE(item->>'vendorId', p.vendor_id) IS NOT NULL
GROUP BY o.id, COALESCE(item->>'vendorId', p.vendor_id), o.status
ON CONFLICT (order_id, vendor_id) DO NOTHING;
