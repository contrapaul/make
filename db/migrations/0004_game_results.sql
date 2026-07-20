-- Phase 4: final results recorded on live_games (feeds the games feed).
ALTER TABLE live_games ADD COLUMN home_team_name TEXT;
ALTER TABLE live_games ADD COLUMN away_team_name TEXT;
ALTER TABLE live_games ADD COLUMN home_score INTEGER;
ALTER TABLE live_games ADD COLUMN away_score INTEGER;
ALTER TABLE live_games ADD COLUMN finished_at INTEGER;
