-- Enforce case-insensitive uniqueness of newsletter names. Backstops the
-- explicit check in the admin API against races.
CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletters_name ON newsletters(name COLLATE NOCASE);
