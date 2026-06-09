import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/base-url";
import { createCashfreeOrder } from "@/lib/cashfree";

const MIN_AMOUNT = 10; // minimum ₹10 INR for checkouts

// Simple IP-based rate limit (1 request per 5 seconds)
const lastRequest = new Map<string, number>();

/**
 * @param {Request} request
 */
export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const now = Date.now();
  const last = lastRequest.get(ip);
  if (last && now - last < 5_000) {
    return NextResponse.json({ error: "Too fast. Wait a few seconds." }, { status: 429 });
  }
  lastRequest.set(ip, now);

  let body: { amount: number; email?: string; name?: string; phone?: string };
  try {
    body = await request.json();
  } catch (err) {
    console.warn("[app/api/support/checkout/route.ts] error:", err);
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { amount, email, name, phone } = body;

  if (!Number.isFinite(amount) || amount < MIN_AMOUNT || Math.floor(amount) !== amount) {
    return NextResponse.json({ error: `Amount must be a whole number of at least ₹${MIN_AMOUNT}` }, { status: 400 });
  }

  if (!phone || !/^[6-9]\d{9}$/.test(phone.trim())) {
    return NextResponse.json({ error: "A valid 10-digit phone number is required" }, { status: 400 });
  }

  try {
    const orderId = `support_${Date.now()}`;
    const baseUrl = getBaseUrl();
    const returnUrl = `${baseUrl}/support`;

    const { paymentSessionId } = await createCashfreeOrder({
      orderId,
      amountINR: amount,
      customerName: name || "Anonymous Support",
      customerEmail: email || "anonymous@theleetcodecity.tech",
      customerPhone: phone.trim(),
      itemName: `Website Renewal Support - ₹${amount}`,
      returnUrl,
    });

    return NextResponse.json({ paymentSessionId, orderId });
  } catch (err: any) {
    console.error("Support checkout error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create checkout" },
      { status: 500 }
    );
  }
}
