-- Page views for /beheer (same basis as Runtools): no cookies, no IP addresses.
--   visit     random id per browser tab (sessionStorage)            -> visits
--   visit_no  how many visits this browser made (localStorage count) -> new vs returning
--   visit_gap days since the previous visit in this browser (null = first) -> unique visitors per day/period
-- excluded: 'self' (own device, set via /beheer), 'bot' (user agent), 'auto' (webdriver); counted apart.
CREATE TABLE IF NOT EXISTS page_views (
  id         bigserial PRIMARY KEY,
  at         timestamptz NOT NULL DEFAULT now(),
  path       text NOT NULL,
  visit      text,
  entry      boolean NOT NULL DEFAULT false,
  visit_no   integer,
  visit_gap  integer,
  ref        text,
  utm        text,
  device     text,
  excluded   text,
  detail     text
);
CREATE INDEX IF NOT EXISTS page_views_at_idx ON page_views (at);
CREATE INDEX IF NOT EXISTS page_views_counted_idx ON page_views (at) WHERE excluded IS NULL;
