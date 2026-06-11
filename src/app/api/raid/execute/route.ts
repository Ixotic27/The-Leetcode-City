import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { checkAchievements } from "@/lib/achievements";
import { touchLastActive } from "@/lib/notification-helpers";
import { sendRaidAlertNotification } from "@/lib/notification-senders/raid";
import { trackDailyMission } from "@/lib/dailies";
import {
  calculateAttackScore,
  calculateDefenseScore,
  getRaidTitle,
  RAID_TAG_DURATION_DAYS,
  XP_WIN_ATTACKER,
  XP_WIN_DEFENDER,
  XP_LOSE_DEFENDER,
} from "@/lib/raid";
import { ITEM_UNLOCK_LEVELS } from "@/lib/zones";
import {
  getIsoWeekStart,
  getIsoWeekStartDateString,
  getUtcDateString,
} from "@/lib/week";
import { findRaidAttackerForUser } from "@/lib/raid-attacker";

type RaidDeveloper = {
  id: number;
  claimed: boolean;
  github_login: string;
  avatar_url?: string | null;
  contributions?: number | null;
  public_repos?: number | null;
  total_stars?: number | null;
  kudos_count?: number | null;
  app_streak?: number | null;
  raid_xp?: number | null;
  xp_level?: number | null;
  current_week_contributions?: number | null;
  current_week_kudos_given?: number | null;
  current_week_kudos_received?: number | null;
  last_raided_at?: string | null;
  active_defenses?: unknown;
  easy_solved?: number | null;
  medium_solved?: number | null;
  hard_solved?: number | null;
  contest_rating?: number | null;
  lc_streak?: number | null;
  total_prs?: number | null;
};

