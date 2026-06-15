-- Per-player game statistics that power the dashboard leaderboard.
--
-- One row per player, updated atomically through the record_game_result RPC
-- each time a game ends. user_id references profiles(id) so PostgREST can embed
-- the player's profile when the leaderboard is queried.

CREATE TABLE IF NOT EXISTS game_stats (
  user_id       UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  wins          INTEGER NOT NULL DEFAULT 0,
  games_played  INTEGER NOT NULL DEFAULT 0,
  favorite_game TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE game_stats ENABLE ROW LEVEL SECURITY;

-- The leaderboard is public — anyone can read everyone's stats.
DROP POLICY IF EXISTS "Game stats are viewable by everyone" ON game_stats;
CREATE POLICY "Game stats are viewable by everyone"
  ON game_stats FOR SELECT
  USING (true);

-- Writes only ever happen through record_game_result (SECURITY DEFINER), so no
-- direct INSERT/UPDATE policy is granted to clients.

-- Atomically record the outcome of a finished game for the calling user.
-- favorite_game is set to the most recently played game (a simple, honest
-- "last played" signal — the dashboard labels it accordingly).
CREATE OR REPLACE FUNCTION record_game_result(p_won BOOLEAN, p_game TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO game_stats (user_id, wins, games_played, favorite_game, updated_at)
  VALUES (
    auth.uid(),
    CASE WHEN p_won THEN 1 ELSE 0 END,
    1,
    p_game,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    wins          = game_stats.wins + CASE WHEN p_won THEN 1 ELSE 0 END,
    games_played  = game_stats.games_played + 1,
    favorite_game = p_game,
    updated_at    = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
