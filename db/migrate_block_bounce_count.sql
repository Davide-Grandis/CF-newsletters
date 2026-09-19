-- Migration: add block_bounce_count column to subscribers.
-- Block bounces are policy/reputation rejections ([45].7.x enhanced codes or
-- blocklist/spam-policy keywords).  They are tracked separately from hard and
-- soft bounces and never cause automatic subscriber suppression.
ALTER TABLE subscribers ADD COLUMN block_bounce_count INTEGER NOT NULL DEFAULT 0;
