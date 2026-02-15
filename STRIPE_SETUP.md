# Stripe subscriptions (Agent Pro)

Agent Pro uses Stripe Checkout for recurring subscriptions. Configure as follows.

## 1. Stripe Dashboard

1. **Create a Product and Price**  
   In [Stripe Dashboard → Products](https://dashboard.stripe.com/products):  
   - Add product (e.g. "Agent Pro").  
   - Add a **recurring** price (e.g. monthly in CAD).  
   - Copy the **Price ID** (starts with `price_`).

2. **Webhook**  
   In [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks):  
   - Add endpoint: `https://your-backend-domain.com/api/webhook`  
   - Events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`  
   - Copy the **Signing secret** (starts with `whsec_`).

3. **Customer portal** (optional)  
   In [Stripe Dashboard → Billing → Customer portal](https://dashboard.stripe.com/settings/billing/portal):  
   - Configure cancellation, payment method update, etc.

## 2. Backend env (`.env` in project root)

Stripe **secret key** is already in `.env`. You still need:

- **STRIPE_AGENT_PRO_PRICE_ID** — Create a Product (e.g. "Agent Pro") and a **recurring** Price in [Stripe Dashboard → Products](https://dashboard.stripe.com/products). Copy the Price ID (starts with `price_`) and add to `.env`:
  ```env
  STRIPE_AGENT_PRO_PRICE_ID=price_xxxxxxxxxxxxx
  ```
- **STRIPE_WEBHOOK_SECRET** (optional for local dev) — From Stripe Dashboard → Webhooks.
- **FRONTEND_URL** (optional) — Defaults to `http://localhost:3001`; set if your frontend runs elsewhere.

The **publishable key** (`pk_test_...`) is in `frontend/.env.local` as `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` for any client-side Stripe usage. Never put the secret key in the frontend.

## 3. Frontend

Set `NEXT_PUBLIC_API_URL` in `frontend/.env.local` to your backend (e.g. `http://localhost:3000`) so the pricing page can call `/api/create-checkout-session`.

## 4. Flow

- User clicks **Subscribe with Stripe** on the Pricing page → backend creates a Checkout Session → redirect to Stripe Checkout.
- After payment, Stripe redirects to `FRONTEND_URL/pricing/success?session_id=...`.
- Webhook receives `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`; you can store `customer` / `subscription` in your DB and provision access.

## 5. Customer portal (manage subscription)

Backend exposes `POST /api/create-portal-session` with body `{ "customerId": "cus_..." }`. Store `session.customer` from `checkout.session.completed` (e.g. in Supabase) and add a “Manage billing” button that calls this endpoint and redirects to the returned URL.
