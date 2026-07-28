import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getIsoWeekStartDateString } from "@/lib/week";
import { RaidService } from "@/services/raidService";

/**
 * @param {import('next/server').NextRequest} request
 */
export async function POST(request: Request) {
  const { resolveAuthenticatedDeveloper } =
    await import("@/lib/authenticated-developer");
  const auth = await resolveAuthenticatedDeveloper({ loadDeveloper: false });

  if (!auth.ok || !auth.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const user = auth.user;

  const body = await request.json();
  const {
    target_login,
    boost_purchase_id,
    consumable_item_id: _legacy_consumable,
    offensive_item_id,
    vehicle_id,
  } = body as {
    target_login: string;
    boost_purchase_id?: number;
    consumable_item_id?: string;
    offensive_item_id?: string;
    vehicle_id?: string;
  };
  const consumable_item_id = offensive_item_id ?? _legacy_consumable;

  if (!target_login || typeof target_login !== "string") {
    return NextResponse.json(
      { error: "Missing target_login" },
      { status: 400 },
    );
  }

  const raidWeekStart = getIsoWeekStartDateString();
  const admin = getSupabaseAdmin();

  try {
    const service = new RaidService(
      admin,
      user,
      {
        target_login,
        boost_purchase_id,
        consumable_item_id,
        offensive_item_id,
        vehicle_id,
      },
      raidWeekStart,
    );

    const result = await service.execute();
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    const raidError = error as Error & { status?: number };
    if (typeof raidError.status === "number") {
      return NextResponse.json(
        { error: raidError.message },
        { status: raidError.status },
      );
    }
    return NextResponse.json(
      { error: raidError.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
