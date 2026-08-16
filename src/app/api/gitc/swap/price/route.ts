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
 * Indicative price for a USDC|ETH → GITC swap on Base (0x Swap API v2).
 * Used by the Exchange screen to show a live "you get ~X GITC" estimate as the
 * player types. Returns `{ disabled: true }` (200) when no 0x key is configured
 * so the client cleanly falls back to the Uniswap deep-link.
 */
export async function GET(req: NextRequest) {
  if (!is0xEnabled()) return NextResponse.json({ disabled: true });

  const sp = req.nextUrl.searchParams;
  const queryVal = validateQuery(sp, querySchema);
  if (!queryVal.success) {
    return queryVal.response;
  }
  const { sellToken, sellAmount, taker, slippageBps } = queryVal.data;
  const result = await fetchZeroxSwap("price", {
    sellToken,
    sellAmount,
    taker,
    slippageBps,
  });

  if (!result.ok) {
    if (result.error === "disabled") return NextResponse.json({ disabled: true });
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  // Quotes change constantly; allow a very short reuse window only.
  return NextResponse.json(result.data, {
    headers: { "Cache-Control": "private, max-age=5" },
  });
}
