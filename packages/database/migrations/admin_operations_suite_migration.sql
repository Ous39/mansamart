ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS assigned_admin_id varchar REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS first_response_at timestamp;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS resolved_at timestamp;

CREATE TABLE IF NOT EXISTS support_ticket_notes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id varchar NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id varchar REFERENCES users(id) ON DELETE SET NULL, body text NOT NULL,
  visibility text NOT NULL DEFAULT 'internal', created_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS dispute_cases (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), case_number text NOT NULL UNIQUE,
  opened_by varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE, order_id varchar REFERENCES orders(id) ON DELETE SET NULL,
  booking_id varchar REFERENCES bookings(id) ON DELETE SET NULL, category text NOT NULL, priority text NOT NULL DEFAULT 'normal',
  title text NOT NULL, description text NOT NULL, evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'open', assigned_admin_id varchar REFERENCES users(id) ON DELETE SET NULL,
  resolution text, resolution_type text, due_at timestamp, resolved_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dispute_cases_status_due ON dispute_cases(status, due_at);
CREATE TABLE IF NOT EXISTS dispute_messages (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), dispute_id varchar NOT NULL REFERENCES dispute_cases(id) ON DELETE CASCADE,
  author_id varchar REFERENCES users(id) ON DELETE SET NULL, body text NOT NULL, internal boolean NOT NULL DEFAULT false,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb, created_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS verification_document_reviews (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_type text NOT NULL, document_name text NOT NULL, document_type text NOT NULL, document_url text NOT NULL,
  status text NOT NULL DEFAULT 'submitted', note text, reviewed_by varchar REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamp, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_verification_document_unique ON verification_document_reviews(user_id, profile_type, document_name);
