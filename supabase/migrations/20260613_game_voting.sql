-- Game Voting feature
-- Reshapes the `votes` table so party members can vote for which game to play.
-- One vote per member per party (changing your vote upserts on this constraint).
--
-- The original `votes` table referenced a UUID games table that the app no
-- longer uses (games live in code as string ids like 'monopoly'). Voting was
-- never wired up, so there is no data to preserve — we recreate it cleanly.

DROP TABLE IF EXISTS public.votes CASCADE;

CREATE TABLE public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,          -- e.g. 'monopoly' (matches the /games/[slug] route)
  game_name TEXT NOT NULL,        -- e.g. 'Monopoly' (denormalised for display)
  user_name TEXT,                 -- voter's display name, denormalised for the voters list
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (party_id, user_id)      -- a member holds exactly one (changeable) vote
);

CREATE INDEX votes_party_id_idx ON public.votes (party_id);

-- Keep updated_at fresh (reuses the helper created in the first migration).
CREATE TRIGGER update_votes_updated_at
  BEFORE UPDATE ON public.votes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read votes (needed to show live party tallies).
CREATE POLICY "Votes are viewable by everyone"
  ON public.votes FOR SELECT
  USING (true);

-- A user may only create / change / remove their own vote.
CREATE POLICY "Users can manage their own vote"
  ON public.votes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Enable realtime so vote tallies update live for every party member.
ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;
