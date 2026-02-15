# Deployment structure (backend vs frontend)

## Split

| Location | Purpose | Deploy to |
|----------|---------|-----------|
| **Root** (`/`) | Backend: Express, sync scripts, Supabase workers. `package.json` has `express`, no `next`. | Not used for Vercel. Run on your server or elsewhere. |
| **frontend/** | Next.js app: all UI, pages, components. `package.json` has `next`, `react`. Contains `vercel.json`, `next.config.mjs`. | **Vercel** (this is the only part Vercel should build). |

Anything related to **deployment** (Vercel) and **UI/UX** (pages, components, styles) lives in **frontend/**.

## Where `package.json` with Next.js is

- **Path:** `frontend/package.json`
- **Contains:** `"next"`, `"react"`, `"react-dom"` in dependencies.

## Vercel Root Directory (GitHub repo: Lumina-Realty)

On GitHub the repo has **VestaHome_Backend** at the top level, and **frontend** is inside it. So:

- **Root Directory in Vercel must be:** `VestaHome_Backend/frontend`

That way Vercel builds from the folder that contains `package.json` with `next` and finds the Next.js app.

## Quick check

- Backend only: root `package.json` → no `next`, has `express`.
- Frontend (UI + Vercel): `frontend/package.json` → has `next`; `frontend/vercel.json`, `frontend/next.config.mjs` exist.
