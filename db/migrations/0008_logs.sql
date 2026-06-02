-- Application / pipeline activity log (ingest -> queue -> consumer), surfaced
-- on the admin console's Logs page merged with engagement events.
CREATE TABLE IF NOT EXISTS logs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ts             TEXT NOT NULL DEFAULT (datetime('now')),
  level          TEXT NOT NULL DEFAULT 'info'
                   CHECK (level IN ('debug','info','warn','error')),
  source         TEXT NOT NULL,
  event          TEXT NOT NULL,
  campaign_id    TEXT,
  newsletter_id  TEXT,
  message        TEXT,
  detail         TEXT
);
CREATE INDEX IF NOT EXISTS idx_logs_ts ON logs(ts);
CREATE INDEX IF NOT EXISTS idx_logs_campaign ON logs(campaign_id);
