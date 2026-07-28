import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { z } from "zod";
import { validateParams } from "@/lib/validation";

const paramsSchema = z.object({
  developerId: z.coerce.number().int().positive("Invalid developer ID"),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ developerId: string }> }
) {
  const resolvedParams = await params;
  const validation = validateParams(resolvedParams, paramsSchema);
  if (!validation.success) {
    return validation.response;
  }

  const { developerId } = validation.data;

  const sb = getSupabaseAdmin();

  const [allRes, unlockedRes] = await Promise.all([
    sb.from("achievements").select("*").order("sort_order"),
    sb
      .from("developer_achievements")
      .select("achievement_id, unlocked_at, seen")
      .eq("developer_id", developerId),
  ]);

  const unlockedMap = new Map(
    (unlockedRes.data ?? []).map((r) => [r.achievement_id, r])
  );

  const achievements = (allRes.data ?? []).map((a) => ({
    ...a,
    unlocked: unlockedMap.has(a.id),
    unlocked_at: unlockedMap.get(a.id)?.unlocked_at ?? null,
    seen: unlockedMap.get(a.id)?.seen ?? false,
  }));

  return NextResponse.json(
    { achievements },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
  );
}
