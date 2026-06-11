import { NextRequest, NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/base-url";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createServerSupabase } from "@/lib/supabase-server";
import { SKY_AD_PLANS, isValidPlanId, getPriceCents, type AdCurrency } from "@/lib/skyAdPlans";
import { MAX_TEXT_LENGTH } from "@/lib/skyAds";
import { rateLimit } from "@/lib/rate-limit";
import { containsBlockedContent } from "@/lib/ad-moderation";
import { createPixQrCodeRaw } from "@/lib/abacatepay";
import { createCryptoInvoiceRaw } from "@/lib/nowpayments";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  for (const b of bytes) token += chars[b % chars.length];
  return token;
}

/**
 * @param {import('next/server').NextRequest} request
 */
export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const { ok } = rateLimit(`checkout:${ip}`, 1, 10_000);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a few seconds." },
      { status: 429 }
    );
  }

  let body: {
    plan_id?: string;
    text?: string;
    color?: string;
    bgColor?: string;
    currency?: string;
    provider?: "stripe" | "abacatepay" | "nowpayments" | "cashfree";
    dev_mode?: boolean;
    phone?: string;
  };
  try {
    body = await request.json();
  } catch (err) { console.warn("[app/api/sky-ads/checkout/route.ts] error:", err); return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
   }
  const { plan_id, text, color, bgColor, phone } = body;

  // Brazilian Stripe CNPJ can't charge USD to Brazilian cards.
  // Detect country via Vercel/CF geolocation headers and force BRL for BR users.
  const country =
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("cf-ipcountry") ??
    "";
  const isBrazil = country.toUpperCase() === "BR";
  const currency: AdCurrency = isBrazil ? "brl" : body.currency === "brl" ? "brl" : "usd";

  // Validate plan
  if (!plan_id || !isValidPlanId(plan_id)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  // Validate text
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `Text must be ${MAX_TEXT_LENGTH} characters or less` },
      { status: 400 }
    );
  }

  // Moderate text content
  const modResult = containsBlockedContent(text);
  if (modResult.blocked) {
    return NextResponse.json(
      { error: modResult.reason ?? "Ad text not allowed" },
      { status: 400 }
    );
  }

  // Validate colors
  if (!color || !HEX_COLOR.test(color)) {
    return NextResponse.json({ error: "Invalid text color (use #RRGGBB)" }, { status: 400 });
  }
  if (!bgColor || !HEX_COLOR.test(bgColor)) {
    return NextResponse.json({ error: "Invalid background color (use #RRGGBB)" }, { status: 400 });
  }

  const plan = SKY_AD_PLANS[plan_id];
  const sb = getSupabaseAdmin();

  // Generate IDs
  const adId = "ad-" + generateToken().slice(0, 16);
  const trackingToken = generateToken();

  // Create inactive sky_ad row (brand/description/link set post-checkout)
  const { error: insertError } = await sb.from("sky_ads").insert({
    id: adId,
    text: text.trim(),
    brand: "",
    description: "",
    color,
    bg_color: bgColor,
    link: "",
    vehicle: plan.vehicle,
    priority: 50,
    active: false,
    plan_id,
    tracking_token: trackingToken,
  });

  if (insertError) {
    console.error("Failed to create sky_ad:", insertError);
    return NextResponse.json({ error: "Failed to create ad" }, { status: 500 });
  }

  // DEV BYPASS: Allow Ishant_27 to activate ads instantly for free
  let isDev = false;
  const { dev_mode } = body;
  const supabaseAuth = await createServerSupabase();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (user) {
    const { data: dev } = await sb
      .from("developers")
      .select("github_login")
      .eq("claimed_by", user.id)
      .single();
    if (["ishant_27", "ixotic", "ixotic27"].includes(dev?.github_login?.toLowerCase() ?? "") && dev_mode === true) {
      isDev = true;
    }
  }

  const baseUrl = getBaseUrl();

  if (isDev) {
    console.log(`[DEV] Bypassing payment for sky ad: ${adId}`);
    const now = new Date();
    const endsAt = new Date(now.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);

    await sb
      .from("sky_ads")
      .update({
        active: true,
        starts_at: now.toISOString(),
        ends_at: endsAt.toISOString(),
        purchaser_email: user?.email ?? "ishant_27@example.com",
      })
      .eq("id", adId);

    // Auto-deactivate the "advertise" placeholder if same vehicle type
    if (plan.vehicle === "plane") {
      await sb
        .from("sky_ads")
        .update({ active: false })
        .eq("id", "advertise")
        .eq("active", true);
    }

    return NextResponse.json({
      url: `${baseUrl}/advertise/setup/${trackingToken}`,
    });
  }

  const provider = body.provider ?? "stripe";

  try {
    if (provider === "abacatepay") {
      const priceBrl = getPriceCents(plan_id, "brl");
      const { brCode, brCodeBase64, pixId } = await createPixQrCodeRaw({
        amountCents: priceBrl,
        description: `LeetCode City Ad: ${plan.label}`,
        externalId: `sky_ad:${adId}`,
      });

      await sb
        .from("sky_ads")
        .update({ pix_id: pixId })
        .eq("id", adId);

      return NextResponse.json({ brCode, brCodeBase64, trackingToken });
    }

    if (provider === "nowpayments") {
      const priceUsd = getPriceCents(plan_id, "usd") / 100;
      const successUrl = `${baseUrl}/advertise/setup/${trackingToken}`;
      const cancelUrl = `${baseUrl}/advertise`;

      const { invoiceUrl } = await createCryptoInvoiceRaw({
        priceUsd,
        orderId: adId,
        orderDescription: `LeetCode City Ad: ${plan.label}`,
        successUrl,
        cancelUrl,
      });

      await sb
        .from("sky_ads")
        .update({ stripe_session_id: adId })
        .eq("id", adId);

      return NextResponse.json({ url: invoiceUrl });
    }

    if (provider === "cashfree") {
      if (!phone || !/^[6-9]\d{9}$/.test(phone.trim())) {
        return NextResponse.json(
          { error: "A valid 10-digit phone number is required for Cashfree payment" },
          { status: 400 }
        );
      }

      const USD_TO_INR = 85;
      const amountINR = Math.round((getPriceCents(plan_id, "usd") / 100) * USD_TO_INR);
      const returnUrl = `${baseUrl}/advertise/setup/${trackingToken}`;

      const { createCashfreeOrder } = await import("@/lib/cashfree");
      const { paymentSessionId } = await createCashfreeOrder({
        orderId: adId,
        amountINR: Math.max(amountINR, 1),
        customerName: "Advertiser",
        customerEmail: user?.email ?? "advertiser@leetcodecity.dev",
        customerPhone: phone.trim(),
        itemName: `LeetCode City Ad: ${plan.label}`,
        returnUrl,
      });

      await sb
        .from("sky_ads")
        .update({ stripe_session_id: adId })
        .eq("id", adId);

      return NextResponse.json({ paymentSessionId, cashfreeOrderId: adId, trackingToken });
    }

    // Stripe
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 min
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `LeetCode City Ad: ${plan.label}`,
              description: `${plan.label} ad for ${plan.duration_days} days on LeetCode City`,
            },
            unit_amount: getPriceCents(plan_id, currency),
          },
          quantity: 1,
        },
      ],
      metadata: {
        sky_ad_id: adId,
        type: "sky_ad",
      },
      success_url: `${baseUrl}/advertise/setup/${trackingToken}`,
      cancel_url: `${baseUrl}/advertise`,
    });

    await sb
      .from("sky_ads")
      .update({ stripe_session_id: session.id })
      .eq("id", adId);

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Sky ad checkout creation failed:", err);
    // Clean up the orphaned row
    await sb.from("sky_ads").delete().eq("id", adId);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Payment setup failed" },
      { status: 500 }
    );
  }
}
