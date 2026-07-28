import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import crypto from "crypto";

const BATCH_SIZE = 100;
const MAX_DELETES = 1000;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 },
    );
  }

  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  if (auth.length !== expected.length || !timingSafeEqual(auth, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();

  let totalDeleted = 0;
  let deleted = BATCH_SIZE;

  while (deleted === BATCH_SIZE && totalDeleted < MAX_DELETES) {
    const { data: rows } = await sb
      .from("activity_feed")
      .select("id")
      .lt("created_at", cutoff)
      .limit(BATCH_SIZE);

    if (!rows || rows.length === 0) break;

    const { error } = await sb
      .from("activity_feed")
      .delete()
      .in(
        "id",
        rows.map((r: { id: string }) => r.id),
      );

    if (error) {
      return NextResponse.json(
        { error: error.message, deleted: totalDeleted },
        { status: 500 },
      );
    }

    deleted = rows.length;
    totalDeleted += deleted;
  }

  return NextResponse.json({ ok: true, deleted: totalDeleted });
}
