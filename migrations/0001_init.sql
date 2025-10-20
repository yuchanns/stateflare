-- Create table for site statistics
CREATE TABLE IF NOT EXISTS site_stats (
  site_origin TEXT PRIMARY KEY,
  uv INTEGER NOT NULL DEFAULT 0,
  pv INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_site_stats_origin ON site_stats(site_origin);
