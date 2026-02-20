import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";
import { verifyAgentProBodySchema } from "@/lib/validationSchemas";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Server-only. Never in NEXT_PUBLIC_* or client. Rotate in Supabase if exposed.
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function generateAgentCode(name) {
  const parts = (name || "AX").trim().split(/\s+/);
  const fn = parts[0] || "AX";
  const ln = parts.length > 1 ? parts[parts.length - 1] : fn;
  const fnP = (fn[0] + fn[fn.length - 1]).toUpperCase();
  const lnP = (ln[0] + ln[ln.length - 1]).toUpperCase();
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear() % 100).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 90) + 10);
  return fnP + lnP + mm + yy + rand;
}

async function activateAgentPro(userId, subscriptionId, customerEmail) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const now = new Date().toISOString();

  const { data: row } = await supabase
    .from("agents").select("data").eq("user_id", userId).maybeSingle();

  if (row) {
    const existing = typeof row.data === "object" && row.data !== null ? row.data : {};
    const merged = {
      ...existing,
      agent_pro_subscribed_at: now,
      stripe_subscription_id: subscriptionId,
      stripe_customer_email: customerEmail,
    };
    const { error: updateErr } = await supabase.from("agents").update({
      data: merged,
      is_paid: true,
      paid_at: now,
      stripe_subscription_id: subscriptionId,
      updated_at: now,
    }).eq("user_id", userId);
    if (updateErr) throw new Error("Could not update agent: " + updateErr.message);
  } else {
    let fullName = customerEmail || "Agent";
    let phone = null;
    let brokerage = null;
    try {
      const { data: { user } } = await supabase.auth.admin.getUserById(userId);
      if (user) {
        const meta = user.user_metadata || {};
        fullName = meta.full_name || meta.name || user.email || fullName;
        phone = meta.phone || null;
        brokerage = meta.brokerage || null;
      }
    } catch (_) {}

    const code = generateAgentCode(fullName);
    const { error: insertErr } = await supabase.from("agents").insert({
      user_id: userId,
      code,
      data: {
        display_name: fullName,
        email: customerEmail,
        phone,
        brokerage,
        agent_pro_subscribed_at: now,
        stripe_subscription_id: subscriptionId,
      },
      is_paid: true,
      paid_at: now,
      stripe_subscription_id: subscriptionId,
      updated_at: now,
    });
    if (insertErr) throw new Error("Could not create agent: " + insertErr.message);
  }
}

export async function POST(request) {
  try {
    if (!stripe) {
      return NextResponse.json({ error: "Stripe not configured." }, { status: 503 });
    }
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Database not configured." }, { status: 503 });
    }

    let sessionId = null;
    let email = null;
    let userId = null;
    try {
      const body = await request.json();
      const parsed = verifyAgentProBodySchema.safeParse(body ?? {});
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
      }
      sessionId = parsed.data.session_id ?? null;
      email = parsed.data.email ?? null;
      userId = parsed.data.user_id ?? null;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    // --- Mode 1: verify by session_id (redirect from Checkout Session success page) ---
    if (sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.status !== "complete") {
        return NextResponse.json({ verified: false, message: `Checkout session not complete (${session.status}).` });
      }
      const uid = session.client_reference_id;
      if (!uid) {
        return NextResponse.json({ verified: false, message: "No user ID linked to this checkout session." });
      }
      const subId = session.subscription || null;
      const custEmail = session.customer_details?.email || session.customer_email || null;
      await activateAgentPro(uid, subId, custEmail);
      return NextResponse.json({ verified: true, subscription_id: subId });
    }

    // --- Mode 2: poll by email (after Payment Link payment) ---
    if (email) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      // Quick check: already activated in Supabase?
      if (userId) {
        const { data: agent } = await supabase
          .from("agents").select("is_paid").eq("user_id", userId).maybeSingle();
        if (agent?.is_paid) {
          return NextResponse.json({ verified: true, message: "Already active." });
        }
      }

      // Search Stripe for recent completed checkout sessions by this email
      const sessions = await stripe.checkout.sessions.list({
        customer_details: { email },
        status: "complete",
        limit: 5,
      });

      const match = sessions.data.find(s =>
        s.payment_status === "paid" &&
        (s.client_reference_id === userId || !s.client_reference_id)
      );

      if (!match) {
        return NextResponse.json({ verified: false, message: "No completed payment found yet." });
      }

      const uid = userId || match.client_reference_id;
      if (!uid) {
        return NextResponse.json({ verified: false, message: "Cannot link payment to user." });
      }

      const subId = match.subscription || null;
      const custEmail = match.customer_details?.email || match.customer_email || email;
      await activateAgentPro(uid, subId, custEmail);
      return NextResponse.json({ verified: true, subscription_id: subId });
    }

    return NextResponse.json({ error: "Provide session_id or email." }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Verification failed." }, { status: 500 });
  }
}
