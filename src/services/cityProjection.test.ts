import { describe, expect, it } from "vitest";
import { buildDeveloperProjection } from "./cityProjection";

describe("cityProjection", () => {
  it("normalizes defaults and strips empty payload values", () => {
    const payload = buildDeveloperProjection({
      id: 1,
      github_login: "octocat",
      contributions: 10,
      total_stars: 2,
      public_repos: 3,
      claimed: false,
      kudos_count: 0,
      visit_count: 0,
      app_streak: 0,
      raid_xp: 0,
      rabbit_completed: false,
      xp_total: 0,
      xp_level: 1,
      building_style: "tower",
      loadout: { crown: null, roof: null, aura: null, faces: null },
      active_raid_tag: { attacker_login: "", tag_style: "", expires_at: "" },
      owned_items: [],
      achievements: [],
      billboard_images: [],
      custom_color: null,
      selected_title: null,
    });

    expect(payload).toEqual({
      id: 1,
      github_login: "octocat",
      contributions: 10,
      total_stars: 2,
      public_repos: 3,
    });
  });
});
