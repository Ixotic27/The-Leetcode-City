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

/**
 * Create a Stripe Checkout session for a shop item purchase.
 *
 * @param itemId          Active item ID from the items table
 * @param developerId     Database ID of the purchasing developer
 * @param githubLogin     GitHub login of the purchasing developer
 * @param currency        Billing currency; defaults to "usd"
 * @param customerEmail   Optional billing email; Stripe infers from existing customer if omitted
 * @param giftedToDevId   If gifting, the DB ID of the recipient developer
 * @param giftedToLogin   If gifting, the GitHub login of the recipient
 * @param idempotencyKey  Optional Stripe idempotency key to safely retry without double-charging
 * @returns               Redirect URL to the Stripe-hosted checkout page
 * @throws                Error if the item does not exist or is not active
 */
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

/**
 * Create a Stripe Checkout session for a pixel package purchase.
 *
 * @param packageId     Active pixel package ID from the pixel_packages table
 * @param developerId   Database ID of the purchasing developer
 * @param githubLogin   GitHub login of the purchasing developer
 * @param currency      Billing currency; defaults to "usd"
 * @param customerEmail Optional billing email
 * @returns             Redirect URL and the Stripe session ID
 * @throws              Error if the package does not exist or is not active
 */
export async function createPixelCheckoutSession(
  packageId: string,
  developerId: number,
  githubLogin: string,
  currency: "usd" | "brl" = "usd",
  customerEmail?: string,
): Promise<{ url: string; sessionId: string }> {
  const sb = getSupabaseAdmin();
  const { data: pkg } = await sb
    .from("pixel_packages")
    .select("*")
    .eq("id", packageId)
    .eq("is_active", true)
    .single();
  if (!pkg) throw new Error("Package not found");

  const stripe = getStripe();
  const unitAmount = currency === "brl" ? pkg.price_brl_cents : pkg.price_usd_cents;
  const totalPx = pkg.pixels + pkg.bonus_pixels;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: customerEmail || undefined,
    line_items: [
      {
        price_data: {
          currency,
          product_data: {
            name: `${totalPx} Pixels`,
            description:
              pkg.bonus_pixels > 0
                ? `${pkg.pixels} PX + ${pkg.bonus_pixels} bonus`
                : `${pkg.pixels} PX`,
          },
          unit_amount: unitAmount,
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: "pixel_package",
      package_id: packageId,
      developer_id: String(developerId),
    },
    success_url: `${getBaseUrl()}/pixels?pixels_purchased=${packageId}`,
    cancel_url: `${getBaseUrl()}/pixels`,
  });

  return { url: session.url!, sessionId: session.id };
}

