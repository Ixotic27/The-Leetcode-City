import crypto from "node:crypto";
import { getSupabaseAdmin } from "./supabase";

const NOWPAYMENTS_API = process.env.NOWPAYMENTS_SANDBOX === "true"
  ? "https://api-sandbox.nowpayments.io/v1"
  : "https://api.nowpayments.io/v1";

interface InvoiceResponse {
  id: string;
  order_id: string;
  order_description: string;
  price_amount: number;
  price_currency: string;
  invoice_url: string;
  created_at: string;
}

/**
 * Create a NOWPayments invoice (hosted checkout page where the user picks
 * their crypto currency). This is simpler and safer than creating a direct
 * payment because NOWPayments handles the coin selection UI.
 *
 * @param itemId       Active item ID from the items table
 * @param developerId  Database ID of the purchasing developer
 * @param githubLogin  GitHub login of the purchasing developer
 * @param purchaseId   Unique purchase/order ID for NOWPayments
 * @returns            Invoice URL and invoice ID
 * @throws            Error if the item is not found/inactive, API key is missing, or API returns an error
 */
export async function createCryptoInvoice(
  itemId: string,
  developerId: number,
  githubLogin: string,
  purchaseId: string,
): Promise<{ invoiceUrl: string; invoiceId: string }> {
  const sb = getSupabaseAdmin();

  const { data: item, error } = await sb
    .from("items")
    .select("*")
    .eq("id", itemId)
    .eq("is_active", true)
    .single();

  if (error || !item) {
    throw new Error("Item not found or inactive");
  }

  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) {
    throw new Error("NOWPAYMENTS_API_KEY is not set");
  }

  const priceUsd = item.price_usd_cents / 100;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.theleetcodecity.tech").replace(/\/+$/, "");

  const successUrl = `${siteUrl}/shop/${githubLogin}?purchased=${itemId}`;
  const cancelUrl = `${siteUrl}/shop/${githubLogin}`;

  const res = await fetch(`${NOWPAYMENTS_API}/invoice`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      price_amount: priceUsd,
      price_currency: "usd",
      order_id: purchaseId,
      order_description: `${item.name} - ${githubLogin}`,
      ipn_callback_url: `${siteUrl}/api/webhooks/nowpayments`,
      success_url: successUrl,
      cancel_url: cancelUrl,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NOWPayments error: ${res.status} ${text}`);
  }

  const data: InvoiceResponse = await res.json();

  if (!data?.invoice_url || !data?.id) {
    throw new Error(`NOWPayments: unexpected response: ${JSON.stringify(data)}`);
  }

  return {
    invoiceUrl: data.invoice_url,
    invoiceId: String(data.id),
  };
}

/**
 * Create a raw NOWPayments invoice without validating against the items table.
 * Use this when the caller already knows the price and description.
 *
 * @param opts.priceUsd         Amount in US dollars
 * @param opts.orderId          Unique order/purchase ID
 * @param opts.orderDescription Human-readable order description
 * @param opts.successUrl      URL to redirect to on successful payment
 * @param opts.cancelUrl       URL to redirect to if the user cancels
 * @returns                    Invoice URL and invoice ID
 * @throws                     Error if NOWPAYMENTS_API_KEY is not set or the API returns an error
 */
export async function createCryptoInvoiceRaw({
  priceUsd,
  orderId,
  orderDescription,
  successUrl,
  cancelUrl,
}: {
  priceUsd: number;
  orderId: string;
  orderDescription: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ invoiceUrl: string; invoiceId: string }> {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) {
    throw new Error("NOWPAYMENTS_API_KEY is not set");
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.theleetcodecity.tech").replace(/\/+$/, "");

  const res = await fetch(`${NOWPAYMENTS_API}/invoice`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      price_amount: priceUsd,
      price_currency: "usd",
      order_id: orderId,
      order_description: orderDescription,
      ipn_callback_url: `${siteUrl}/api/webhooks/nowpayments`,
      success_url: successUrl,
      cancel_url: cancelUrl,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NOWPayments error: ${res.status} ${text}`);
  }

  const data: InvoiceResponse = await res.json();

  if (!data?.invoice_url || !data?.id) {
    throw new Error(`NOWPayments: unexpected response: ${JSON.stringify(data)}`);
  }

  return {
    invoiceUrl: data.invoice_url,
    invoiceId: String(data.id),
  };
}

/**
 * Verify the HMAC-SHA512 signature on a NOWPayments IPN callback.
 *
 * NOWPayments signs IPN payloads as HMAC-SHA512 over the sorted JSON body.
 *
 * @param rawBody    Raw request body object (not stringified)
 * @param signature  The signature from the `NOWPAYMENTS_SIGNATURE` header
 * @returns          True if the signature is valid; false if missing secret or signature mismatch
 */
export function verifyIpnSignature(
  rawBody: Record<string, unknown>,
  signature: string,
): boolean {
  const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!ipnSecret) return false;

  const sorted = sortObject(rawBody);
  const hmac = crypto
    .createHmac("sha512", ipnSecret)
    .update(JSON.stringify(sorted))
    .digest("hex");

  return hmac === signature;
}

/** Recursively sort object keys alphabetically (required by NOWPayments). */
function sortObject(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.keys(obj)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      const val = obj[key];
      result[key] =
        val && typeof val === "object" && !Array.isArray(val)
          ? sortObject(val as Record<string, unknown>)
          : val;
      return result;
    }, {});
}

