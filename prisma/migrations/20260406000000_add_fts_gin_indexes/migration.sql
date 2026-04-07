-- Full-text search GIN indexes for Article, Team, Match
-- Uses 'simple' dictionary: no stemming, works for Vietnamese text

-- Article: search on title + excerpt
CREATE INDEX IF NOT EXISTS articles_fts_gin_idx
  ON articles
  USING GIN (to_tsvector('simple', title || ' ' || COALESCE(excerpt, '')));

-- Team: search on name
CREATE INDEX IF NOT EXISTS teams_fts_gin_idx
  ON teams
  USING GIN (to_tsvector('simple', name));

-- Match: search on slug (contains team TLAs and date)
CREATE INDEX IF NOT EXISTS matches_fts_gin_idx
  ON matches
  USING GIN (to_tsvector('simple', slug));
