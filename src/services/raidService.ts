import {
  calculateAttackScore,
  calculateDefenseScore,
  getRaidTitle,
  XP_WIN_ATTACKER,
  XP_WIN_DEFENDER,
  XP_LOSE_DEFENDER,
  type RaidExecuteResponse,
} from "@/lib/raid";
import { findRaidAttackerForUser } from "@/lib/raid-attacker";
import { coordinateRewardSideEffects } from "@/lib/rewardCoordinator";
import {
  getRaidColumns,
  loadRaidDefender,
  resolveRaidConsumableSelection,
  resolveRaidDefenses,
  resolveRaidLoadoutSelection,
  type RaidDeveloper,
  type RaidExecutionPayload,
} from "@/lib/raid-planner";
import { performRaidPostExecution } from "@/services/raid-post-execution";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export class RaidServiceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "RaidServiceError";
    this.status = status;
  }
}

export class RaidService {
  private readonly admin: SupabaseClient;
  private readonly user: User;
  private readonly payload: RaidExecutionPayload;
  private readonly raidWeekStart: string;

  constructor(admin: SupabaseClient, user: User, payload: RaidExecutionPayload, raidWeekStart: string) {
    this.admin = admin;
    this.user = user;
    this.payload = payload;
    this.raidWeekStart = raidWeekStart;
  }

  async execute(): Promise<{ status: number; body: RaidExecuteResponse }> {
    const [attacker, defender] = await Promise.all([
      findRaidAttackerForUser(this.admin, this.user, getRaidColumns()),
      loadRaidDefender(this.admin, this.payload.target_login),
    ]);

    if (!attacker || !attacker.claimed) {
      throw this.createError("Must claim building first", 403);
    }
    if (!defender) {
      throw this.createError("Target not found", 404);
    }
    if (attacker.id === defender.id) {
      throw this.createError("Cannot raid yourself", 409);
    }

    const [raidLoadout, ownedVehicleIds, consumableResolution] = await Promise.all([
      this.loadRaidLoadout(attacker.id),
      this.loadOwnedVehicleIds(attacker.id),
      this.resolveConsumables(attacker),
    ]);

    const { vehicle, tagStyle } = resolveRaidLoadoutSelection({
      requestedVehicleId: this.payload.vehicle_id,
      savedVehicle: raidLoadout?.vehicle ?? "airplane",
      savedTag: raidLoadout?.tag ?? "default",
      ownedItemIds: ownedVehicleIds,
      xpLevel: attacker.xp_level ?? 1,
    });

    const { boostBonus, boostItemId, boostPurchaseIdToConsume, attackerConsumableItemId } = consumableResolution;
    const { activeDefenses, defenderItemUsed, defenderEffectiveDefense } = await this.resolveDefenses(defender, attackerConsumableItemId);

    const isEmpDevice = attackerConsumableItemId === "emp_device";
    const isSabotageVirus = attackerConsumableItemId === "sabotage_virus";
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

    const { data: raidResult, error: raidError } = await this.admin.rpc("execute_raid", {
      p_attacker_id: attacker.id,
      p_defender_id: defender.id,
      p_attack_score: attack.total,
      p_defense_score: defense.total,
      p_success: success,
      p_attack_breakdown: attack.breakdown,
      p_defense_breakdown: defense.breakdown,
      p_vehicle: vehicle,
      p_tag_style: tagStyle,
      p_consumable_item_id: attackerConsumableItemId,
      p_week_start: this.raidWeekStart,
    });

    if (raidError) {
      console.error("[raid/execute] execute_raid RPC error:", raidError);
      throw this.createError("Raid temporarily unavailable", 500);
    }

    const result = raidResult?.[0] as { ok?: boolean; error_code?: string; raid_id?: string } | undefined;
    if (!result?.ok) {
      const errorMap: Record<string, { error: string; status: number }> = {
        cooldown: { error: "Too fast, wait before raiding again", status: 429 },
        daily_cap: { error: "Daily raid limit reached", status: 429 },
        peace_shield: { error: "Target has an active Peace Shield", status: 429 },
        weekly_pair: { error: "Already raided this target this week", status: 429 },
        consumable: { error: "Raid blocked", status: 429 },
      };
      const mapped = errorMap[result?.error_code ?? ""] ?? { error: "Raid blocked", status: 429 };
      throw this.createError(mapped.error, mapped.status);
    }

    const raidId = result.raid_id ?? "";

    await performRaidPostExecution(
      this.admin,
      attacker,
      defender,
      { boostPurchaseIdToConsume, defenderItemUsed, activeDefenses, success, raidId, vehicle, tagStyle, attack, defense, attackerConsumableItemId, defenderEffectiveDefense },
      this.raidWeekStart,
    );

    const [updatedAttackerResult, updatedDefenderResult] = await Promise.all([
      this.admin.from("developers").select("raid_xp").eq("id", attacker.id).maybeSingle(),
      this.admin.from("developers").select("raid_xp").eq("id", defender.id).maybeSingle(),
    ]);

    const updatedAttacker = updatedAttackerResult.data as { raid_xp?: number | null } | null;
    const updatedDefender = updatedDefenderResult.data as { raid_xp?: number | null } | null;

    const newAttackerXp = updatedAttacker?.raid_xp ?? ((attacker.raid_xp ?? 0) + (success ? XP_WIN_ATTACKER : 0));
    const newDefenderXp = updatedDefender?.raid_xp ?? ((defender.raid_xp ?? 0) + (success ? XP_WIN_DEFENDER : XP_LOSE_DEFENDER));

    // Coordinate achievement checks for both attacker and defender (no additional XP grants)
    const [attackerAchievementsResult] = await Promise.all([
      coordinateRewardSideEffects(this.admin as never, {
        developerId: attacker.id,
        actorLogin: attacker.github_login,
        stats: {
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
        },
        xpGrants: [], // XP already granted in handlePostExecution
        feedEvent: undefined, // Raid feed event already written in handlePostExecution
      }),
      coordinateRewardSideEffects(this.admin as never, {
        developerId: defender.id,
        actorLogin: defender.github_login,
        stats: {
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
        },
        xpGrants: [], // XP already granted in handlePostExecution
        feedEvent: undefined, // Raid feed event already written in handlePostExecution
      }),
    ]);

    const attackerAchievements = attackerAchievementsResult.newAchievements;

    const xpEarned = success ? XP_WIN_ATTACKER : 0;

    return {
      status: 200,
      body: {
        raid_id: raidId,
        success,
        attack_score: attack.total,
        defense_score: defense.total,
        attack_breakdown: attack.breakdown,
        defense_breakdown: defense.breakdown,
        attacker: {
          login: attacker.github_login,
          avatar: attacker.avatar_url ?? null,
          position: [0, 0, 0] as [number, number, number],
          height: Math.max(20, Math.min(300, (attacker.contributions ?? 0) * 0.15)),
        },
        defender: {
          login: defender.github_login,
          avatar: defender.avatar_url ?? null,
          position: [0, 0, 0] as [number, number, number],
          height: Math.max(20, Math.min(300, (defender.contributions ?? 0) * 0.15)),
        },
        xp_earned: xpEarned,
        new_raid_xp: newAttackerXp,
        new_title: getRaidTitle(newAttackerXp),
        new_achievements: attackerAchievements,
        vehicle,
        tag_style: tagStyle,
      },
    };
  }

