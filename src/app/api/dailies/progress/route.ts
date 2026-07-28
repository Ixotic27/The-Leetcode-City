import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";
import { getTodayStr } from "@/lib/dailies";
import {
  DailyMissionService,
  DailyMissionServiceError,
} from "@/services/dailyMissionService";
import { resolveAuthenticatedDeveloper } from "@/lib/authenticated-developer";

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedDeveloper({ loadDeveloper: false });

  if (!auth.ok || !auth.user) {
    return NextResponse.json(
      { error: auth.error ?? "Not authenticated" },
      { status: auth.status },
    );
  }

  const { ok } = await rateLimit(`dailies-progress:${auth.user.id}`, 5, 10_000);
  if (!ok) {
    return NextResponse.json({ error: "Too fast" }, { status: 429 });
  }

  const body = await request.json();
  const { mission_id, points, mobile } = body as {
    mission_id: string;
    points?: number;
    mobile?: boolean;
  };
  const isMobile = mobile === true;
  const increment = typeof points === "number" && points > 0 ? points : 1;

  const admin = getSupabaseAdmin();
  const service = new DailyMissionService(admin);

  const authDev = await resolveAuthenticatedDeveloper({
    select: "id, claimed",
  });
  if (!authDev.ok || !authDev.user || !authDev.developer) {
    return NextResponse.json(
      { error: authDev.error ?? "Developer not found" },
      { status: authDev.status },
    );
  }

  const dev = authDev.developer;
  if (typeof dev.id !== "number" || !dev.claimed) {
    return NextResponse.json(
      { error: "Must claim building first" },
      { status: 403 },
    );
  }

  try {
    const result = await service.updateProgress({
      developerId: dev.id,
      missionId: mission_id,
      increment,
      isMobile,
      today: getTodayStr(),
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof DailyMissionServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: "Failed to update progress" },
      { status: 500 },
    );
  }
}
