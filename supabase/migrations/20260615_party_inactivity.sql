-- Party inactivity tracking
-- Adds a `last_active_at` timestamp to parties so idle parties can be auto-
-- closed (~1 hour of no activity). The client bumps this on meaningful actions
-- (voting, chatting, launching a game) and lazily deletes stale parties.
--
-- Also ensures `parties` and `party_members` are in the realtime publication so
-- the games/party screens react live to launches, leaves, and party deletion.

ALTER TABLE public.parties
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_parties_last_active ON public.parties (last_active_at);

-- Add tables to the realtime publication if they aren't already members.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'parties'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.parties;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'party_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.party_members;
  END IF;
END $$;
