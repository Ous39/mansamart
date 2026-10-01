CREATE TABLE IF NOT EXISTS return_requests (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id varchar NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  request_type text NOT NULL DEFAULT 'return' CHECK (request_type IN ('return', 'refund')),
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewing', 'approved', 'rejected', 'completed', 'cancelled')),
  resolution text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_return_requests_user_created
  ON return_requests(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_return_requests_order
  ON return_requests(order_id);

CREATE INDEX IF NOT EXISTS idx_return_requests_status
  ON return_requests(status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_return_requests_one_active_per_order
  ON return_requests(user_id, order_id)
  WHERE status IN ('submitted', 'reviewing', 'approved');

DELETE FROM reviews newer
USING reviews older
WHERE newer.user_id IS NOT NULL
  AND newer.user_id = older.user_id
  AND newer.target_type = older.target_type
  AND newer.target_id = older.target_id
  AND (newer.created_at, newer.id) > (older.created_at, older.id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_user_target
  ON reviews(user_id, target_type, target_id);

ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS selected_size text;
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS selected_variant text;
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS selected_options jsonb DEFAULT '{}'::jsonb;
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS option_key text NOT NULL DEFAULT '{}';

UPDATE cart_items
SET selected_options = jsonb_build_object('color', selected_color),
    option_key = replace(jsonb_build_object('color', selected_color)::text, ': ', ':')
WHERE selected_color IS NOT NULL
  AND btrim(selected_color) <> ''
  AND option_key = '{}';

WITH grouped AS (
  SELECT min(id) AS keeper_id, user_id, product_id, option_key, least(99, sum(quantity))::integer AS total_quantity
  FROM cart_items
  GROUP BY user_id, product_id, option_key
)
UPDATE cart_items AS item
SET quantity = grouped.total_quantity
FROM grouped
WHERE item.id = grouped.keeper_id;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY user_id, product_id, option_key ORDER BY created_at, id) AS row_number
  FROM cart_items
)
DELETE FROM cart_items
USING ranked
WHERE cart_items.id = ranked.id
  AND ranked.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_user_product_options
  ON cart_items(user_id, product_id, option_key);
