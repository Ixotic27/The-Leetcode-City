import { NextResponse } from "next/server";
import { getCashfreeOrderStatus } from "@/lib/cashfree";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("order_id");

  if (!orderId) {
    return NextResponse.json({ error: "Missing order_id" }, { status: 400 });
  }

  try {
    const { orderStatus } = await getCashfreeOrderStatus(orderId);
    const isPaid = orderStatus === "PAID";
    return NextResponse.json({ isPaid, orderStatus });
  } catch (err) {
    console.error("[api/support/status] Error fetching order status:", err);
    return NextResponse.json({ error: "Failed to fetch order status" }, { status: 500 });
  }
}
