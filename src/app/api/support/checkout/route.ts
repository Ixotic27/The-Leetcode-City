import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/base-url";
import { createCashfreeOrder } from "@/lib/cashfree";
import { rateLimit } from "@/lib/rate-limit";

const MIN_AMOUNT = 10; // minimum ₹10 INR for checkouts

export async function POST(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  let ip = request.headers.get("x-real-ip") ?? "unknown";
  if (forwarded) {
    const ips = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
    if (ips.length > 0) ip = ips[ips.length - 1];
  }

  const { ok } = await rateLimit(`checkout:${ip}`, 1, 5_000);
  if (!ok) {
    return NextResponse.json({ error: "Too fast. Wait a few seconds." }, { status: 429 });
  }

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
  } catch (err: unknown) {
    console.error("Support checkout error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create checkout" },
      { status: 500 }
    );
  }
}
