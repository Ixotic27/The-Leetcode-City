import { coordinateRewardSideEffects } from "@/lib/rewardCoordinator";
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
  type RaidExecuteResponse,
  type ScoreBreakdown,
} from "@/lib/raid";
import { findRaidAttackerForUser } from "@/lib/raid-attacker";
import { ITEM_UNLOCK_LEVELS } from "@/lib/zones";
import { getUtcDateString } from "@/lib/week";
import type { SupabaseClient, User } from "@supabase/supabase-js";

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
      findRaidAttackerForUser(this.admin, this.user, this.getRaidColumns()),
      this.loadDefender(),
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

    const { vehicle, tagStyle } = await this.resolveLoadout(attacker);
    const { boostBonus, boostItemId, boostPurchaseIdToConsume, attackerConsumableItemId } = await this.resolveConsumables(attacker);
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

    await this.handlePostExecution(attacker, defender, { boostPurchaseIdToConsume, defenderItemUsed, activeDefenses, success, raidId, vehicle, tagStyle, attack, defense, attackerConsumableItemId, defenderEffectiveDefense });

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

  private getRaidColumns(): string {
    return "id, claimed, github_login, avatar_url, contributions, public_repos, total_stars, kudos_count, app_streak, raid_xp, xp_level, current_week_contributions, current_week_kudos_given, current_week_kudos_received, last_raided_at, active_defenses, easy_solved, medium_solved, hard_solved, contest_rating, lc_streak, total_prs";
  }

  private async loadDefender(): Promise<RaidDeveloper | null> {
    const { data: defender } = await this.admin.from("developers").select(this.getRaidColumns()).ilike("github_login", this.payload.target_login).limit(1).maybeSingle();
    return defender as RaidDeveloper | null;
  }

  private async resolveLoadout(attacker: RaidDeveloper): Promise<{ vehicle: string; tagStyle: string }> {
    const [{ data: raidLoadoutRow }, { data: ownedVehiclePurchases }] = await Promise.all([
      this.admin.from("developer_customizations").select("config").eq("developer_id", attacker.id).eq("item_id", "raid_loadout").maybeSingle(),
      this.admin.from("purchases").select("item_id, items!inner(metadata)").eq("developer_id", attacker.id).eq("status", "completed"),
    ]);

    const ownedSet = new Set((ownedVehiclePurchases ?? []).map((p: { item_id: string }) => p.item_id));
    const savedLoadout = (raidLoadoutRow?.config as { vehicle?: string; tag?: string } | null) ?? {};
    const xpLevel = attacker.xp_level ?? 1;

    let vehicle = "airplane";
    if (this.payload.vehicle_id) {
      const isLevelUnlocked = ITEM_UNLOCK_LEVELS[this.payload.vehicle_id] && xpLevel >= ITEM_UNLOCK_LEVELS[this.payload.vehicle_id];
      if (
        this.payload.vehicle_id === "airplane" ||
        this.payload.vehicle_id === "raid_helicopter" ||
        this.payload.vehicle_id === "vehicle_tank" ||
        this.payload.vehicle_id === "raid_b2_bomber" ||
        ownedSet.has(this.payload.vehicle_id) ||
        isLevelUnlocked
      ) {
        vehicle = this.payload.vehicle_id;
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

    return { vehicle, tagStyle };
  }

  private async resolveConsumables(attacker: RaidDeveloper): Promise<{ boostBonus: number; boostItemId: string | null; boostPurchaseIdToConsume: number | null; attackerConsumableItemId: string | null }> {
    const consumable_item_id = this.payload.offensive_item_id ?? this.payload.consumable_item_id;
    let boostBonus = 0;
    let boostItemId: string | null = null;
    let boostPurchaseIdToConsume: number | null = null;
    let attackerConsumableItemId: string | null = null;

    if (consumable_item_id) {
      const { data: consumable } = await this.admin.from("developer_consumables").select("id, quantity, weekly_uses, last_reset_week").eq("developer_id", attacker.id).eq("item_id", consumable_item_id).single();
      const resetWeekStr = consumable?.last_reset_week ? getUtcDateString(consumable.last_reset_week) : null;

      if (consumable && consumable.quantity > 0) {
        let currentUses = consumable.weekly_uses;
        if (this.raidWeekStart !== resetWeekStr) currentUses = 0;
        if (currentUses < 3) attackerConsumableItemId = consumable_item_id;
      } else {
        const reqLevel = ITEM_UNLOCK_LEVELS[consumable_item_id];
        const isLevelUnlocked = reqLevel && (attacker.xp_level ?? 1) >= reqLevel;
        if (isLevelUnlocked || consumable_item_id === "scouting_satellite") {
          if (!consumable || consumable.weekly_uses < 3 || resetWeekStr !== this.raidWeekStart) {
            attackerConsumableItemId = consumable_item_id;
          }
        }
      }
    } else if (this.payload.boost_purchase_id) {
      const { data: boostPurchase } = await this.admin.from("purchases").select("id, item_id, status, items!inner(metadata)").eq("id", this.payload.boost_purchase_id).eq("developer_id", attacker.id).eq("status", "completed").single();
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

  private async resolveDefenses(defender: RaidDeveloper, attackerConsumableItemId: string | null): Promise<{ activeDefenses: string[]; defenderItemUsed: boolean; defenderEffectiveDefense: string | null }> {
    let activeDefenses: string[] = Array.isArray(defender.active_defenses) ? defender.active_defenses : [];
    let defenderItemUsed = false;

    if (activeDefenses.length > 0) {
      defenderItemUsed = true;
    } else {
      const { data: availableDefenses } = await this.admin.from("developer_consumables").select("item_id, quantity, weekly_uses, last_reset_week").eq("developer_id", defender.id).gt("quantity", 0);

      if (availableDefenses && availableDefenses.length > 0) {
        for (const def of availableDefenses) {
          let currentUses = def.weekly_uses;
          if (getUtcDateString(def.last_reset_week) !== this.raidWeekStart) currentUses = 0;
          if (currentUses < 3) {
            activeDefenses = [def.item_id];
            defenderItemUsed = true;
            break;
          }
        }
      }
    }

    const isEmpDevice = attackerConsumableItemId === "emp_device";
    let defenderEffectiveDefense = activeDefenses.length > 0 ? activeDefenses[0] : null;
    if (isEmpDevice && defenderEffectiveDefense) defenderEffectiveDefense = null;

    return { activeDefenses, defenderItemUsed, defenderEffectiveDefense };
  }

  private async handlePostExecution(attacker: RaidDeveloper, defender: RaidDeveloper, details: { boostPurchaseIdToConsume: number | null; defenderItemUsed: boolean; activeDefenses: string[]; success: boolean; raidId?: string; vehicle: string; tagStyle: string; attack: { total: number; breakdown: ScoreBreakdown }; defense: { total: number; breakdown: ScoreBreakdown }; attackerConsumableItemId: string | null; defenderEffectiveDefense: string | null }): Promise<void> {
    if (details.boostPurchaseIdToConsume) {
      await this.admin.from("purchases").update({ status: "consumed" }).eq("id", details.boostPurchaseIdToConsume);
    }
    if (details.defenderItemUsed && details.activeDefenses.length > 0) {
      await this.consumeDeveloperItem(defender.id, details.activeDefenses[0]);
    }

    if (details.success) {
      await this.admin.from("raid_tags").update({ active: false }).eq("building_id", defender.id).eq("active", true);
      await this.admin.from("raid_tags").insert({
        raid_id: details.raidId,
        building_id: defender.id,
        attacker_id: attacker.id,
        attacker_login: attacker.github_login,
        tag_style: details.tagStyle,
        expires_at: new Date(Date.now() + RAID_TAG_DURATION_DAYS * 86400000).toISOString(),
      });

      await Promise.all([
        this.admin.rpc("increment_raid_xp", { p_developer_id: attacker.id, p_amount: XP_WIN_ATTACKER }),
        this.admin.rpc("increment_raid_xp", { p_developer_id: defender.id, p_amount: XP_WIN_DEFENDER }),
      ]);
      await this.admin.rpc("grant_xp_atomic", { p_developer_id: attacker.id, p_source: "raid_win", p_amount: 50 });
      await this.admin.rpc("grant_xp_atomic", { p_developer_id: defender.id, p_source: "raid_defend", p_amount: 30 });

      try {
        const { data: newWins, error: relicErr } = await this.admin.rpc("increment_relic_progress", {
          p_developer_id: attacker.id,
          p_field: "raid_wins",
        });

        if (relicErr) {
          console.error("[raid/execute] increment_relic_progress error:", relicErr);
        } else if ((newWins ?? 0) >= 1) {
          await this.admin.from("developer_relics").upsert(
            {
              developer_id: attacker.id,
              relic_id: "relic_requiem_void_core",
              is_equipped: false,
              created_at: new Date().toISOString(),
            },
            { onConflict: "developer_id,relic_id" },
          );
        }
      } catch (err) {
        console.error("[raid/execute] Failed to track raid win for relic:", err);
      }
    } else {
      await this.admin.rpc("increment_raid_xp", { p_developer_id: defender.id, p_amount: XP_LOSE_DEFENDER });
      await this.admin.rpc("grant_xp_atomic", { p_developer_id: attacker.id, p_source: "raid_loss", p_amount: 15 });
      await this.admin.rpc("grant_xp_atomic", { p_developer_id: defender.id, p_source: "raid_defend", p_amount: 30 });
    }

    await this.admin.from("activity_feed").insert({
      event_type: details.success ? "raid_success" : "raid_failed",
      actor_id: attacker.id,
      target_id: defender.id,
      metadata: {
        attacker_login: attacker.github_login,
        defender_login: defender.github_login,
        attack_score: details.attack.total,
        defense_score: details.defense.total,
      },
    });

    await touchLastActive(attacker.id);
    await trackDailyMission(attacker.id, "attempt_battle");
    if (details.success) await trackDailyMission(attacker.id, "win_battle");
    sendRaidAlertNotification(defender.id, defender.github_login, attacker.github_login, details.raidId ?? 0, details.success, details.attack.total, details.defense.total);
  }

  private async consumeDeveloperItem(devId: number, itemId: string): Promise<boolean> {
    const { data, error } = await this.admin.rpc("consume_consumable", {
      p_developer_id: devId,
      p_item_id: itemId,
      p_week_start: this.raidWeekStart,
    });

    if (error) {
      console.error("[raid/execute] consume_consumable RPC error:", error);
      return false;
    }

    return data === true;
  }

  private createError(message: string, status: number): RaidServiceError {
    return new RaidServiceError(message, status);
  }
}
