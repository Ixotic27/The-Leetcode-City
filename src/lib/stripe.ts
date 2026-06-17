import Stripe from "stripe";
import { randomUUID } from "crypto";
import { getBaseUrl } from "./base-url";
import { getSupabaseAdmin } from "./supabase";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeInstance) return stripeInstance;
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-02-25.clover",
  } as any);
  return stripeInstance;
}

export async function createCheckoutSession(
  itemId: string,
  developerId: number,
  githubLogin: string,
  currency: "usd" | "brl" = "usd",
  customerEmail?: string,
  giftedToDevId?: number | null,
  giftedToLogin?: string | null,
  idempotencyKey?: string,
): Promise<{ url: string }> {
  const sb = getSupabaseAdmin();

  // Price ALWAYS from DB, never from frontend
  const { data: item, error } = await sb
    .from("items")
    .select("*")
    .eq("id", itemId)
    .eq("is_active", true)
    .single();

  if (error || !item) {
    throw new Error("Item not found or inactive");
  }

  const stripe = getStripe();
  const unitAmount =
    currency === "brl" ? item.price_brl_cents : item.price_usd_cents;

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    customer_email: customerEmail || undefined,
    line_items: [
      {
        price_data: {
          currency,
          product_data: {
            name: item.name,
            description: item.description || undefined,
          },
          unit_amount: unitAmount,
        },
        quantity: 1,
      },
    ],
    metadata: {
      developer_id: String(developerId),
      item_id: itemId,
      github_login: githubLogin,
      idempotency_key: `stripe_${developerId}_${itemId}_${Date.now()}`,
      ...(giftedToDevId ? { gifted_to: String(giftedToDevId) } : {}),
    },
    success_url: giftedToLogin
      ? `${getBaseUrl()}/?user=${giftedToLogin}&gifted=${itemId}`
      : `${getBaseUrl()}/shop/${githubLogin}?purchased=${itemId}`,
    cancel_url: `${getBaseUrl()}/shop/${githubLogin}`,
  };

  const session = idempotencyKey
    ? await stripe.checkout.sessions.create(sessionParams, { idempotencyKey })
    : await stripe.checkout.sessions.create(sessionParams);

  return { url: session.url! };
}
