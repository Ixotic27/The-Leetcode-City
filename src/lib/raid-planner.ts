import type { SupabaseClient } from "@supabase/supabase-js";
import { ITEM_UNLOCK_LEVELS } from "@/lib/zones";
import { getUtcDateString } from "@/lib/week";
import type { RaidOffensiveItem, RaidVehicleOption } from "@/lib/raid";

export type RaidExecutionPayload = {
  target_login: string;
  boost_purchase_id?: number;
  consumable_item_id?: string;
  offensive_item_id?: string;
  vehicle_id?: string;
};

export type RaidDeveloper = {
  id: number;
  claimed?: boolean | null;
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

type RaidConsumableRow = {
  id?: string;
  quantity: number;
  weekly_uses: number;
  last_reset_week: string | null;
};

type RaidPurchaseRow = {
  id: number;
  item_id: string;
  items?: unknown;
};

type RaidDefenseRow = {
  item_id: string;
  quantity: number;
  weekly_uses: number;
  last_reset_week: string | null;
};

const BASE_RAID_VEHICLE_IDS = new Set(["airplane", "raid_helicopter", "vehicle_tank", "raid_b2_bomber"]);

export const RAID_VEHICLE_META: Record<string, { name: string; emoji: string; type: string }> = {
  airplane: { name: "Airplane", emoji: "✈️", type: "air" },
  raid_helicopter: { name: "Helicopter", emoji: "🚁", type: "air" },
  raid_drone: { name: "Stealth Drone", emoji: "🛸", type: "air" },
  raid_rocket: { name: "Rocket", emoji: "🚀", type: "air" },
  raid_b2_bomber: { name: "B-2 Bomber", emoji: "🛩️", type: "air" },
  raid_ufo: { name: "UFO", emoji: "👽", type: "air" },
  vehicle_tank: { name: "Heavy Tank", emoji: "🛡️", type: "ground" },
};

export function getRaidColumns(): string {
  return "id, claimed, github_login, avatar_url, contributions, public_repos, total_stars, kudos_count, app_streak, raid_xp, xp_level, current_week_contributions, current_week_kudos_given, current_week_kudos_received, last_raided_at, active_defenses, easy_solved, medium_solved, hard_solved, contest_rating, lc_streak, total_prs";
}

export async function loadRaidDefender(admin: SupabaseClient, targetLogin: string): Promise<RaidDeveloper | null> {
  const { data: defender } = await admin
    .from("developers")
    .select(getRaidColumns())
    .ilike("github_login", targetLogin)
    .limit(1)
    .maybeSingle();

  return defender as RaidDeveloper | null;
}

export function resolveRaidLoadoutSelection(inputs: {
  requestedVehicleId?: string;
  savedVehicle?: string | null;
  savedTag?: string | null;
  ownedItemIds: Set<string>;
  xpLevel: number;
}): { vehicle: string; tagStyle: string } {
  let vehicle = "airplane";
  const requestedVehicleId = inputs.requestedVehicleId;

  if (requestedVehicleId) {
    const isLevelUnlocked = ITEM_UNLOCK_LEVELS[requestedVehicleId] && inputs.xpLevel >= ITEM_UNLOCK_LEVELS[requestedVehicleId];
    if (
      requestedVehicleId === "airplane" ||
      requestedVehicleId === "raid_helicopter" ||
      requestedVehicleId === "vehicle_tank" ||
      requestedVehicleId === "raid_b2_bomber" ||
      inputs.ownedItemIds.has(requestedVehicleId) ||
      isLevelUnlocked
    ) {
      vehicle = requestedVehicleId;
    }
  } else {
    const saved = inputs.savedVehicle ?? "airplane";
    const isSavedLevelUnlocked = ITEM_UNLOCK_LEVELS[saved] && inputs.xpLevel >= ITEM_UNLOCK_LEVELS[saved];
    vehicle =
      saved === "airplane" ||
      saved === "raid_helicopter" ||
      saved === "vehicle_tank" ||
      saved === "raid_b2_bomber" ||
      inputs.ownedItemIds.has(saved) ||
      isSavedLevelUnlocked
        ? saved
        : "airplane";
  }

  const savedTag = inputs.savedTag ?? "default";
  const isTagLevelUnlocked = ITEM_UNLOCK_LEVELS[savedTag] && inputs.xpLevel >= ITEM_UNLOCK_LEVELS[savedTag];
  const tagStyle = savedTag === "default" || inputs.ownedItemIds.has(savedTag) || isTagLevelUnlocked ? savedTag : "default";

  return { vehicle, tagStyle };
}

export function resolveRaidConsumableSelection(inputs: {
  consumableItemId?: string | null;
  boostPurchaseId?: number;
  consumableRow?: RaidConsumableRow | null;
  boostPurchase?: RaidPurchaseRow | null;
  raidWeekStart: string;
  attackerXpLevel: number;
}): {
  boostBonus: number;
  boostItemId: string | null;
  boostPurchaseIdToConsume: number | null;
  attackerConsumableItemId: string | null;
} {
  const consumableItemId = inputs.consumableItemId ?? undefined;
  let boostBonus = 0;
  let boostItemId: string | null = null;
  let boostPurchaseIdToConsume: number | null = null;
  let attackerConsumableItemId: string | null = null;

  if (consumableItemId) {
    const consumable = inputs.consumableRow;
    const resetWeekStr = consumable?.last_reset_week ? getUtcDateString(consumable.last_reset_week) : null;

    if (consumable && consumable.quantity > 0) {
      let currentUses = consumable.weekly_uses;
      if (inputs.raidWeekStart !== resetWeekStr) currentUses = 0;
      if (currentUses < 3) attackerConsumableItemId = consumableItemId;
    } else {
      const reqLevel = ITEM_UNLOCK_LEVELS[consumableItemId];
      const isLevelUnlocked = reqLevel && inputs.attackerXpLevel >= reqLevel;
      if (isLevelUnlocked || consumableItemId === "scouting_satellite") {
        if (!consumable || consumable.weekly_uses < 3 || resetWeekStr !== inputs.raidWeekStart) {
          attackerConsumableItemId = consumableItemId;
        }
      }
    }
  } else if (inputs.boostPurchaseId) {
    const boostPurchase = inputs.boostPurchase;
    if (boostPurchase) {
      const meta = (boostPurchase.items as unknown as { metadata: { type: string; bonus: number } })?.metadata;
      if (meta?.type === "raid_boost" && meta.bonus > 0) {
        boostBonus = meta.bonus;
        boostItemId = boostPurchase.item_id;
        boostPurchaseIdToConsume = boostPurchase.id;
      }
    }
  }

  return { boostBonus, boostItemId, boostPurchaseIdToConsume, attackerConsumableItemId };
}

export function resolveRaidDefenses(inputs: {
  defenderActiveDefenses: unknown;
  availableDefenses?: RaidDefenseRow[] | null;
  attackerConsumableItemId: string | null;
  raidWeekStart: string;
}): {
  activeDefenses: string[];
  defenderItemUsed: boolean;
  defenderEffectiveDefense: string | null;
} {
  let activeDefenses: string[] = Array.isArray(inputs.defenderActiveDefenses) ? inputs.defenderActiveDefenses : [];
  let defenderItemUsed = false;

  if (activeDefenses.length > 0) {
    defenderItemUsed = true;
  } else if (inputs.availableDefenses && inputs.availableDefenses.length > 0) {
    for (const defense of inputs.availableDefenses) {
      let currentUses = defense.weekly_uses;
      if (!defense.last_reset_week || getUtcDateString(defense.last_reset_week) !== inputs.raidWeekStart) currentUses = 0;
      if (currentUses < 3) {
        activeDefenses = [defense.item_id];
        defenderItemUsed = true;
        break;
      }
    }
  }

  const isEmpDevice = inputs.attackerConsumableItemId === "emp_device";
  let defenderEffectiveDefense = activeDefenses.length > 0 ? activeDefenses[0] : null;
  if (isEmpDevice && defenderEffectiveDefense) defenderEffectiveDefense = null;

  return { activeDefenses, defenderItemUsed, defenderEffectiveDefense };
}

export function buildRaidVehicleOptions(ownedVehicleIds: Set<string>): RaidVehicleOption[] {
  return [
    { item_id: "airplane", name: "Airplane", emoji: "✈️" },
    { item_id: "raid_helicopter", name: "Helicopter", emoji: "🚁" },
    { item_id: "vehicle_tank", name: "Heavy Tank", emoji: "🛡️" },
    { item_id: "raid_b2_bomber", name: "B-2 Bomber", emoji: "🛩️" },
    ...Array.from(ownedVehicleIds)
      .filter((itemId) => RAID_VEHICLE_META[itemId] && !BASE_RAID_VEHICLE_IDS.has(itemId))
      .map((itemId) => ({ item_id: itemId, ...RAID_VEHICLE_META[itemId] })),
  ];
}

export function buildRaidOffensiveItems(
  consumables: RaidDefenseRow[],
  raidWeekStart: string,
): RaidOffensiveItem[] {
  return consumables
    .filter((consumable) => {
      if (consumable.quantity <= 0) return false;
      const lastReset = consumable.last_reset_week ? new Date(consumable.last_reset_week).toISOString().split("T")[0] : null;
      const weeklyUses = lastReset === raidWeekStart ? consumable.weekly_uses : 0;
      return weeklyUses < 3;
    })
    .map((consumable) => {
      const lastReset = consumable.last_reset_week ? new Date(consumable.last_reset_week).toISOString().split("T")[0] : null;
      const weeklyUses = lastReset === raidWeekStart ? consumable.weekly_uses : 0;
      return {
        item_id: consumable.item_id,
        quantity: consumable.quantity,
        uses_left_this_week: 3 - weeklyUses,
      };
    });
}
