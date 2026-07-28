import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parsePagination } from "@/lib/parse-pagination";
import { z } from "zod";
import { validateQuery } from "@/lib/validation";

const querySchema = z.object({
  developer_id: z.coerce.number({ message: "Invalid developer_id" }).int().positive("Invalid developer_id"),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const queryVal = validateQuery(searchParams, querySchema);
  if (!queryVal.success) {
    return queryVal.response;
  }

  const { developer_id: devId, limit: rawLimit, offset: rawOffset } = queryVal.data;
  const { limit, offset } = parsePagination(rawLimit ?? null, rawOffset ?? null);

  const admin = getSupabaseAdmin();

  // Fetch raids involving this developer (attacker or defender)
  const [raidsAttacker, raidsDefender, activeTagRes, totalAttacker, totalDefender] = await Promise.all([
    admin
      .from("raids")
      .select("id, attacker_id, defender_id, success, created_at, attacker:developers!raids_attacker_id_fkey(github_login), defender:developers!raids_defender_id_fkey(github_login)")
      .eq("attacker_id", devId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1),
    admin
      .from("raids")
      .select("id, attacker_id, defender_id, success, created_at, attacker:developers!raids_attacker_id_fkey(github_login), defender:developers!raids_defender_id_fkey(github_login)")
      .eq("defender_id", devId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1),
    admin
      .from("raid_tags")
      .select("attacker_login, tag_style, expires_at")
      .eq("building_id", devId)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("raids")
      .select("id", { count: "exact", head: true })
      .eq("attacker_id", devId),
    admin
      .from("raids")
      .select("id", { count: "exact", head: true })
      .eq("defender_id", devId),
  ]);

  // Merge and sort
  const allRaids = [
    ...(raidsAttacker.data ?? []),
    ...(raidsDefender.data ?? []),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      attacker_login: (r.attacker as unknown as { github_login: string })?.github_login ?? "unknown",
      defender_login: (r.defender as unknown as { github_login: string })?.github_login ?? "unknown",
      success: r.success,
      created_at: r.created_at,
    }));

  return NextResponse.json({
    raids: allRaids,
    total: (totalAttacker.count ?? 0) + (totalDefender.count ?? 0),
    active_tag: activeTagRes.data ?? null,
  });
}