/**
 * @param {import('next/server').NextRequest} request
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // NOTE: The in-process rateLimit() call is intentionally removed.
  // It used a per-process Map (src/lib/rate-limit.ts) with no shared
  // state across serverless instances — trivially bypassable on Vercel.
  // The 30-second cooldown is now enforced atomically inside execute_raid()
  // via the raid_cooldowns table CAS pattern.

  const body = await request.json();
  const { target_login, boost_purchase_id, consumable_item_id: _legacy_consumable, offensive_item_id, vehicle_id } = body as {
    target_login: string;
    boost_purchase_id?: number;
    consumable_item_id?: string;
    offensive_item_id?: string;
    vehicle_id?: string;
  };
  const consumable_item_id = offensive_item_id ?? _legacy_consumable;

  if (!target_login || typeof target_login !== "string") {
    return NextResponse.json({ error: "Missing target_login" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Fetch attacker + defender in parallel (no guard reads here —
  // all guards now execute atomically inside execute_raid())
  const raidColumns = "id, claimed, github_login, avatar_url, contributions, public_repos, total_stars, kudos_count, app_streak, raid_xp, xp_level, current_week_contributions, current_week_kudos_given, current_week_kudos_received, last_raided_at, active_defenses, easy_solved, medium_solved, hard_solved, contest_rating, lc_streak, total_prs";
  const [attacker, defenderRes] = await Promise.all([
    findRaidAttackerForUser(admin, user, raidColumns),
    admin
      .from("developers")
      .select(raidColumns)
      .eq("github_login", target_login.toLowerCase())
      .limit(1)
      .maybeSingle(),
  ]);
  const defender = defenderRes.data as RaidDeveloper | null;

  if (!attacker || !attacker.claimed) {
    return NextResponse.json({ error: "Must claim building first" }, { status: 403 });
  }
  if (!defender) {
    return NextResponse.json({ error: "Target not found" }, { status: 404 });
  }
  if (attacker.id === defender.id) {
    return NextResponse.json({ error: "Cannot raid yourself" }, { status: 409 });
  }

  // Determine vehicle + tag style from saved loadout (unchanged)
  const [{ data: raidLoadoutRow }, { data: ownedVehiclePurchases }] = await Promise.all([
    admin
      .from("developer_customizations")
      .select("config")
      .eq("developer_id", attacker.id)
      .eq("item_id", "raid_loadout")
      .maybeSingle(),
    admin
      .from("purchases")
      .select("item_id, items!inner(metadata)")
      .eq("developer_id", attacker.id)
      .eq("status", "completed"),
  ]);

  const ownedSet = new Set((ownedVehiclePurchases ?? []).map((p) => p.item_id));
  const savedLoadout = (raidLoadoutRow?.config as { vehicle?: string; tag?: string } | null) ?? {};
  const xpLevel = attacker.xp_level ?? 1;

  let vehicle = "airplane";
  if (vehicle_id) {
    const isLevelUnlocked = ITEM_UNLOCK_LEVELS[vehicle_id] && xpLevel >= ITEM_UNLOCK_LEVELS[vehicle_id];
    if (
      vehicle_id === "airplane" ||
      vehicle_id === "raid_helicopter" ||
      vehicle_id === "vehicle_tank" ||
      vehicle_id === "raid_b2_bomber" ||
      ownedSet.has(vehicle_id) ||
      isLevelUnlocked
    ) {
      vehicle = vehicle_id;
    }
  } else {
    const saved = savedLoadout.vehicle ?? "airplane";
    const isSavedLevelUnlocked = ITEM_UNLOCK_LEVELS[saved] && xpLevel >= ITEM_UNLOCK_LEVELS[saved];
    vehicle =
      saved === "airplane" ||
      saved === "raid_helicopter" ||
      saved === "vehicle_tank" ||
      saved === "raid_b2_bomber" ||
      ownedSet.has(saved) ||
      isSavedLevelUnlocked
        ? saved
        : "airplane";
  }

  let tagStyle = "default";
  const savedTag = savedLoadout.tag ?? "default";
  const isTagLevelUnlocked = ITEM_UNLOCK_LEVELS[savedTag] && xpLevel >= ITEM_UNLOCK_LEVELS[savedTag];
  tagStyle = savedTag === "default" || ownedSet.has(savedTag) || isTagLevelUnlocked ? savedTag : "default";

  // Handle consumable boost / item (unchanged)
  let boostBonus = 0;
  let boostItemId: string | null = null;
  let boostPurchaseIdToConsume: number | null = null;
  let attackerConsumableItemId: string | null = null;

  if (consumable_item_id) {
    const currentWeekStr = getIsoWeekStartDateString();
    const { data: consumable } = await admin
      .from("developer_consumables")
      .select("id, quantity, weekly_uses, last_reset_week")
      .eq("developer_id", attacker.id)
      .eq("item_id", consumable_item_id)
      .single();
    const resetWeekStr = consumable?.last_reset_week
      ? getUtcDateString(consumable.last_reset_week)
      : null;

    if (consumable && consumable.quantity > 0) {
      let currentUses = consumable.weekly_uses;
      if (currentWeekStr !== resetWeekStr) currentUses = 0;
      if (currentUses < 3) attackerConsumableItemId = consumable_item_id;
    } else {
      const reqLevel = ITEM_UNLOCK_LEVELS[consumable_item_id];
      const isLevelUnlocked = reqLevel && xpLevel >= reqLevel;
      if (isLevelUnlocked || consumable_item_id === "scouting_satellite") {
        if (!consumable || consumable.weekly_uses < 3 || resetWeekStr !== currentWeekStr) {
          attackerConsumableItemId = consumable_item_id;
        }
      }
    }
  } else if (boost_purchase_id) {
    const { data: boostPurchase } = await admin
      .from("purchases")
      .select("id, item_id, status, items!inner(metadata)")
      .eq("id", boost_purchase_id)
      .eq("developer_id", attacker.id)
      .eq("status", "completed")
      .single();
    if (boostPurchase) {
      const meta = (boostPurchase.items as unknown as { metadata: { type: string; bonus: number } })?.metadata;
      if (meta?.type === "raid_boost" && meta.bonus > 0) {
        boostBonus = meta.bonus;
        boostItemId = boostPurchase.item_id;
        boostPurchaseIdToConsume = boostPurchase.id;
      }
    }
  }

  // Handle defender active defenses (unchanged)
  let activeDefenses: string[] = Array.isArray(defender.active_defenses) ? defender.active_defenses : [];
  let defenderItemUsed = false;

  if (activeDefenses.length > 0) {
    defenderItemUsed = true;
  } else {
    const { data: availableDefenses } = await admin
      .from("developer_consumables")
      .select("item_id, quantity, weekly_uses, last_reset_week")
      .eq("developer_id", defender.id)
      .gt("quantity", 0);

    if (availableDefenses && availableDefenses.length > 0) {
      const currentWeekStr = getIsoWeekStartDateString();
      for (const def of availableDefenses) {
        let currentUses = def.weekly_uses;
        if (getUtcDateString(def.last_reset_week) !== currentWeekStr) currentUses = 0;
        if (currentUses < 3) {
          activeDefenses = [def.item_id];
          defenderItemUsed = true;
          break;
        }
      }
    }
  }

  const isEmpDevice = attackerConsumableItemId === "emp_device";
  const isSabotageVirus = attackerConsumableItemId === "sabotage_virus";

  let defenderEffectiveDefense = activeDefenses.length > 0 ? activeDefenses[0] : null;
  if (isEmpDevice && defenderEffectiveDefense) defenderEffectiveDefense = null;

  const isAirAttack = vehicle !== "vehicle_tank";
  const isGroundAttack = vehicle === "vehicle_tank";
  const isStealthCloak = defenderEffectiveDefense === "stealth_cloak";
  const isEmpShield = defenderEffectiveDefense === "emp_shield" && !isEmpDevice;
  const isAntiMissile = defenderEffectiveDefense === "anti_missile_system";
  const isAntiTank = defenderEffectiveDefense === "anti_tank_mines";

  const attack = calculateAttackScore({
    weeklyContributions: attacker.current_week_contributions ?? 0,
    appStreak: attacker.app_streak ?? 0,
    weeklyKudosGiven: attacker.current_week_kudos_given ?? 0,
    boostBonus,
    empShieldActive: isEmpShield,
    vehicle,
  });

  const defense = calculateDefenseScore({
    weeklyContributions: isStealthCloak ? 0 : defender.current_week_contributions ?? 0,
    appStreak: isStealthCloak ? 0 : defender.app_streak ?? 0,
    weeklyKudosReceived: isStealthCloak ? 0 : defender.current_week_kudos_received ?? 0,
    sabotageVirusActive: isSabotageVirus,
    antiMissileActive: isAntiMissile,
    antiTankActive: isAntiTank,
    isAirAttack,
    isGroundAttack,
  });

  const success = attack.total > defense.total;

  if (boostItemId) attack.breakdown.boost_item = boostItemId;
  if (attackerConsumableItemId) attack.breakdown.boost_item = attackerConsumableItemId;
  if (defenderEffectiveDefense) defense.breakdown.boost_item = defenderEffectiveDefense;

  // ── Atomic raid execution — all guards + INSERT in one DB call ──
  const { data: raidResult, error: raidError } = await admin.rpc("execute_raid", {
    p_attacker_id:       attacker.id,
    p_defender_id:       defender.id,
    p_attack_score:      attack.total,
    p_defense_score:     defense.total,
    p_success:           success,
    p_attack_breakdown:  attack.breakdown,
    p_defense_breakdown: defense.breakdown,
    p_vehicle:           vehicle,
    p_tag_style:         tagStyle,
  });

  if (raidError) {
    console.error("[raid/execute] execute_raid RPC error:", raidError.message);
    return NextResponse.json({ error: "Raid temporarily unavailable" }, { status: 500 });
  }

  const result = raidResult?.[0];

  if (!result?.ok) {
    const errorMap: Record<string, { error: string; status: number }> = {
      cooldown:    { error: "Too fast, wait before raiding again", status: 429 },
      daily_cap:   { error: "Daily raid limit reached", status: 429 },
      peace_shield: { error: "Target has an active Peace Shield", status: 429 },
      weekly_pair: { error: "Already raided this target this week", status: 429 },
    };
    const mapped = errorMap[result?.error_code] ?? { error: "Raid blocked", status: 429 };
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  const raidId = result.raid_id;

  // ── Post-insert side effects (non-critical, not in the guard path) ──

  // Consume legacy boost
  if (boostPurchaseIdToConsume) {
    await admin.from("purchases").update({ status: "consumed" }).eq("id", boostPurchaseIdToConsume);
  }

  const consumeDeveloperItem = async (devId: number, itemId: string) => {
    const currentWeekStr = getIsoWeekStartDateString();
    await admin.rpc("consume_consumable", {
      p_developer_id: devId,
      p_item_id: itemId,
      p_week_start: currentWeekStr,
    });
  };

  if (attackerConsumableItemId) await consumeDeveloperItem(attacker.id, attackerConsumableItemId);
  if (defenderItemUsed && activeDefenses.length > 0) await consumeDeveloperItem(defender.id, activeDefenses[0]);

  if (success) {
    await admin.from("raid_tags").update({ active: false }).eq("building_id", defender.id).eq("active", true);
    await admin.from("raid_tags").insert({
      raid_id: raidId,
      building_id: defender.id,
      attacker_id: attacker.id,
      attacker_login: attacker.github_login,
      tag_style: tagStyle,
      expires_at: new Date(Date.now() + RAID_TAG_DURATION_DAYS * 86400000).toISOString(),
    });

    await Promise.all([
      admin.from("developers").update({ raid_xp: (attacker.raid_xp ?? 0) + XP_WIN_ATTACKER }).eq("id", attacker.id),
      admin.from("developers").update({ raid_xp: (defender.raid_xp ?? 0) + XP_WIN_DEFENDER }).eq("id", defender.id),
    ]);
    await admin.rpc("grant_xp_atomic", { p_developer_id: attacker.id, p_source: "raid_win", p_amount: 50 });
    await admin.rpc("grant_xp_atomic", { p_developer_id: defender.id, p_source: "raid_defend", p_amount: 30 });
  } else {
    await admin.from("developers").update({ raid_xp: (defender.raid_xp ?? 0) + XP_LOSE_DEFENDER }).eq("id", defender.id);
    await admin.rpc("grant_xp_atomic", { p_developer_id: attacker.id, p_source: "raid_loss", p_amount: 15 });
    await admin.rpc("grant_xp_atomic", { p_developer_id: defender.id, p_source: "raid_defend", p_amount: 30 });
  }

  await admin.from("activity_feed").insert({
    event_type: success ? "raid_success" : "raid_failed",
    actor_id: attacker.id,
    target_id: defender.id,
    metadata: {
      attacker_login: attacker.github_login,
      defender_login: defender.github_login,
      attack_score: attack.total,
      defense_score: defense.total,
    },
  });

  await touchLastActive(attacker.id);
  await trackDailyMission(attacker.id, "attempt_battle");
  if (success) await trackDailyMission(attacker.id, "win_battle");
  sendRaidAlertNotification(defender.id, defender.github_login, attacker.github_login, raidId, success, attack.total, defense.total);

  const newAttackerXp = (attacker.raid_xp ?? 0) + (success ? XP_WIN_ATTACKER : 0);
  const newDefenderXp = (defender.raid_xp ?? 0) + (success ? XP_WIN_DEFENDER : XP_LOSE_DEFENDER);

  const [attackerAchievements] = await Promise.all([
    checkAchievements(attacker.id, {
      contributions: attacker.contributions ?? 0,
      public_repos: attacker.public_repos ?? 0,
      total_stars: attacker.total_stars ?? 0,
      referral_count: 0,
      kudos_count: attacker.kudos_count ?? 0,
      gifts_sent: 0,
      gifts_received: 0,
      raid_xp: newAttackerXp,
      easy_solved: attacker.easy_solved ?? 0,
      medium_solved: attacker.medium_solved ?? 0,
      hard_solved: attacker.hard_solved ?? 0,
      contest_rating: attacker.contest_rating ?? 0,
      lc_streak: attacker.lc_streak ?? 0,
      total_prs: attacker.total_prs ?? 0,
    }, attacker.github_login),
    checkAchievements(defender.id, {
      contributions: defender.contributions ?? 0,
      public_repos: defender.public_repos ?? 0,
      total_stars: defender.total_stars ?? 0,
      referral_count: 0,
      kudos_count: defender.kudos_count ?? 0,
      gifts_sent: 0,
      gifts_received: 0,
      raid_xp: newDefenderXp,
      easy_solved: defender.easy_solved ?? 0,
      medium_solved: defender.medium_solved ?? 0,
      hard_solved: defender.hard_solved ?? 0,
      contest_rating: defender.contest_rating ?? 0,
      lc_streak: defender.lc_streak ?? 0,
      total_prs: defender.total_prs ?? 0,
    }, defender.github_login),
  ]);

  const xpEarned = success ? XP_WIN_ATTACKER : 0;

  return NextResponse.json({
    raid_id: raidId,
    success,
    attack_score: attack.total,
    defense_score: defense.total,
    attack_breakdown: attack.breakdown,
    defense_breakdown: defense.breakdown,
    attacker: {
      login: attacker.github_login,
      avatar: attacker.avatar_url,
      position: [0, 0, 0] as [number, number, number],
      height: Math.max(20, Math.min(300, (attacker.contributions ?? 0) * 0.15)),
    },
    defender: {
      login: defender.github_login,
      avatar: defender.avatar_url,
      position: [0, 0, 0] as [number, number, number],
      height: Math.max(20, Math.min(300, (defender.contributions ?? 0) * 0.15)),
    },
    xp_earned: xpEarned,
    new_raid_xp: newAttackerXp,
    new_title: getRaidTitle(newAttackerXp),
    new_achievements: attackerAchievements,
    vehicle,
    tag_style: tagStyle,
  });
}