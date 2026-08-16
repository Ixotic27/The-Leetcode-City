import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchZeroxSwap, is0xEnabled } from "@/lib/gitc-server";
import { evmAddressSchema, positiveAmountStringSchema, validateQuery } from "@/lib/validation";

const querySchema = z.object({
  sellToken: z.string().trim().min(1, "sellToken is required"),
  sellAmount: positiveAmountStringSchema,
  taker: evmAddressSchema.optional(),
  slippageBps: z
    .string()
    .regex(/^\d+$/, "slippageBps must be a string of digits")
    .optional(),
});

/**
 * Firm quote for a USDC|ETH → GITC swap on Base (0x Swap API v2). Returns a
 * ready-to-send transaction (`transaction.{to,data,value}`) plus any allowance
 * the taker must grant first (`issues.allowance.{actual,spender}`). Requires a
 * `taker` (connected wallet). `{ disabled: true }` when no 0x key is set.
 */
export async function GET(req: NextRequest) {
  if (!is0xEnabled()) return NextResponse.json({ disabled: true });

  const sp = req.nextUrl.searchParams;
  const queryVal = validateQuery(sp, querySchema);
  if (!queryVal.success) {
    return queryVal.response;
  }
  const { sellToken, sellAmount, taker, slippageBps } = queryVal.data;
  const result = await fetchZeroxSwap("quote", {
    sellToken,
    sellAmount,
    taker,
    slippageBps,
  });

  if (!result.ok) {
    if (result.error === "disabled") return NextResponse.json({ disabled: true });
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data, {
    headers: { "Cache-Control": "no-store" },
  });
}
