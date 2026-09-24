# Layered Insights GIS — Client Portal

Cloudflare Pages + Pages Functions (TypeScript) + D1. Static frontend in
`public/`, backend API in `functions/api/`. No separate server to run or
pay for -- Cloudflare hosts both from the same GitHub repo.

## How it enforces per-client access

- `POST /api/login` checks the submitted username/password against the
  `clients` table in D1, then sets a signed, HttpOnly session cookie
  containing that login's `ClientID`.
- `GET /api/properties` reads `ClientID` **only** from that verified
  cookie -- never from anything the browser sends directly -- and uses
  it to build the `where` clause on the ArcGIS query, server-side.
- The ArcGIS API key lives only in Cloudflare's secret store. It is
  never sent to the browser, so it can't be pulled out of dev tools the
  way a client-side API key or a public feature layer could be.

## One-time setup

1. **Install the tools** (needs Node.js):
   ```
   npm install
   ```

2. **Create the D1 database**:
   ```
   npx wrangler d1 create layered_insights_portal
   ```
   Copy the `database_id` it prints into `wrangler.toml`.

3. **Apply the schema**:
   ```
   npx wrangler d1 execute layered_insights_portal --remote --file=schema.sql
   ```

4. **Publish the Units feature layer to ArcGIS Online** from Pro (Share
   As Web Layer), shared at Owner/Org level -- not public. Copy its
   REST URL for the Units layer, e.g.:
   ```
   https://services.arcgis.com/XXXX/ArcGIS/rest/services/PropertyPortal/FeatureServer/2
   ```

5. **Generate an ArcGIS API key** (ArcGIS Online → Content → your item,
   or via the Developer dashboard) with read access to that layer.

6. **Connect the repo to Cloudflare Pages**:
   - Push this project to a GitHub repo.
   - Cloudflare dashboard → Workers & Pages → Create → Pages → Connect
     to Git → select the repo.
   - Build settings: framework preset "None", build command empty,
     build output directory `public`.
   - After the first deploy, go to the project's **Settings → Functions
     → D1 database bindings** and bind `DB` to
     `layered_insights_portal`.
   - Go to **Settings → Environment variables** and add, as **encrypted**
     secrets, for both Production and Preview:
     - `SESSION_SECRET` — any long random string (e.g. `openssl rand -hex 32`)
     - `ARCGIS_API_KEY` — the API key from step 5
     - `ARCGIS_LAYER_URL` — the REST URL from step 4

7. **Add your first client login.** Generate a password hash:
   ```
   node scripts/hash-password.mjs "their-temporary-password"
   ```
   Then insert the row (use the client's real `ClientID` GUID from the
   Clients table):
   ```
   npx wrangler d1 execute layered_insights_portal --remote --command \
     "INSERT INTO clients (id, password_hash, salt, client_id, client_name) VALUES ('blueridge', '<hash>', '<salt>', '{THEIR-CLIENTID-GUID}', 'Blue Ridge Retail Partners')"
   ```

8. Push to `main`. Cloudflare builds and deploys automatically. Visit
   the Pages URL, sign in with the login from step 7, and confirm the
   portfolio loads from the real ArcGIS layer.

## Local development

```
npx wrangler pages dev public --d1=DB
```
This runs the functions and a local D1 copy on your machine. You'll
still need `ARCGIS_API_KEY`, `ARCGIS_LAYER_URL`, and `SESSION_SECRET`
available locally -- put them in a `.dev.vars` file (already
git-ignored) in this format:
```
SESSION_SECRET=some-long-random-string
ARCGIS_API_KEY=your-key
ARCGIS_LAYER_URL=https://services.arcgis.com/XXXX/ArcGIS/rest/services/PropertyPortal/FeatureServer/2
```

## What's intentionally not built yet

- **Maintenance log / MEP contacts / evacuation routes per unit** --
  the portfolio view only queries Units right now. Each of those would
  be its own small endpoint (`/api/maintenance?unitId=...`, etc.)
  following the exact same pattern: read `ClientID` from the session,
  query the related layer/table filtered by that unit's ownership,
  never trust a client-supplied filter.
- **The "shared site plan with other tenants greyed out" view** from
  the earlier mockup -- that needs a second, narrower endpoint that
  returns just unit *numbers* (no attributes) for every unit sharing a
  Structure with the client's own units, so the layout is visible
  without leaking other tenants' data.
- **Password reset / account management** -- logins are currently
  created by hand via the script above. Fine for a handful of early
  clients; worth automating once there are more than a few.
