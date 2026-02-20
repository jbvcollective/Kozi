/**
 * Server-side only. Use in API routes (e.g. app/api/checkout_sessions/route.js).
 * Do not import this from client components.
 * OWASP: STRIPE_SECRET_KEY is a secret — never use NEXT_PUBLIC_* or expose in client. Rotate in Stripe if exposed.
 * When STRIPE_SECRET_KEY is not set, stripe is null and checkout is disabled.
 */
import Stripe from "stripe";

const secret = process.env.STRIPE_SECRET_KEY;
export const stripe = secret ? new Stripe(secret) : null;
