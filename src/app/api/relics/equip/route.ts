import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { cookies } from "next/headers";
import { STATIC_RELICS } from "@/lib/relics";
import { levelFromXp } from "@/lib/xp";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { relicId: string | null };
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { relicId } = body;

  // Always store equipped relic in cookie as a fail-safe / fallback
  const cookieStore = await cookies();
  if (relicId) {
    cookieStore.set("leetcodecity_equipped_relic", relicId, {
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    });
  } else {
    cookieStore.delete("leetcodecity_equipped_relic");
  }

  const admin = getSupabaseAdmin();

  // Fetch developer details, progress, and status
  const { data: dev } = await admin
    .from("developers")
    .select("id, github_login, claimed, easy_solved, medium_solved, hard_solved, contest_rating, lc_streak, app_streak, dailies_completed, dailies_streak, xp_total")
    .eq("claimed_by", user.id)
    .eq("claimed", true)
    .maybeSingle();

  if (dev && relicId) {
    const loginLower = dev.github_login.toLowerCase();
    const isDev = ["ishant_27", "ixotic", "ixotic27"].includes(loginLower);

    if (!isDev) {
      // 1. Check if row exists in developer_relics table
      const { data: unlockedRow } = await admin
        .from("developer_relics")
        .select("id")
        .eq("developer_id", dev.id)
        .eq("relic_id", relicId)
        .maybeSingle();

      let isUnlocked = !!unlockedRow;

      if (!isUnlocked) {
        // 2. Check tracking progress
        const { data: custom } = await admin
          .from("developer_customizations")
          .select("config")
          .eq("developer_id", dev.id)
          .eq("item_id", "relic_progress")
          .maybeSingle();
        const trackerProgress = custom?.config ?? {};

        // 3. Check completed purchases
        const { data: dbPurchases } = await admin
          .from("purchases")
          .select("id")
          .eq("developer_id", dev.id)
          .eq("status", "completed");
        const hasPurchases = !!(dbPurchases && dbPurchases.length > 0);

        const staticRelic = STATIC_RELICS.find((r) => r.id === relicId);
        if (staticRelic) {
          if (relicId === "relic_lith_dawnstone") {
            const lcStreak = dev.lc_streak ?? 0;
            const appStreak = dev.app_streak ?? 0;
            const dailiesStreak = dev.dailies_streak ?? 0;
            isUnlocked = lcStreak >= 7 || appStreak >= 7 || dailiesStreak >= 7;
          } else if (relicId === "relic_lith_harbor_key") {
            isUnlocked = (trackerProgress.docks_visits ?? 0) >= 5;
          } else if (relicId === "relic_meso_core_oscillator") {
            isUnlocked = (dev.medium_solved ?? 0) >= 5;
          } else if (relicId === "relic_meso_steam_turbine") {
            const easy = dev.easy_solved ?? 0;
            const medium = dev.medium_solved ?? 0;
            const hard = dev.hard_solved ?? 0;
            isUnlocked = (easy + medium + hard) >= 5;
          } else if (relicId === "relic_neo_cyber_sigil") {
            isUnlocked = hasPurchases;
          } else if (relicId === "relic_neo_holo_visor") {
            isUnlocked = (trackerProgress.arena_solves ?? 0) >= 20;
          } else if (relicId === "relic_axi_astral_prism") {
            isUnlocked = levelFromXp(dev.xp_total ?? 0) >= 30;
          } else if (relicId === "relic_axi_chronometer") {
            isUnlocked = !!dev.claimed;
          } else if (relicId === "relic_requiem_void_core") {
            isUnlocked = (trackerProgress.raid_wins ?? 0) >= 1;
          } else if (relicId === "relic_new_world") {
            const appStreak = dev.app_streak ?? 0;
            const dailiesStreak = dev.dailies_streak ?? 0;
            const lcStreak = dev.lc_streak ?? 0;
            const dailiesCompleted = dev.dailies_completed ?? 0;
            isUnlocked = appStreak >= 365 || dailiesStreak >= 365 || lcStreak >= 365 || dailiesCompleted >= 182;
          }
        }
      }

      if (!isUnlocked) {
        return NextResponse.json({ error: "Relic is locked" }, { status: 403 });
      }
    }

    // 1. Mark all developer's relics as is_equipped = false
    await admin
      .from("developer_relics")
      .update({ is_equipped: false })
      .eq("developer_id", dev.id);

    // 2. Upsert/Equip the selected relic
    await admin
      .from("developer_relics")
      .upsert(
        {
          developer_id: dev.id,
          relic_id: relicId,
          is_equipped: true,
          created_at: new Date().toISOString(),
        },
        { onConflict: "developer_id,relic_id" }
      );
  }

  return NextResponse.json({ success: true, equippedRelicId: relicId });
}
