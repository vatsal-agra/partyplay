-- Reconnect/rejoin + achievements support.
--
-- 1) parties.game_state: the host persists the latest game state here (debounced)
--    so a player who refreshes or drops can restore the game even if the host
--    isn't around to re-broadcast.
-- 2) user_achievements: shareable badges earned per player, awarded atomically
--    through award_achievement (returns whether the badge was newly earned).

ALTER TABLE parties ADD COLUMN IF NOT EXISTS game_state JSONB;

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  earned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, achievement_id)
);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Achievements are viewable by everyone" ON user_achievements;
CREATE POLICY "Achievements are viewable by everyone"
  ON user_achievements FOR SELECT
  USING (true);

-- Awards a badge to the calling user. Returns TRUE only if it was newly earned
-- (so the client celebrates once), FALSE if they already had it.
CREATE OR REPLACE FUNCTION award_achievement(p_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  n INTEGER;
BEGIN
  INSERT INTO user_achievements (user_id, achievement_id)
  VALUES (auth.uid(), p_id)
  ON CONFLICT (user_id, achievement_id) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