  private async loadRaidLoadout(developerId: number): Promise<{ vehicle?: string; tag?: string } | null> {
    const { data } = await this.admin
      .from("developer_customizations")
      .select("config")
      .eq("developer_id", developerId)
      .eq("item_id", "raid_loadout")
      .maybeSingle();

    return (data?.config as { vehicle?: string; tag?: string } | null) ?? null;
  }

  private async loadOwnedVehicleIds(developerId: number): Promise<Set<string>> {
    const [ownedPurchases, giftedPurchases] = await Promise.all([
      this.admin
        .from("purchases")
        .select("item_id")
        .eq("developer_id", developerId)
        .is("gifted_to", null)
        .eq("status", "completed"),
      this.admin
        .from("purchases")
        .select("item_id")
        .eq("gifted_to", developerId)
        .eq("status", "completed"),
    ]);

    const itemIds = [
      ...(ownedPurchases.data ?? []).map((purchase: { item_id: string }) => purchase.item_id),
      ...(giftedPurchases.data ?? []).map((purchase: { item_id: string }) => purchase.item_id),
    ];

    return new Set(itemIds);
  }

  private async resolveConsumables(attacker: RaidDeveloper): Promise<{ boostBonus: number; boostItemId: string | null; boostPurchaseIdToConsume: number | null; attackerConsumableItemId: string | null }> {
    const consumableItemId = this.payload.offensive_item_id ?? this.payload.consumable_item_id;
    let consumableRow: { id?: string; quantity: number; weekly_uses: number; last_reset_week: string | null } | null = null;
    let boostPurchase: { id: number; item_id: string; items?: unknown } | null = null;

    if (consumableItemId) {
      const { data } = await this.admin
        .from("developer_consumables")
        .select("id, quantity, weekly_uses, last_reset_week")
        .eq("developer_id", attacker.id)
        .eq("item_id", consumableItemId)
        .single();
      consumableRow = (data as { id?: string; quantity: number; weekly_uses: number; last_reset_week: string | null } | null) ?? null;
    } else if (this.payload.boost_purchase_id) {
      const { data } = await this.admin
        .from("purchases")
        .select("id, item_id, status, items!inner(metadata)")
        .eq("id", this.payload.boost_purchase_id)
        .eq("developer_id", attacker.id)
        .eq("status", "completed")
        .single();
      boostPurchase = (data as { id: number; item_id: string; items?: unknown } | null) ?? null;
    }

    return resolveRaidConsumableSelection({
      consumableItemId,
      boostPurchaseId: this.payload.boost_purchase_id,
      consumableRow,
      boostPurchase,
      raidWeekStart: this.raidWeekStart,
      attackerXpLevel: attacker.xp_level ?? 1,
    });
  }

  private async resolveDefenses(defender: RaidDeveloper, attackerConsumableItemId: string | null): Promise<{ activeDefenses: string[]; defenderItemUsed: boolean; defenderEffectiveDefense: string | null }> {
    const activeDefenses = Array.isArray(defender.active_defenses) ? defender.active_defenses : [];
    const availableDefenses = activeDefenses.length > 0
      ? null
      : ((await this.admin
        .from("developer_consumables")
        .select("item_id, quantity, weekly_uses, last_reset_week")
        .eq("developer_id", defender.id)
        .gt("quantity", 0)).data as Array<{ item_id: string; quantity: number; weekly_uses: number; last_reset_week: string | null }> | null);

    return resolveRaidDefenses({
      defenderActiveDefenses: defender.active_defenses,
      availableDefenses,
      attackerConsumableItemId,
      raidWeekStart: this.raidWeekStart,
    });
  }

  private createError(message: string, status: number): RaidServiceError {
    return new RaidServiceError(message, status);
  }
}
