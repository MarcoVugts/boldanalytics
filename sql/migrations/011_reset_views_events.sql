-- 1) Reset the visitor counts (owner's request, Nov 2026): start counting from zero.
TRUNCATE page_views RESTART IDENTITY;

-- 2) Richer origin per visit: campaign tags and country (from Vercel's geo header; no IP address is stored).
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS utm_medium text;
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS utm_campaign text;
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS country text;

-- 3) Interactions with charts and downloads (same visit code as page_views, same exclusions).
--    kind: 'download' (image or video), 'toggle' (a chart switch), 'hover' (first hover on a chart per page view),
--          'click' (e.g. a type on the cluster map), 'play' (network animation), 'outbound' (link to another site)
--    target: chart slug or link host; value: which option / format / label.
CREATE TABLE IF NOT EXISTS events (
  id        bigserial PRIMARY KEY,
  at        timestamptz NOT NULL DEFAULT now(),
  path      text NOT NULL,
  visit     text,
  kind      text NOT NULL,
  target    text,
  value     text,
  excluded  text
);
CREATE INDEX IF NOT EXISTS events_at_idx ON events (at);
