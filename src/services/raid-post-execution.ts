import type { SupabaseClient } from "@supabase/supabase-js";
import { touchLastActive } from "@/lib/notification-helpers";
import { sendRaidAlertNotification } from "@/lib/notification-senders/raid";
import { trackDailyMission } from "@/lib/dailies";
import { RAID_TAG_DURATION_DAYS, XP_WIN_ATTACKER, XP_WIN_DEFENDER, XP_LOSE_DEFENDER, type ScoreBreakdown } from "@/lib/raid";
import type { RaidDeveloper } from "@/lib/raid-planner";

export type RaidPostExecutionDetails = {
  boostPurchaseIdToConsume: number | null;
  defenderItemUsed: boolean;
  activeDefenses: string[];
  success: boolean;
  raidId?: string;
  vehicle: string;
  tagStyle: string;
  attack: { total: number; breakdown: ScoreBreakdown };
  defense: { total: number; breakdown: ScoreBreakdown };
  attackerConsumableItemId: string | null;
  defenderEffectiveDefense: string | null;
};

type RaidAdminClient = Pick<SupabaseClient, "from" | "rpc">;

async function consumeDeveloperItem(admin: RaidAdminClient, devId: number, itemId: string, raidWeekStart: string): Promise<boolean> {
  const { data, error } = await admin.rpc("consume_consumable", {
    p_developer_id: devId,
    p_item_id: itemId,
    p_week_start: raidWeekStart,
  });

  if (error) {
    console.error("[raid/execute] consume_consumable RPC error:", error);
    return false;
  }

  return data === true;
}

export async function performRaidPostExecution(
  admin: RaidAdminClient,
  attacker: RaidDeveloper,
  defender: RaidDeveloper,
  details: RaidPostExecutionDetails,
  raidWeekStart: string,
): Promise<void> {
  if (details.boostPurchaseIdToConsume) {
    await admin.from("purchases").update({ status: "consumed" }).eq("id", details.boostPurchaseIdToConsume);
  }

  if (details.defenderItemUsed && details.activeDefenses.length > 0) {
    await consumeDeveloperItem(admin, defender.id, details.activeDefenses[0], raidWeekStart);
  }

  if (details.success) {
    await admin.from("raid_tags").update({ active: false }).eq("building_id", defender.id).eq("active", true);
    await admin.from("raid_tags").insert({
      raid_id: details.raidId,
      building_id: defender.id,
      attacker_id: attacker.id,
      attacker_login: attacker.github_login,
      tag_style: details.tagStyle,
      expires_at: new Date(Date.now() + RAID_TAG_DURATION_DAYS * 86400000).toISOString(),
    });

    await Promise.all([
      admin.rpc("increment_raid_xp", { p_developer_id: attacker.id, p_amount: XP_WIN_ATTACKER }),
      admin.rpc("increment_raid_xp", { p_developer_id: defender.id, p_amount: XP_WIN_DEFENDER }),
    ]);
    await admin.rpc("grant_xp_atomic", { p_developer_id: attacker.id, p_source: "raid_win", p_amount: 50 });
    await admin.rpc("grant_xp_atomic", { p_developer_id: defender.id, p_source: "raid_defend", p_amount: 30 });

    try {
      const { data: newWins, error: relicErr } = await admin.rpc("increment_relic_progress", {
        p_developer_id: attacker.id,
        p_field: "raid_wins",
      });

      if (relicErr) {
        console.error("[raid/execute] increment_relic_progress error:", relicErr);
      } else if ((newWins ?? 0) >= 1) {
        await admin.from("developer_relics").upsert(
          {
            developer_id: attacker.id,
            relic_id: "relic_requiem_void_core",
            is_equipped: false,
            created_at: new Date().toISOString(),
          },
          { onConflict: "developer_id,relic_id" },
        );
      }
    } catch (error) {
      console.error("[raid/execute] Failed to track raid win for relic:", error);
    }
  } else {
    await admin.rpc("increment_raid_xp", { p_developer_id: defender.id, p_amount: XP_LOSE_DEFENDER });
    await admin.rpc("grant_xp_atomic", { p_developer_id: attacker.id, p_source: "raid_loss", p_amount: 15 });
    await admin.rpc("grant_xp_atomic", { p_developer_id: defender.id, p_source: "raid_defend", p_amount: 30 });
  }

  await admin.from("activity_feed").insert({
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
