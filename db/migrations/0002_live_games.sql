-- Phase 2: live two-device games (state lives in the Durable Object;
-- this table exists for listings/history).
CREATE TABLE live_games (
  code          TEXT PRIMARY KEY,              -- share code, e.g. "KQ7MXP"
  host_user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guest_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'waiting',  -- waiting | active | done
  created_at    INTEGER NOT NULL
);
CREATE INDEX idx_live_games_host ON live_games(host_user_id, created_at DESC);
