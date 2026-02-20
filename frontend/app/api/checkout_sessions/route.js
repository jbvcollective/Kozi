import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";
import { checkoutSessionsBodySchema } from "@/lib/validationSchemas";

// Server-only. Stripe secret key is in lib/stripe from env.
const AGENT_PRO_PRICE_ID = process.env.STRIPE_AGENT_PRO_PRICE_ID;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

export async function POST(request) {
  try {
    // Agent Pro is for agents (brokers) only
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
    if (!token || !supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Agent Pro is for agents only. Sign in as an agent to subscribe." },
        { status: 403 }
      );
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user || user.user_metadata?.user_type !== "agent") {
      return NextResponse.json(
        { error: "Agent Pro is for agents only. Sign in as an agent to subscribe." },
        { status: 403 }
      );
    }

    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe is not configured (STRIPE_SECRET_KEY)." },
        { status: 503 }
      );
    }
    if (!AGENT_PRO_PRICE_ID) {
      return NextResponse.json(
        { error: "Agent Pro price is not configured (STRIPE_AGENT_PRO_PRICE_ID)." },
        { status: 500 }
      );
    }
    let customerEmail = user.email || null;
    let clientReferenceId = user.id;
    let customerName = null;
    let customerPhone = null;
    try {
      const body = await request.json();
      const parsed = checkoutSessionsBodySchema.safeParse(body ?? {});
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
      }
      if (parsed.data.email) customerEmail = parsed.data.email;
      if (parsed.data.name) customerName = parsed.data.name;
      if (parsed.data.phone) customerPhone = parsed.data.phone;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const headersList = await headers();
    const origin = headersList.get("origin") || headersList.get("referer")?.replace(/\/$/, "") || "http://localhost:3001";

    let stripeCustomerId = null;
    if (customerEmail) {
      const existing = await stripe.customers.list({ email: customerEmail, limit: 1 });
      if (existing.data?.length > 0) {
        stripeCustomerId = existing.data[0].id;
        await stripe.customers.update(stripeCustomerId, {
          ...(customerName && { name: customerName }),
          ...(customerPhone && { phone: customerPhone }),
        });
      } else {
        const created = await stripe.customers.create({
          email: customerEmail,
          ...(customerName && { name: customerName }),
          ...(customerPhone && { phone: customerPhone }),
        });
        stripeCustomerId = created.id;
      }
    }

    const sessionConfig = {
      line_items: [
        {
          price: AGENT_PRO_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing`,
      automatic_tax: { enabled: true },
      customer_update: stripeCustomerId ? { address: "auto" } : undefined,
      metadata: { product: "agent_pro" },
    };
    if (stripeCustomerId) {
      sessionConfig.customer = stripeCustomerId;
    } else if (customerEmail) {
      sessionConfig.customer_email = customerEmail;
    }
    if (clientReferenceId) sessionConfig.client_reference_id = clientReferenceId;

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Checkout failed." },
      { status: err.statusCode || 500 }
    );
  }
}
