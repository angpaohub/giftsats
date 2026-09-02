# GiftSats

Send Bitcoin as beautiful gift cards — powered by Lightning.

## Stack

- **Frontend**: React + Vite + React Router → Netlify
- **Backend**: Node.js (Express) + Postgres → Railway
- **Payments**: LND (Voltage.cloud)
- **Artwork storage**: Cloudflare R2

## Project Structure

```
giftsats/
├── backend/
│   ├── src/
│   │   ├── index.js  # Express routes + LND + R2
│   │   ├── lnd.js    # Lightning node helpers
│   │   ├── mint.js   # Cashu helpers (unused by the current flow)
│   │   └── store.js  # Postgres schema + queries
│   └── test/
│       └── migration.test.mjs
└── frontend/
    └── src/
        ├── App.jsx            # routes
        ├── components/        # Header, Footer, GiftCard, QR, ui tokens
        ├── lib/               # api client, formatting, built-in card fronts
        └── pages/             # one file per screen
```

## Screens

| Route | Screen |
|---|---|
| `/` | Landing |
| `/create` | Create a gift |
| `/pay/:id` | Pay the Lightning invoice |
| `/ready/:id` | Card is live — share, download PNG, print |
| `/card/:id`, `/g/:id` | Receiver's view of the share link |
| `/redeem` | Redeem by camera scan, uploaded image, or code |
| `/explore` | Community card fronts |
| `/submit` | Designer submission |
| `/how-it-works`, `/about`, `/terms`, `/privacy` | Marketing and legal |
| `/admin` | Operations dashboard (unchanged, still dark-themed) |

`/terms` and `/privacy` ship with **placeholder copy** — the layout is final, the
wording is not. Replace the `SECTIONS` arrays in `pages/Terms.jsx` and
`pages/Privacy.jsx` and remove the `disclaimer` prop before launch.

## Card fronts

Built-in fronts (Obsidian, Sand, Orange) are CSS art defined in
`frontend/src/lib/designs.js` and carry the `giftsats-*` design ids — they are
not catalogue rows. Community fronts are uploaded images stored in R2.

A design row may carry a `palette` — the five text colours (`muted`, `mark`,
`amount`, `unit`, `body`) used over the artwork. Submissions do not collect one
yet, so an uploaded front falls back to a dark scrim with light type. Fill
`designs.palette` by hand for a front that needs dark text over pale artwork.

## The redeem code

The code printed on the back of a card **is the card id**. The backend also
accepts the first 12 hex characters of it — grouped as `XXXX-XXXX-XXXX` — at
`GET /api/gift/code/:code`, so a receiver can type a short code instead of the
full UUID. Anyone holding the code can redeem the card; treat it like cash.

## Share links and OG previews

`/card/:id` is proxied to the backend by `frontend/public/_redirects` so link
previews get OG tags. The backend serves those tags and then bounces real
browsers to `/g/:id`, which the SPA renders directly. Both routes show the same
screen; the split is what stops the proxy from looping.

## Setup

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Environment Variables (Backend)

```
DATABASE_URL=postgresql://...
LND_REST_URL=https://pulse.t.voltageapp.io:8080
LND_MACAROON_HEX=your_admin_macaroon_here
PLATFORM_WALLET=you@getalby.com
R2_ENDPOINT=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=giftsats-designs
R2_PUBLIC_URL=...
ADMIN_KEY=...
ADMIN_PAY_KEY=...
PORT=3001
FRONTEND_URL=https://giftsats.org
```

`FRONTEND_URL` may hold a comma-separated CORS allowlist; the first entry is
treated as the canonical site.

### Environment Variables (Frontend)

```
VITE_API_URL=https://your-railway-app.railway.app
```

## Schema changes

`initDB()` runs on every boot and is idempotent: new columns are added with
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, so deploying is the migration. To
check that against a scratch database:

```bash
createdb gs_test
DATABASE_URL=postgresql://localhost/gs_test npm run test:migration
```

It builds the pre-upgrade schema, applies `initDB()` on top, and asserts that
old cards still read, that the designer email never leaves a public endpoint,
and that code lookup resolves.

## Deploy

- **Backend** → Railway (connect GitHub repo, set env vars)
- **Frontend** → Netlify (connect GitHub repo, set `VITE_API_URL`)

## Switching to Mainnet

1. Create a new Voltage node on **Mainnet**
2. Update `LND_REST_URL` and `LND_MACAROON_HEX` in Railway env vars
3. Done — no code changes needed
