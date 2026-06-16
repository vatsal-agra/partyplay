-- Anonymous beta feedback. Anyone can submit (no auth, no name); nobody can read
-- it back from the client. You receive each entry by email (via the API route)
-- and they're also stored here as a durable backup you can read in the
-- Supabase dashboard.

CREATE TABLE IF NOT EXISTS feedback (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message    TEXT NOT NULL,
  user_agent TEXT,
  path       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous visitors) may submit feedback…
DROP POLICY IF EXISTS "Anyone can submit feedback" ON feedback;
CREATE POLICY "Anyone can submit feedback"
  ON feedback FOR INSERT
  WITH CHECK (true);

-- …but there is no SELECT policy, so the public can never read others' feedback.
