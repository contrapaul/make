-- Phase 5: soundboard — uploaded sounds (R2-backed) + persisted boards.
-- Sounds outlive any single board: they belong to the user's library and are
-- referenced (by id) from board JSON. Deleting a board never deletes sounds.
CREATE TABLE sounds (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  mime         TEXT,
  size_bytes   INTEGER NOT NULL,
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER
);
CREATE INDEX idx_sounds_user ON sounds(user_id);

CREATE TABLE soundboards (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  is_public  INTEGER NOT NULL DEFAULT 0,
  data       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_soundboards_owner  ON soundboards(user_id, updated_at DESC);
CREATE INDEX idx_soundboards_public ON soundboards(is_public, updated_at DESC);
