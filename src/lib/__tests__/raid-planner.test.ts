import { describe, expect, it } from "vitest";
import {
  buildRaidOffensiveItems,
  buildRaidVehicleOptions,
  resolveRaidConsumableSelection,
  resolveRaidDefenses,
  resolveRaidLoadoutSelection,
} from "../raid-planner";

describe("raid planner", () => {
  it("preserves the current loadout selection rules", () => {
    const selected = resolveRaidLoadoutSelection({
      requestedVehicleId: "raid_ufo",
      savedVehicle: "raid_rocket",
      savedTag: "tag_fire",
      ownedItemIds: new Set(["raid_ufo", "tag_fire"]),
      xpLevel: 1,
    });

    expect(selected.vehicle).toBe("raid_ufo");
    expect(selected.tagStyle).toBe("tag_fire");
  });

  it("falls back to airplane and default tag when unlocks are missing", () => {
    const selected = resolveRaidLoadoutSelection({
      savedVehicle: "raid_ufo",
      savedTag: "tag_gold",
      ownedItemIds: new Set<string>(),
      xpLevel: 1,
    });

    expect(selected.vehicle).toBe("airplane");
    expect(selected.tagStyle).toBe("default");
  });

  it("resolves offensive consumables exactly like the service did before the split", () => {
    const result = resolveRaidConsumableSelection({
      consumableItemId: "emp_device",
      consumableRow: {
        quantity: 1,
        weekly_uses: 1,
        last_reset_week: "2026-08-03",
      },
      raidWeekStart: "2026-08-03",
      attackerXpLevel: 20,
    });

    expect(result.attackerConsumableItemId).toBe("emp_device");
  });

  it("nulls a defense when EMP is used", () => {
    const result = resolveRaidDefenses({
      defenderActiveDefenses: ["emp_shield"],
      attackerConsumableItemId: "emp_device",
      raidWeekStart: "2026-08-03",
    });

    expect(result.activeDefenses).toEqual(["emp_shield"]);
    expect(result.defenderItemUsed).toBe(true);
    expect(result.defenderEffectiveDefense).toBeNull();
  });

  it("builds vehicle options with owned extras after the base set", () => {
    const options = buildRaidVehicleOptions(new Set(["raid_ufo", "raid_rocket"]));

    expect(options.slice(0, 4).map((option) => option.item_id)).toEqual([
      "airplane",
      "raid_helicopter",
      "vehicle_tank",
      "raid_b2_bomber",
    ]);
    expect(options.map((option) => option.item_id)).toContain("raid_ufo");
    expect(options.map((option) => option.item_id)).toContain("raid_rocket");
  });

  it("filters consumed offensive items based on weekly uses", () => {
    const items = buildRaidOffensiveItems(
      [
        { item_id: "emp_device", quantity: 1, weekly_uses: 2, last_reset_week: "2026-08-03" },
        { item_id: "sabotage_virus", quantity: 0, weekly_uses: 0, last_reset_week: "2026-08-03" },
      ],
      "2026-08-03",
    );

    expect(items).toEqual([
      { item_id: "emp_device", quantity: 1, uses_left_this_week: 1 },
    ]);
  });
});