import crypto from "crypto";
import { getBaseUrl } from "./base-url";
import { getSupabaseAdmin } from "./supabase";

// ---------------------------------------------------------------------------
// Cashfree REST API integration (no SDK dependency – uses standard fetch)
// Docs: https://docs.cashfree.com/reference/pgcreateorder
// ---------------------------------------------------------------------------

const SANDBOX_URL = "https://sandbox.cashfree.com/pg";
const PRODUCTION_URL = "https://api.cashfree.com/pg";

function getApiUrl(): string {
  const env = (process.env.NEXT_PUBLIC_CASHFREE_ENV ?? "SANDBOX").replace(/['"]/g, "").trim();
  return env === "PRODUCTION" ? PRODUCTION_URL : SANDBOX_URL;
}

function getAppId(): string {
  const id = (process.env.CASHFREE_APP_ID ?? "").replace(/['"]/g, "").trim();
  if (!id) throw new Error("CASHFREE_APP_ID is not set");
  return id;
}

function getSecretKey(): string {
  const key = (process.env.CASHFREE_SECRET_KEY ?? "").replace(/['"]/g, "").trim();
  if (!key) throw new Error("CASHFREE_SECRET_KEY is not set");
  return key;
}

// ---------------------------------------------------------------------------
// Create a Cashfree Order (returns payment_session_id for the JS SDK)
// ---------------------------------------------------------------------------
interface CashfreeOrderResponse {
  cf_order_id: string;
  order_id: string;
  payment_session_id: string;
  order_status: string;
}

/**
 * Create a Cashfree order and return the payment session ID.
 *
 * @param opts.orderId       Unique order identifier
 * @param opts.amountINR      Order amount in Indian Rupees (NOT paise)
 * @param opts.customerName   Customer full name
 * @param opts.customerEmail  Customer email address
 * @param opts.customerPhone Customer phone number
 * @param opts.itemName       Description of the purchased item
 * @param opts.returnUrl     URL Cashfree redirects to after payment attempt
 * @returns                  Payment session ID and Cashfree order ID
 * @throws                  Error on API failure or missing session ID in response
 */
export async function createCashfreeOrder(opts: {
  orderId: string;
  amountINR: number; // in rupees (NOT paise)
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  itemName: string;
  returnUrl: string;
}): Promise<{ paymentSessionId: string; cfOrderId: string }> {
  console.log("[createCashfreeOrder] Options:", {
    orderId: opts.orderId,
    amountINR: opts.amountINR,
    customerPhone: opts.customerPhone,
  });
  console.log("[createCashfreeOrder] Config:", {
    env: (process.env.NEXT_PUBLIC_CASHFREE_ENV ?? "").replace(/['"]/g, "").trim(),
    apiUrl: getApiUrl(),
    appId: getAppId(),
    // Log first/last 4 chars of secret key for security validation
    secretPrefix: getSecretKey().substring(0, 12),
  });

  const env = (process.env.NEXT_PUBLIC_CASHFREE_ENV ?? "SANDBOX").replace(/['"]/g, "").trim();
  const phone = opts.customerPhone === "9999999999" && env === "PRODUCTION" ? "7000000000" : opts.customerPhone;

  const res = await fetch(`${getApiUrl()}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-version": "2023-08-01",
      "x-client-id": getAppId(),
      "x-client-secret": getSecretKey(),
    },
    body: JSON.stringify({
      order_id: opts.orderId,
      order_amount: opts.amountINR,
      order_currency: "INR",
      customer_details: {
        customer_id: opts.orderId.split("_")[0] ?? "guest",
        customer_name: opts.customerName,
        customer_email: opts.customerEmail,
        customer_phone: phone,
      },
      order_meta: {
        return_url: (opts.returnUrl.includes("?")
          ? opts.returnUrl + "&order_id={order_id}"
          : opts.returnUrl + "?order_id={order_id}").replace(/^http:\/\/localhost:\d+/, process.env.CASHFREE_TUNNEL_URL || "$&"),
      },
      order_note: opts.itemName,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cashfree create order failed: ${res.status} ${text}`);
  }

  const data: CashfreeOrderResponse = await res.json();

  if (!data.payment_session_id) {
    throw new Error(`Cashfree: missing payment_session_id: ${JSON.stringify(data)}`);
  }

  return {
    paymentSessionId: data.payment_session_id,
    cfOrderId: data.cf_order_id,
  };
}

// ---------------------------------------------------------------------------
// Verify Cashfree order status (called after return or from webhook)
// ---------------------------------------------------------------------------
/**
 * Fetch the current status of a Cashfree order.
 *
 * @param orderId  The order ID previously passed to `createCashfreeOrder`
 * @returns        Order and payment status details from Cashfree
 * @throws         Error on API failure
 */
export async function getCashfreeOrderStatus(orderId: string): Promise<{
  orderStatus: string;
  paymentStatus: string;
  cfOrderId: string;
  orderAmount: number;
}> {
  const res = await fetch(`${getApiUrl()}/orders/${orderId}`, {
    method: "GET",
    headers: {
      "x-api-version": "2023-08-01",
      "x-client-id": getAppId(),
      "x-client-secret": getSecretKey(),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cashfree get order failed: ${res.status} ${text}`);
  }

  const data = await res.json();

  return {
    orderStatus: data.order_status,
    paymentStatus: data.order_status, // "PAID" | "ACTIVE" | "EXPIRED"
    cfOrderId: data.cf_order_id,
    orderAmount: data.order_amount ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Webhook signature verification
// Signature = Base64(HMAC-SHA256(timestamp + rawBody, secretKey))
// ---------------------------------------------------------------------------
/**
 * Verify the HMAC-SHA256 signature on a Cashfree webhook callback.
 *
 * Cashfree signs webhook payloads as Base64(HMAC-SHA256(timestamp + rawBody, secretKey)).
 *
 * @param signature  The `x-cf-signature` header value
 * @param rawBody    Raw request body string (not parsed)
 * @param timestamp  The `x-cf-timestamp` header value
 * @returns          True if the signature is valid, false otherwise
 */
export function verifyCashfreeWebhook(
  signature: string,
  rawBody: string,
  timestamp: string,
): boolean {
  const secretKey = getSecretKey();
  const data = timestamp + rawBody;
  const expectedSignature = crypto
    .createHmac("sha256", secretKey)
    .update(data)
    .digest("base64");

  return expectedSignature === signature;
}

// ---------------------------------------------------------------------------
// Helper: Create a full checkout flow for shop items
// ---------------------------------------------------------------------------
/**
 * Create a complete Cashfree checkout flow for a shop item.
 * Looks up the item price in the DB, creates a Cashfree order, and returns
 * the payment session ID and order ID for the frontend SDK.
 *
 * @param itemId          Active item ID from the items table
 * @param developerId     Database ID of the purchasing developer
 * @param githubLogin     GitHub login of the purchasing developer
 * @param customerEmail   Optional billing email; defaults to a generated placeholder
 * @param customerPhone   Customer phone number
 * @param giftedToDevId   If gifting, the DB ID of the recipient developer
 * @param giftedToLogin   If gifting, the GitHub login of the recipient
 * @returns               Payment session ID and the internal order ID
 * @throws                Error if the item does not exist or is not active
 */
export async function createCashfreeCheckout(
  itemId: string,
  developerId: number,
  githubLogin: string,
  customerEmail: string | undefined,
  customerPhone: string,
  giftedToDevId?: number | null,
  giftedToLogin?: string | null,
): Promise<{ paymentSessionId: string; orderId: string }> {
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

  // Convert USD cents to INR (approximate rate; in production you'd use
  // a live rate API, but for now we use a fixed conversion).
  const USD_TO_INR = 85;
  const amountINR = Math.max(1, Math.ceil((item.price_usd_cents / 100) * USD_TO_INR));

  const orderId = `${developerId}_${itemId}_${Date.now()}`;
  const baseUrl = getBaseUrl();

  const returnUrl = giftedToLogin
    ? `${baseUrl}/?user=${giftedToLogin}&gifted=${itemId}`
    : `${baseUrl}/shop/${githubLogin}?purchased=${itemId}`;

  const { paymentSessionId, cfOrderId } = await createCashfreeOrder({
    orderId,
    amountINR: Math.max(amountINR, 1), // minimum ₹1
    customerName: githubLogin,
    customerEmail: customerEmail || `${githubLogin}@leetcodecity.dev`,
    customerPhone,
    itemName: `${item.name} - ${githubLogin}`,
    returnUrl,
  });

  return { paymentSessionId, orderId };
}
