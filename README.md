# VestaHome Backend & LUMINA Frontend

- **Backend:** **Node.js** (Express) — API server, Supabase client, fetch/analytics scripts.
- **Frontend:** **Next.js** (React) — LUMINA UI in the `frontend/` directory.

## Backend (Node.js)

- **Runtime:** Node.js (see `engines` in `package.json`).
- **Stack:** Express, Supabase JS, dotenv.
- **Entry:** `server.js` — serves API routes and (optionally) static `public/` for the legacy HTML app.
- **Run:** From repo root:
  ```bash
  npm run serve
  ```
  API: http://localhost:3000  
  - `GET /api/listings` — all listings  
  - `GET /api/listings/:id` — one listing  
  - `GET /api/analytics` — market heat analytics  

- **Scripts:** `fetch-listings`, `fetch-unified`, `analytics`, etc. (all run with `node`).

## Frontend (Next.js)

- **Framework:** Next.js (App Router), React.
- **Location:** `frontend/` — separate package with its own `package.json` and `node_modules`.
- **Run:** From repo root:
  ```bash
  cd frontend && npm run dev
  ```
  App: http://localhost:3001 (port 3001 so the Node backend can use 3000).

- **Config:** In `frontend/.env.local` set `NEXT_PUBLIC_API_URL=http://localhost:3000` so the Next.js app calls the Node.js backend.

## Quick start

```bash
# Terminal 1 — Node.js backend
npm run serve

# Terminal 2 — Next.js frontend
cd frontend && npm run dev
```

Then open http://localhost:3001 for the LUMINA (Next.js) app.
