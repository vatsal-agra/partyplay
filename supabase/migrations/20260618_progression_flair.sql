-- Progression (XP + levels + daily streak) and profile flair (avatar emoji,
-- colour, equipped badge).
--
-- XP and streak live alongside the existing per-player stats; record_game_result
-- is extended to award them atomically when a game is recorded. Flair lives on
-- profiles so it shows wherever a player appears (leaderboard, presence, etc.).

ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS last_played_date DATE;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_emoji TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_color TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS equipped_badge TEXT;

-- Players set their own flair.
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Award win/play + XP + streak in one shot. XP: 30 per game, +70 for a win.
-- Streak: +1 if the last game was yesterday, reset to 1 if there was a gap,
-- unchanged if you already played today.
CREATE OR REPLACE FUNCTION record_game_result(p_won BOOLEAN, p_game TEXT)
RETURNS VOID AS $$
DECLARE
  gain INTEGER := 30 + CASE WHEN p_won THEN 70 ELSE 0 END;
BEGIN
  INSERT INTO game_stats (user_id, wins, games_played, favorite_game, xp, streak, last_played_date, updated_at)
  VALUES (
    auth.uid(),
    CASE WHEN p_won THEN 1 ELSE 0 END,
    1, p_game, gain, 1, CURRENT_DATE, NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    wins             = game_stats.wins + CASE WHEN p_won THEN 1 ELSE 0 END,
    games_played     = game_stats.games_played + 1,
    favorite_game    = p_game,
    xp               = game_stats.xp + gain,
    streak           = CASE
                         WHEN game_stats.last_played_date = CURRENT_DATE     THEN game_stats.streak
                         WHEN game_stats.last_played_date = CURRENT_DATE - 1  THEN game_stats.streak + 1
                         ELSE 1
                       END,
    last_played_date = CURRENT_DATE,
    updated_at       = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
