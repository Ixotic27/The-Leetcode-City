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
  const env = process.env.NEXT_PUBLIC_CASHFREE_ENV ?? "SANDBOX";
  return env === "PRODUCTION" ? PRODUCTION_URL : SANDBOX_URL;
}

function getAppId(): string {
  const id = process.env.CASHFREE_APP_ID;
  if (!id) throw new Error("CASHFREE_APP_ID is not set");
  return id;
}

function getSecretKey(): string {
  const key = process.env.CASHFREE_SECRET_KEY;
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

export async function createCashfreeOrder(opts: {
  orderId: string;
  amountINR: number; // in rupees (NOT paise)
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  itemName: string;
  returnUrl: string;
}): Promise<{ paymentSessionId: string; cfOrderId: string }> {
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
        customer_phone: opts.customerPhone,
      },
      order_meta: {
        return_url: (opts.returnUrl.includes("?") 
          ? opts.returnUrl + "&order_id={order_id}" 
          : opts.returnUrl + "?order_id={order_id}").replace(/^http:\/\/localhost:\d+/, "https://great-sheep-sniff.loca.lt"),
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
export async function getCashfreeOrderStatus(orderId: string): Promise<{
  orderStatus: string;
  paymentStatus: string;
  cfOrderId: string;
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
  };
}

// ---------------------------------------------------------------------------
// Webhook signature verification
// Signature = Base64(HMAC-SHA256(timestamp + rawBody, secretKey))
// ---------------------------------------------------------------------------
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
export async function createCashfreeCheckout(
  itemId: string,
  developerId: number,
  githubLogin: string,
  customerEmail?: string,
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
    customerPhone: "9999999999", // placeholder for test mode
    itemName: `${item.name} - ${githubLogin}`,
    returnUrl,
  });

  return { paymentSessionId, orderId };
}
