-- schema.sql
--
-- The portal's own small login table -- entirely separate from the GIS
-- data. One row per client login, mapping a username/password to the
-- ClientID GUID from the Clients table in PropertyPortalDemo.gdb.
--
-- Apply with:
--   wrangler d1 execute layered_insights_portal --file=schema.sql --remote

CREATE TABLE IF NOT EXISTS clients (
  id            TEXT PRIMARY KEY,   -- login username, e.g. "blueridge"
  password_hash TEXT NOT NULL,      -- hex PBKDF2 hash -- see scripts/hash-password.mjs
  salt          TEXT NOT NULL,      -- hex salt used for that hash
  client_id     TEXT NOT NULL,      -- the GIS ClientID GUID, e.g. {XXXXXXXX-XXXX-...}
  client_name   TEXT NOT NULL       -- display name shown in the portal header
);
