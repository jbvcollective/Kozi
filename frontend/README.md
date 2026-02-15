# LUMINA Frontend (Next.js)

- **Dev:** `npm run dev` — runs on **http://localhost:3001** (so the Express API can use 3000).
- **API:** Set `NEXT_PUBLIC_API_URL=http://localhost:3000` in `.env.local` (see `.env.local.example`).

From the repo root, run the backend then the frontend:

```bash
# Terminal 1: Express API
npm run serve

# Terminal 2: Next.js frontend
cd frontend && npm run dev
```

Then open http://localhost:3001.
