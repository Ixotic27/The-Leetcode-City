import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getTodayStr } from "@/lib/dailies";
import { DailyMissionService } from "@/services/dailyMissionService";
import { resolveAuthenticatedDeveloper } from "@/lib/authenticated-developer";

export async function GET(request: Request) {
  const authDev = await resolveAuthenticatedDeveloper({
    select:
      "id, github_login, claimed, dailies_completed, dailies_streak, last_dailies_date, last_checkin_date, points",
  });

  if (!authDev.ok || !authDev.user || !authDev.developer) {
    return NextResponse.json(
      { error: authDev.error ?? "Not authenticated" },
      { status: authDev.status },
    );
  }

  const admin = getSupabaseAdmin();
  const service = new DailyMissionService(admin);
  const dev = authDev.developer;
  const githubLogin =
    typeof dev.github_login === "string" ? dev.github_login : null;

  if (!dev || !dev.claimed) {
    return NextResponse.json(
      { error: "Must claim building first" },
      { status: 403 },
    );
  }

  const today = getTodayStr();

  const { searchParams } = new URL(request.url);
  const isMobile = searchParams.get("mobile") === "1";

  const summary = await service.loadMissionSummary(
    {
      id: dev.id!,
      github_login: githubLogin,
      claimed: typeof dev.claimed === "boolean" ? dev.claimed : null,
      dailies_completed:
        typeof dev.dailies_completed === "number"
          ? dev.dailies_completed
          : null,
      dailies_streak:
        typeof dev.dailies_streak === "number" ? dev.dailies_streak : null,
      last_dailies_date:
        typeof dev.last_dailies_date === "string"
          ? dev.last_dailies_date
          : null,
      last_checkin_date:
        typeof dev.last_checkin_date === "string"
          ? dev.last_checkin_date
          : null,
      points: typeof dev.points === "number" ? dev.points : null,
    },
    { isMobile, today },
  );

  return NextResponse.json(summary);
}
