import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { z } from "zod";
import { validateQuery } from "@/lib/validation";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const queryVal = validateQuery(req.nextUrl.searchParams, querySchema);
  if (!queryVal.success) {
    return queryVal.response;
  }

  const q = queryVal.data.q?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  const supabase = getSupabaseAdmin();
  // Escape LIKE special characters (% _ \) to prevent wildcard injection
  const escapedQ = q.replace(/[%_\\]/g, (c) => (c === "\\" ? "\\\\" : `\\${c}`));
  const { data, error } = await supabase
    .from("developers")
    .select("github_login, avatar_url, name, easy_solved, medium_solved, hard_solved, lc_global_rank")
    .ilike("github_login", `%${escapedQ}%`)
    .limit(8);

  if (error) {
    console.error("Search API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? [], {
    headers: { "Cache-Control": "no-store" },
  });
}
