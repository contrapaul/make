-- Phase 3: tournaments — organizer-paired rounds, standings, photo wall.
CREATE TABLE tournaments (
  id          TEXT PRIMARY KEY,               -- uuid
  owner_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'open',   -- open | active | done
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_tournaments_status ON tournaments(status, created_at DESC);

CREATE TABLE tournament_entries (
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id       TEXT,                          -- cloud team id (may be deleted later)
  team_name     TEXT NOT NULL,                 -- denormalized for display
  base_team_id  TEXT NOT NULL DEFAULT '',
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (tournament_id, user_id)
);

CREATE TABLE tournament_matches (
  id            TEXT PRIMARY KEY,              -- uuid
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round         INTEGER NOT NULL,
  home_user_id  TEXT NOT NULL,
  away_user_id  TEXT,                          -- NULL = bye (counts as a home win)
  home_score    INTEGER,                       -- NULL until reported
  away_score    INTEGER,
  created_at    INTEGER NOT NULL
);
CREATE INDEX idx_tmatches ON tournament_matches(tournament_id, round);

CREATE TABLE tournament_posts (
  id            TEXT PRIMARY KEY,              -- uuid
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  photo_id      TEXT NOT NULL,                 -- photos table / R2 object
  caption       TEXT NOT NULL DEFAULT '',
  created_at    INTEGER NOT NULL
);
CREATE INDEX idx_tposts ON tournament_posts(tournament_id, created_at DESC);
