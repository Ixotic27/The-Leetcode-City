import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { STATIC_RELICS } from "@/lib/relics";
import { cookies } from "next/headers";
import { levelFromXp } from "@/lib/xp";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = getSupabaseAdmin();

  // Load relics from STATIC_RELICS to make sure we have the description, abilities, and howToAchieve
  const relics = STATIC_RELICS;

  // Try to fetch coords overrides from DB relics table if it exists
  const { data: dbRelics } = await admin
    .from("relics")
    .select("*");

  let equippedRelicId: string | null = null;

  // Fallback equipped relic from cookie if DB table is missing/fails
  const cookieStore = await cookies();
  const cookieRelic = cookieStore.get("leetcodecity_equipped_relic")?.value;
  if (cookieRelic) {
    equippedRelicId = cookieRelic;
  }

  const unlockedRelicIds = new Set<string>();
  let isDev = false;
  let devRecord: any = null;
  let trackerProgress: any = {};
  let hasPurchases = false;

  if (user) {
    // Fetch developer ID and stats
    const { data: dev } = await admin
      .from("developers")
      .select("id, github_login, claimed, easy_solved, medium_solved, hard_solved, contest_rating, lc_streak, app_streak, dailies_completed, dailies_streak, xp_total")
      .eq("claimed_by", user.id)
      .eq("claimed", true)
      .maybeSingle();

    if (dev) {
      devRecord = dev;
      const loginLower = dev.github_login.toLowerCase();
      isDev = ["ishant_27", "ixotic", "ixotic27"].includes(loginLower);

      // Fetch all unlocked relics from DB for this user
      const { data: unlocked } = await admin
        .from("developer_relics")
        .select("relic_id, is_equipped")
        .eq("developer_id", dev.id);

      if (unlocked) {
        for (const row of unlocked) {
          unlockedRelicIds.add(row.relic_id);
          if (row.is_equipped) {
            equippedRelicId = row.relic_id;
          }
        }
      }

      // Fetch tracking progress from developer_customizations
      const { data: custom } = await admin
        .from("developer_customizations")
        .select("config")
        .eq("developer_id", dev.id)
        .eq("item_id", "relic_progress")
        .maybeSingle();
      if (custom && custom.config) {
        trackerProgress = custom.config;
      }

      // Check for completed purchases (for relic_neo_cyber_sigil)
      const { data: dbPurchases } = await admin
        .from("purchases")
        .select("id")
        .eq("developer_id", dev.id)
        .eq("status", "completed");
      hasPurchases = !!(dbPurchases && dbPurchases.length > 0);
    }
  }

  // Calculate locked state dynamically
  const relicsWithLockState = relics.map((staticRelic) => {
    // Check if coords overrides exist in DB
    const dbRelic = dbRelics?.find((r) => r.id === staticRelic.id);
    const target_x = dbRelic?.target_x ?? staticRelic.target_x;
    const target_y = dbRelic?.target_y ?? staticRelic.target_y;
    const target_z = dbRelic?.target_z ?? staticRelic.target_z;

    let locked = true;

    if (isDev) {
      locked = false;
    } else if (unlockedRelicIds.has(staticRelic.id)) {
      locked = false;
    } else if (devRecord) {
      // Check programmatic conditions
      if (staticRelic.id === "relic_lith_dawnstone") {
        const lcStreak = devRecord.lc_streak ?? 0;
        const appStreak = devRecord.app_streak ?? 0;
        const dailiesStreak = devRecord.dailies_streak ?? 0;
        if (lcStreak >= 7 || appStreak >= 7 || dailiesStreak >= 7) {
          locked = false;
        }
      } else if (staticRelic.id === "relic_lith_harbor_key") {
        const visits = trackerProgress.docks_visits ?? 0;
        if (visits >= 5) {
          locked = false;
        }
      } else if (staticRelic.id === "relic_meso_core_oscillator") {
        const medium = devRecord.medium_solved ?? 0;
        if (medium >= 5) {
          locked = false;
        }
      } else if (staticRelic.id === "relic_meso_steam_turbine") {
        const easy = devRecord.easy_solved ?? 0;
        const medium = devRecord.medium_solved ?? 0;
        const hard = devRecord.hard_solved ?? 0;
        const totalSolved = easy + medium + hard;
        if (totalSolved >= 5) {
          locked = false;
        }
      } else if (staticRelic.id === "relic_neo_cyber_sigil") {
        if (hasPurchases) {
          locked = false;
        }
      } else if (staticRelic.id === "relic_neo_holo_visor") {
        const arenaSolves = trackerProgress.arena_solves ?? 0;
        if (arenaSolves >= 20) {
          locked = false;
        }
      } else if (staticRelic.id === "relic_axi_astral_prism") {
        const level = levelFromXp(devRecord.xp_total ?? 0);
        if (level >= 30) {
          locked = false;
        }
      } else if (staticRelic.id === "relic_axi_chronometer") {
        if (devRecord.claimed) {
          locked = false;
        }
      } else if (staticRelic.id === "relic_requiem_void_core") {
        const raidWins = trackerProgress.raid_wins ?? 0;
        if (raidWins >= 1) {
          locked = false;
        }
      } else if (staticRelic.id === "relic_new_world") {
        const appStreak = devRecord.app_streak ?? 0;
        const dailiesStreak = devRecord.dailies_streak ?? 0;
        const lcStreak = devRecord.lc_streak ?? 0;
        const dailiesCompleted = devRecord.dailies_completed ?? 0;
        if (appStreak >= 365 || dailiesStreak >= 365 || lcStreak >= 365 || dailiesCompleted >= 182) {
          locked = false;
        }
      }
    }

    return {
      ...staticRelic,
      target_x,
      target_y,
      target_z,
      locked,
    };
  });

  // Automatically insert newly unlocked relics into DB for user
  if (user && devRecord) {
    const toInsert = [];
    for (const relic of relicsWithLockState) {
      if (!relic.locked && !unlockedRelicIds.has(relic.id)) {
        toInsert.push({
          developer_id: devRecord.id,
          relic_id: relic.id,
          is_equipped: false
        });
      }
    }
    if (toInsert.length > 0) {
      await admin.from("developer_relics").insert(toInsert);
    }
  }

  return NextResponse.json({
    relics: relicsWithLockState,
    equippedRelicId,
  });
}
