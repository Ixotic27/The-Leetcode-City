import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const results = { merged: 0, errors: 0 };

  const { data: duplicates, error: dupError } = await sb
    .from("purchases")
    .select("provider_tx_id, id, status, created_at")
    .not("provider_tx_id", "is", null)
    .order("created_at", { ascending: true });

  if (dupError) {
    console.error("Failed to fetch purchases for dedup:", dupError);
    results.errors++;
    return NextResponse.json(results);
  }

  const groups = new Map<string, any[]>();
  for (const row of duplicates) {
    const key = row.provider_tx_id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  for (const [, rows] of groups) {
    if (rows.length < 2) continue;

    const [keep, ...dups] = rows;

    for (const dup of dups) {
      if (dup.status === "completed" || dup.status === "delivered") {
        const { error: updateError } = await sb
          .from("purchases")
          .update({ status: "refunded" })
          .eq("id", dup.id);

        if (updateError) {
          console.error(`Failed to mark duplicate purchase ${dup.id} as refunded:`, updateError);
          results.errors++;
        } else {
          results.merged++;
        }
      } else {
        const { error: deleteError } = await sb
          .from("purchases")
          .delete()
          .eq("id", dup.id);

        if (deleteError) {
          console.error(`Failed to delete duplicate purchase ${dup.id}:`, deleteError);
          results.errors++;
        } else {
          results.merged++;
        }
      }
    }
  }

  return NextResponse.json(results);
}
