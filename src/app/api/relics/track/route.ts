import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { action: "visit_docks" | "arena_solve" | "raid_win" };
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { action } = body;
  if (!["visit_docks", "arena_solve", "raid_win"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Fetch developer
  const { data: dev } = await admin
    .from("developers")
    .select("id")
    .eq("claimed_by", user.id)
    .eq("claimed", true)
    .maybeSingle();

  if (!dev) {
    return NextResponse.json({ error: "Must claim building first" }, { status: 403 });
  }

  // 1. Ensure 'relic_progress' exists in items table
  await admin.from("items").upsert({
    id: "relic_progress",
    category: "identity",
    name: "Relic Progress",
    price_usd_cents: 0,
    price_brl_cents: 0,
    is_active: false,
    description: "Custom metadata tracking for relics unlock system",
  }, { onConflict: "id" });

  // 2. Fetch or create developer customizations config for 'relic_progress'
  const { data: custom } = await admin
    .from("developer_customizations")
    .select("config")
    .eq("developer_id", dev.id)
    .eq("item_id", "relic_progress")
    .maybeSingle();

  const progress = custom?.config ?? {
    docks_visits: 0,
    arena_solves: 0,
    raid_wins: 0,
  };

  let unlockedRelicId: string | null = null;

  // 3. Update the config based on the action
  if (action === "visit_docks") {
    progress.docks_visits = (progress.docks_visits ?? 0) + 1;
    if (progress.docks_visits >= 5) {
      unlockedRelicId = "relic_lith_harbor_key";
    }
  } else if (action === "arena_solve") {
    progress.arena_solves = (progress.arena_solves ?? 0) + 1;
    if (progress.arena_solves >= 20) {
      unlockedRelicId = "relic_neo_holo_visor";
    }
  } else if (action === "raid_win") {
    progress.raid_wins = (progress.raid_wins ?? 0) + 1;
    if (progress.raid_wins >= 1) {
      unlockedRelicId = "relic_requiem_void_core";
    }
  }

  // 4. Save progress config back
  await admin.from("developer_customizations").upsert(
    {
      developer_id: dev.id,
      item_id: "relic_progress",
      config: progress,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "developer_id,item_id" }
  );

  // 5. If we unlocked a relic, upsert it into developer_relics
  if (unlockedRelicId) {
    await admin.from("developer_relics").upsert(
      {
        developer_id: dev.id,
        relic_id: unlockedRelicId,
        is_equipped: false,
        created_at: new Date().toISOString(),
      },
      { onConflict: "developer_id,relic_id" }
    );
  }

  return NextResponse.json({
    success: true,
    progress,
    unlockedRelicId,
  });
}
