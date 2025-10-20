-- Create table for site statistics
CREATE TABLE IF NOT EXISTS site_stats (
  site_origin TEXT PRIMARY KEY,
  uv INTEGER NOT NULL DEFAULT 0,
  pv INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Create table for visitor tracking
CREATE TABLE IF NOT EXISTS visitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_origin TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  first_visit INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  last_visit INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  visit_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE(site_origin, visitor_hash)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_visitors_site_hash ON visitors(site_origin, visitor_hash);
CREATE INDEX IF NOT EXISTS idx_site_stats_origin ON site_stats(site_origin);
