import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { resolveAuthenticatedDeveloper } =
    await import("@/lib/authenticated-developer");
  const auth = await resolveAuthenticatedDeveloper({ loadDeveloper: false });

  if (!auth.ok || !auth.user) {
    return NextResponse.json({ history: [] }, { status: 401 });
  }
  const user = auth.user;

  const githubLogin = (
    user.user_metadata?.user_name ??
    user.user_metadata?.preferred_username ??
    ""
  ).toLowerCase();

  const sb = getSupabaseAdmin();
  const { data: dev } = await sb
    .from("developers")
    .select("id")
    .eq("github_login", githubLogin)
    .single();

  if (!dev) return NextResponse.json({ transactions: [], next_cursor: null });

  const cursor = req.nextUrl.searchParams.get("cursor");
  const limit = Math.min(
    50,
    Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? "20", 10)),
  );

  let query = sb
    .from("wallet_transactions")
    .select("id, type, amount, source, description, balance_after, created_at")
    .eq("developer_id", dev.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data: transactions } = await query;
  const nextCursor =
    transactions && transactions.length === limit
      ? transactions[transactions.length - 1].created_at
      : null;

  return NextResponse.json({
    transactions: transactions ?? [],
    next_cursor: nextCursor,
  });
}
