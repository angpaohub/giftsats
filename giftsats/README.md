# GiftSats ⚡

Send Bitcoin as beautiful gift cards — powered by Lightning & Cashu.

## Stack

- **Frontend**: React + Vite → Netlify
- **Backend**: Node.js (Express) → Railway
- **Payments**: LND (Voltage.cloud) + Cashu mint (Nutshell)

## Project Structure

```
giftsats/
├── backend/          # Express API + LND + Cashu
│   ├── src/
│   │   ├── index.js  # Main server + routes
│   │   ├── lnd.js    # Lightning node helpers
│   │   ├── mint.js   # Cashu mint helpers
│   │   └── store.js  # In-memory store (swap for DB later)
│   └── .env.example
└── frontend/         # React app
    └── src/
        ├── App.jsx
        └── pages/
            ├── CreateGift.jsx
            ├── Explore.jsx
            └── Wallet.jsx
```

## Setup

### Backend

```bash
cd backend
cp .env.example .env
# Fill in your Voltage credentials in .env
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
LND_REST_URL=https://pulse.t.voltageapp.io:8080
LND_MACAROON_HEX=your_admin_macaroon_here
MINT_URL=http://localhost:3338
PORT=3001
FRONTEND_URL=http://localhost:5173
```

### Environment Variables (Frontend)

```
VITE_API_URL=https://your-railway-app.railway.app
```

## Deploy

- **Backend** → Railway (connect GitHub repo, set env vars)
- **Frontend** → Netlify (connect GitHub repo, set `VITE_API_URL`)

## Switching to Mainnet

1. Create new Voltage node on **Mainnet**
2. Update `LND_REST_URL` and `LND_MACAROON_HEX` in Railway env vars
3. Remove `TESTNET` badge from `App.jsx`
4. Done — no code changes needed
