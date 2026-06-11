import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";
import {
  calculateAttackScore,
  calculateDefenseScore,
  getStrengthEstimate,
  MAX_RAIDS_PER_DAY,
} from "@/lib/raid";
import type { RaidBoostItem } from "@/lib/raid";
import { findRaidAttackerForUser } from "@/lib/raid-attacker";
import { getIsoWeekStart } from "@/lib/week";

type RaidDefender = {
  id: number;
  claimed: boolean;
  app_streak?: number | null;
  avatar_url?: string | null;
  github_login: string;
  contributions?: number | null;
  current_week_contributions?: number | null;
  current_week_kudos_received?: number | null;
  last_raided_at?: string | null;
  active_defenses?: unknown;
  public_repos?: number | null;
  total_stars?: number | null;
  kudos_count?: number | null;
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

  const { ok } = rateLimit(`raid-preview:${user.id}`, 5, 10_000);
  if (!ok) {
    return NextResponse.json({ error: "Too fast" }, { status: 429 });
  }

  const { target_login } = await request.json();
  if (!target_login || typeof target_login !== "string") {
    return NextResponse.json({ error: "Missing target_login" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const attackerColumns = "id, claimed, app_streak, github_login, avatar_url, current_week_contributions, current_week_kudos_given";

  // Fetch attacker
  const attacker = await findRaidAttackerForUser(admin, user, attackerColumns);

  if (!attacker) {
    return NextResponse.json(
      {
        error:
          "Your LeetCode stats are still being synced. Please check back in a few minutes!",
      },
      { status: 403 }
    );
  }

  if (!attacker.claimed) {
    return NextResponse.json(
      { error: "Must claim building first" },
      { status: 403 }
    );
  }

  // Compile attacker's owned items from purchases
  const [purchasesRes, giftPurchasesRes] = await Promise.all([
    admin
      .from("purchases")
      .select("item_id")
      .eq("developer_id", attacker.id)
      .is("gifted_to", null)
      .eq("status", "completed"),
    admin
      .from("purchases")
      .select("item_id")
      .eq("gifted_to", attacker.id)
      .eq("status", "completed"),
  ]);

  attacker.owned_items = [
    ...(purchasesRes.data ?? []).map((p) => p.item_id),
    ...(giftPurchasesRes.data ?? []).map((p) => p.item_id),
  ];

  // Fetch defender
  const defenderRes = await admin
    .from("developers")
    .select("id, claimed, app_streak, avatar_url, github_login, contributions, current_week_contributions, current_week_kudos_received, last_raided_at, active_defenses")
    .eq("github_login", target_login.toLowerCase())
    .single();

  const defender = defenderRes.data as RaidDefender | null;

  if (!defender) {
    return NextResponse.json({ error: "Target not found" }, { status: 404 });
  }

  // No self-raid
  if (attacker.id === defender.id) {
    return NextResponse.json({ error: "Cannot raid yourself" }, { status: 409 });
  }

  // Check daily raid count
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  let raidsToday = 0;
  let targetRaidedThisWeek = false;
  try {
    const { count } = await admin
      .from("raids")
      .select("id", { count: "exact", head: true })
      .eq("attacker_id", attacker.id)
      .gte("created_at", todayStart.toISOString());
    raidsToday = count ?? 0;

    const isDeveloper = attacker.github_login?.toLowerCase() === "ishant_27";

    if (raidsToday >= MAX_RAIDS_PER_DAY && !isDeveloper) {
      return NextResponse.json({ error: "Daily raid limit reached" }, { status: 429 });
    }

    // Check weekly cooldown for this target
    const now = new Date();
    const isoWeekStart = getIsoWeekStart();

    const { count: weeklyPairCount } = await admin
      .from("raids")
      .select("id", { count: "exact", head: true })
      .eq("attacker_id", attacker.id)
      .eq("defender_id", defender.id)
      .gte("created_at", isoWeekStart.toISOString());

    targetRaidedThisWeek = (weeklyPairCount ?? 0) > 0 && !isDeveloper;
    if (targetRaidedThisWeek) {
      return NextResponse.json({ error: "Already raided this target this week" }, { status: 429 });
    }

    // Check 2-hour peace shield
    if (defender.last_raided_at) {
      const lastRaided = new Date(defender.last_raided_at);
      const shieldExpires = new Date(lastRaided.getTime() + 2 * 60 * 60 * 1000);
      if (now < shieldExpires) {
        return NextResponse.json({ error: "Target has an active Peace Shield" }, { status: 429 });
      }
    }
  } catch (err) {
    console.warn("[app/api/raid/preview/route.ts] non-critical error:", err);
  }
  // Active Defenses
  const activeDefenses: string[] = Array.isArray(defender.active_defenses) ? defender.active_defenses : [];
  const hasSatellite = (attacker.owned_items ?? []).includes("scouting_satellite");

  // If attacker has Tactical Satellite, reveal all defenses. Otherwise just the first one.
  const defenderScoutedDefense = hasSatellite
    ? (activeDefenses.length > 0 ? activeDefenses.join(", ") : null)
    : (activeDefenses.length > 0 ? activeDefenses[0] : null);
  const isStealthCloak = defenderScoutedDefense?.includes("stealth_cloak") ?? false;
  const isEmpShield = defenderScoutedDefense?.includes("emp_shield") ?? false;
  const isAntiMissile = defenderScoutedDefense?.includes("anti_missile_system") ?? false;
  const isAntiTank = defenderScoutedDefense?.includes("anti_tank_mines") ?? false;

  // Calculate base defense (won't include the +50% from active items because preview doesn't know attacker's vehicle yet)
  const defense = calculateDefenseScore({
    weeklyContributions: isStealthCloak ? 0 : defender.current_week_contributions ?? 0,
    appStreak: isStealthCloak ? 0 : defender.app_streak ?? 0,
    weeklyKudosReceived: isStealthCloak ? 0 : defender.current_week_kudos_received ?? 0,
  });

  // Fetch available boosts, owned vehicles, saved raid loadout, and offensive consumables
  const [{ data: boostPurchases }, { data: vehiclePurchases }, { data: raidLoadoutRow }, { data: offensiveConsumables }] = await Promise.all([
    admin
      .from("purchases")
      .select("id, item_id, items!inner(name, metadata)")
      .eq("developer_id", attacker.id)
      .eq("status", "completed")
      .eq("items.metadata->>type", "raid_boost"),
    admin
      .from("purchases")
      .select("item_id, items!inner(metadata)")
      .eq("developer_id", attacker.id)
      .eq("status", "completed")
      .eq("items.metadata->>type", "raid_vehicle"),
    admin
      .from("developer_customizations")
      .select("config")
      .eq("developer_id", attacker.id)
      .eq("item_id", "raid_loadout")
      .maybeSingle(),
    admin
      .from("developer_consumables")
      .select("item_id, quantity, weekly_uses, last_reset_week")
      .eq("developer_id", attacker.id)
      .in("item_id", ["emp_device", "sabotage_virus"]),
  ]);

  const availableBoosts: RaidBoostItem[] = (boostPurchases ?? []).map((p) => {
    const item = p.items as unknown as { name: string; metadata: { bonus: number } };
    return {
      purchase_id: p.id,
      item_id: p.item_id,
      name: item.name,
      bonus: item.metadata?.bonus ?? 0,
    };
  });

  // Build available vehicles list (always includes default airplane)
  const VEHICLE_META: Record<string, { name: string; emoji: string; type: string }> = {
    airplane: { name: "Airplane", emoji: "✈️", type: "air" },
    raid_helicopter: { name: "Helicopter", emoji: "🚁", type: "air" },
    raid_drone: { name: "Stealth Drone", emoji: "🛸", type: "air" },
    raid_rocket: { name: "Rocket", emoji: "🚀", type: "air" },
    raid_b2_bomber: { name: "B-2 Bomber", emoji: "🛩️", type: "air" },
    raid_ufo: { name: "UFO", emoji: "👽", type: "air" },
    vehicle_tank: { name: "Heavy Tank", emoji: "🛡️", type: "ground" },
  };

  const ownedVehicleIds = new Set((vehiclePurchases ?? []).map((p) => p.item_id));
  const available_vehicles = [
    { item_id: "airplane", name: "Airplane", emoji: "✈️" },
    { item_id: "raid_helicopter", name: "Helicopter", emoji: "🚁" },
    { item_id: "vehicle_tank", name: "Heavy Tank", emoji: "🛡️" },
    { item_id: "raid_b2_bomber", name: "B-2 Bomber", emoji: "🛩️" },
    ...Array.from(ownedVehicleIds)
      .filter((id) => VEHICLE_META[id] && id !== "raid_helicopter" && id !== "vehicle_tank" && id !== "raid_b2_bomber")
      .map((id) => ({ item_id: id, ...VEHICLE_META[id] })),
  ];

  // Use saved selection, fallback to airplane
  const savedLoadout = (raidLoadoutRow?.config as { vehicle?: string } | null) ?? {};
  let vehicle = savedLoadout.vehicle ?? "airplane";
  if (
    vehicle !== "airplane" &&
    vehicle !== "raid_helicopter" &&
    vehicle !== "vehicle_tank" &&
    vehicle !== "raid_b2_bomber" &&
    !ownedVehicleIds.has(vehicle)
  ) {
    vehicle = "airplane";
  }

  // Calculate scores
  const attack = calculateAttackScore({
    weeklyContributions: attacker.current_week_contributions ?? 0,
    appStreak: attacker.app_streak ?? 0,
    weeklyKudosGiven: attacker.current_week_kudos_given ?? 0,
    empShieldActive: isEmpShield,
    vehicle,
  });

  // Estimate building height from contributions
  const defenderHeight = Math.max(
    20,
    Math.min(300, (defender.contributions ?? 0) * 0.15)
  );

  // Compute available offensive consumables (must have qty > 0 and < 3 weekly uses)
  const currentWeekStr = getIsoWeekStart().toISOString().split('T')[0];
  const availableOffensiveItems = (offensiveConsumables ?? []).filter(c => {
    if (c.quantity <= 0) return false;
    const lastReset = c.last_reset_week ? new Date(c.last_reset_week).toISOString().split('T')[0] : null;
    const weeklyUses = lastReset === currentWeekStr ? c.weekly_uses : 0;
    return weeklyUses < 3;
  }).map(c => {
    const lastReset = c.last_reset_week ? new Date(c.last_reset_week).toISOString().split('T')[0] : null;
    const weeklyUses = lastReset === currentWeekStr ? c.weekly_uses : 0;
    return {
      item_id: c.item_id,
      quantity: c.quantity,
      uses_left_this_week: 3 - weeklyUses,
    };
  });

  return NextResponse.json({
    can_raid: true,
    raids_today: raidsToday ?? 0,
    raids_max: MAX_RAIDS_PER_DAY,
    target_raided_this_week: false,
    attack_estimate: getStrengthEstimate(attack.total),
    defense_estimate: getStrengthEstimate(defense.total),
    attack_score: attack.total,
    defense_score: defense.total,
    attack_breakdown: attack.breakdown,
    defense_breakdown: defense.breakdown,
    attacker_login: attacker.github_login ?? "",
    defender_login: defender.github_login,
    attacker_avatar: attacker.avatar_url ?? null,
    defender_avatar: isStealthCloak ? null : defender.avatar_url ?? null,
    defender_building_height: isStealthCloak ? 0 : defenderHeight,
    defender_scouted_defense: defenderScoutedDefense,
    defender_defense_type: isAntiMissile ? "air" : isAntiTank ? "ground" : isEmpShield ? "all" : isStealthCloak ? "stealth" : null,
    available_boosts: availableBoosts,
    available_vehicles,
    available_offensive_items: availableOffensiveItems,
    vehicle,
  });
}
