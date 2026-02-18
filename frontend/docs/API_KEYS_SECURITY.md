# API Keys & Secrets — Never Leak to Frontend

## Rule

- **Secrets** (Stripe secret key, Supabase service role key, etc.) must **never** be in client-side code or in any `NEXT_PUBLIC_*` env var. They must only be used in API routes, server components, or external dashboards.
- **Public keys** (Stripe **publishable** key, Supabase **anon** key) are designed to be in the browser; they are safe in `NEXT_PUBLIC_*` and in frontend code.

## Where each key lives

| Key | Where it lives | In frontend? |
|-----|----------------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` | Yes (safe) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` | Yes (safe; RLS protects data) |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` only | **No** — API routes / server only |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `.env.local` | Yes (safe) |
| `STRIPE_SECRET_KEY` | `.env.local` only | **No** — API routes / server only |
| `STRIPE_AGENT_PRO_PRICE_ID` | `.env.local` only | **No** — API routes / server only |
| `STRIPE_WEBHOOK_SECRET` | `.env.local` only | **No** — API routes / server only |
| `GOOGLE_PLACES_API_KEY` | Server / API only | **No** — only in API routes that call Google |

## Checklist

- [ ] `.env` and `.env.local` are in `.gitignore` (they are; do not remove).
- [ ] No secret key is prefixed with `NEXT_PUBLIC_`.
- [ ] No API key or secret is hardcoded in source code.
- [ ] If a secret was ever pasted in chat, committed, or shared, **rotate it immediately** (new key in Stripe/Supabase, then update Dashboard or .env).

## Next.js behavior

Next.js exposes **only** `process.env.NEXT_PUBLIC_*` to the browser. Any other env var is available only in Node (API routes, server components, build). So:

- Use `NEXT_PUBLIC_*` only for keys that are meant to be public.
- Keep all secrets in non-`NEXT_PUBLIC_` vars and use them only in server-side code.
