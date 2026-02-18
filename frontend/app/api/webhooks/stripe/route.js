/**
 * Stripe webhook: on checkout.session.completed, find the agent by email and
 * update agents.data with agent_pro_subscribed_at + stripe_subscription_id.
 *
 * Works with Payment Links (matches by email) and Checkout Sessions
 * (also checks client_reference_id as a fallback).
 *
 * Configure in Stripe Dashboard:
 *   Webhooks → Add endpoint → URL: https://yourdomain.com/api/webhooks/stripe
 *   Events: checkout.session.completed
 *   Set STRIPE_WEBHOOK_SECRET in .env.local from the signing secret.
 */
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request) {
  if (!stripe || !WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature." }, { status: 400 });
  }
  let body;
  try {
    body = await request.text();
  } catch (e) {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
  } catch (err) {
    return NextResponse.json({ error: err.message || "Invalid signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    if (session.status !== "complete") return NextResponse.json({ received: true });
    if (!supabaseAdmin) return NextResponse.json({ received: true });

    const customerEmail = session.customer_details?.email || session.customer_email || null;
    const userId = session.client_reference_id || null;

    let agentRow = null;

    if (userId) {
      const { data } = await supabaseAdmin
        .from("agents").select("user_id, data").eq("user_id", userId).maybeSingle();
      agentRow = data;
    }
    if (!agentRow && customerEmail) {
      const { data } = await supabaseAdmin
        .from("agents").select("user_id, data").eq("data->>email", customerEmail).maybeSingle();
      agentRow = data;
    }

    if (agentRow) {
      const now = new Date().toISOString();
      const merged = {
        ...(typeof agentRow.data === "object" && agentRow.data !== null ? agentRow.data : {}),
        agent_pro_subscribed_at: now,
        stripe_subscription_id: session.subscription ?? undefined,
        stripe_customer_email: customerEmail,
      };
      await supabaseAdmin
        .from("agents")
        .update({
          data: merged,
          is_paid: true,
          paid_at: now,
          stripe_subscription_id: session.subscription ?? null,
          updated_at: now,
        })
        .eq("user_id", agentRow.user_id);
    }
  }

  return NextResponse.json({ received: true });
}
