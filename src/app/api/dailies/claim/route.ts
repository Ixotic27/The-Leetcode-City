import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { resolveAuthenticatedDeveloper } from "@/lib/authenticated-developer";
import { rateLimit } from "@/lib/rate-limit";
import { getTodayStr } from "@/lib/dailies";
import {
  DailyMissionService,
  DailyMissionServiceError,
  type DailyMissionDeveloper,
} from "@/services/dailyMissionService";

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedDeveloper({ loadDeveloper: false });

  if (!auth.ok || !auth.user) {
    return NextResponse.json(
      { error: auth.error ?? "Not authenticated" },
      { status: auth.status },
    );
  }

  const { ok } = await rateLimit(`dailies-claim:${auth.user.id}`, 2, 10_000);
  if (!ok) {
    return NextResponse.json({ error: "Too fast" }, { status: 429 });
  }

  const admin = getSupabaseAdmin();
  const service = new DailyMissionService(admin);

  const authDev = await resolveAuthenticatedDeveloper({
    select:
      "id, github_login, claimed, contributions, public_repos, total_stars, kudos_count, dailies_completed, dailies_streak, last_dailies_date, easy_solved, medium_solved, hard_solved, contest_rating, lc_streak, total_prs",
  });

  if (!authDev.ok || !authDev.user || !authDev.developer) {
    return NextResponse.json(
      { error: authDev.error ?? "Developer not found" },
      { status: authDev.status },
    );
  }

  const dev = authDev.developer as DailyMissionDeveloper;

  if (!dev || !dev.claimed) {
    return NextResponse.json(
      { error: "Must claim building first" },
      { status: 403 },
    );
  }

  const today = getTodayStr();

  let isMobile = false;
  try {
    const body = await request.json();
    isMobile = body?.mobile === true;
  } catch (err) {
    console.error(
      "[app/api/dailies/claim/route.ts] failed to parse request body:",
      err,
    );
  }

  try {
    const result = await service.claimReward({
      developer: {
        id: dev.id,
        github_login: dev.github_login,
        claimed: dev.claimed,
        contributions: dev.contributions,
        public_repos: dev.public_repos,
        total_stars: dev.total_stars,
        kudos_count: dev.kudos_count,
        dailies_completed: dev.dailies_completed,
        dailies_streak: dev.dailies_streak,
        last_dailies_date: dev.last_dailies_date,
        easy_solved: dev.easy_solved,
        medium_solved: dev.medium_solved,
        hard_solved: dev.hard_solved,
        contest_rating: dev.contest_rating,
        lc_streak: dev.lc_streak,
        total_prs: dev.total_prs,
      },
      isMobile,
      today,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof DailyMissionServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "Failed to claim" }, { status: 500 });
  }
}
