import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";
import { trackDailyMission } from "@/lib/dailies";
import { processDeveloperActivity } from "@/lib/developerActivityEngine";
import { buildFlyLeaderboard, type FlyScoreRow } from "@/lib/fly-leaderboard";
import { getTodaySeed } from "@/lib/fly-seed";
import { validateBody } from "@/lib/validation";

const flyScoreSchema = z.object({
  score: z.number().min(0).max(430),
  collected: z.number().min(0).max(40),
  max_combo: z.number().min(1).max(3),
  flight_ms: z.number().min(10_000),
});

function maxScoreForCollected(collected: number): number {
  if (collected <= 0) return 0;
  const epics = Math.min(collected, 2);
  const rares = Math.min(Math.max(collected - 2, 0), 8);
  const commons = Math.max(collected - 10, 0);
  const bestComboScore = epics * 75 + rares * 15 + commons * 3;
  return Math.ceil(bestComboScore * 1.5 * 1.1);
}

interface FlyScoreDev {
  developer_id: number;
}

export async function POST(request: Request) {
  const { resolveAuthenticatedDeveloper } = await import("@/lib/authenticated-developer");
  const auth = await resolveAuthenticatedDeveloper({ loadDeveloper: false });

  if (!auth.ok || !auth.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const user = auth.user;

  const { ok } = await rateLimit(`fly-score:${user.id}`, 1, 15_000);
  if (!ok) {
    return NextResponse.json({ error: "Too fast" }, { status: 429 });
  }

  const validation = validateBody(await request.json(), flyScoreSchema);
  if (!validation.success) {
    return validation.response;
  }
  const { score, collected, max_combo, flight_ms } = validation.data;

  const ceiling = maxScoreForCollected(collected);
  if (score > ceiling) {
    return NextResponse.json({ error: "Invalid score" }, { status: 400 });
  }

  if (collected > 0 && flight_ms < collected * 500) {
    return NextResponse.json({ error: "Invalid flight time" }, { status: 400 });
  }

  if (collected === 0 && score > 0) {
    return NextResponse.json({ error: "Invalid score" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const { data: dev } = await admin
    .from("developers")
    .select("id")
    .eq("claimed_by", user.id)
    .single();

  if (!dev) {
    return NextResponse.json({ error: "Developer not found" }, { status: 404 });
  }

  const seed = getTodaySeed();

  const { data: row, error: insertError } = await admin
    .from("fly_scores")
    .insert({
      developer_id: dev.id,
      score,
      collected,
      max_combo,
      flight_ms,
      seed,
    })
    .select("id")
    .single();

  if (insertError && insertError.code !== "23505") {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  if (insertError?.code === "23505") {
    const { data: existing } = await admin
      .from("fly_scores")
      .select("id, score, flight_ms")
      .eq("developer_id", dev.id)
      .eq("seed", seed)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Existing score not found" }, { status: 500 });
    }

    const { data: higherDevs } = await admin
      .from("fly_scores")
      .select("developer_id")
      .eq("seed", seed)
      .gt("score", existing.score);

    const { data: tiedFasterDevs } = await admin
      .from("fly_scores")
      .select("developer_id")
      .eq("seed", seed)
      .eq("score", existing.score)
      .lt("flight_ms", existing.flight_ms);

    const uniqueHigher = new Set([
      ...(higherDevs ?? []).map((r: FlyScoreDev) => r.developer_id),
      ...(tiedFasterDevs ?? []).map((r: FlyScoreDev) => r.developer_id),
    ]);
    uniqueHigher.delete(dev.id);
    const rankToday = uniqueHigher.size + 1;

    const { data: allDevs } = await admin.from("fly_scores").select("developer_id").eq("seed", seed);
    const totalDevs = new Set((allDevs ?? []).map((r: FlyScoreDev) => r.developer_id)).size;

    return NextResponse.json({ id: existing.id, score: existing.score, rank_today: rankToday, total: totalDevs });
  }

  const flyXp = Math.floor(score * 0.1);

  // ── Common reward pipeline (engine) ──────────────────────────────
  await processDeveloperActivity(admin as never, {
    developerId: dev.id,
    xpGrants: flyXp > 0 ? [{ source: "fly", amount: flyXp }] : [],
  });

  // Domain-specific: daily missions
  await trackDailyMission(dev.id, "fly_score_50", { score });
  await trackDailyMission(dev.id, "fly_score_150", { score });

  const { data: higherDevs } = await admin
    .from("fly_scores")
    .select("developer_id")
    .eq("seed", seed)
    .gt("score", score);

  const { data: tiedFasterDevs } = await admin
    .from("fly_scores")
    .select("developer_id")
    .eq("seed", seed)
    .eq("score", score)
    .lt("flight_ms", flight_ms);

  const uniqueHigher = new Set([
    ...(higherDevs ?? []).map((r: FlyScoreDev) => r.developer_id),
    ...(tiedFasterDevs ?? []).map((r: FlyScoreDev) => r.developer_id),
  ]);
  uniqueHigher.delete(dev.id);
  const rank_today = uniqueHigher.size + 1;

  const { data: allDevs } = await admin.from("fly_scores").select("developer_id").eq("seed", seed);
  const total = new Set((allDevs ?? []).map((r: FlyScoreDev) => r.developer_id)).size;

  return NextResponse.json({ id: row?.id, score, rank_today, total });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const seed = searchParams.get("seed") || getTodaySeed();

  const admin = getSupabaseAdmin();

  const [{ data, error }, { data: devIds }] = await Promise.all([
    admin
      .from("fly_scores")
      .select("score, collected, max_combo, flight_ms, created_at, developer_id, developers!inner(github_login, avatar_url)")
      .eq("seed", seed)
      .order("score", { ascending: false })
      .order("flight_ms", { ascending: true })
      .limit(200),
    admin
      .from("fly_scores")
      .select("developer_id")
      .eq("seed", seed),
  ]);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }

  // `developers` is a to-one embed (single object); buildFlyLeaderboard
  // dedupes per developer, takes the top 20, and resolves login/avatar.
  const leaderboard = buildFlyLeaderboard(
    (data ?? []) as unknown as FlyScoreRow[],
  );

  const total = new Set((devIds ?? []).map((r: FlyScoreDev) => r.developer_id)).size;

  return NextResponse.json(
    { seed, leaderboard, total },
    { headers: { "Cache-Control": "public, s-maxage=60" } },
  );
}
