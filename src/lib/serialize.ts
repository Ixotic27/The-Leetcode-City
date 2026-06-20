export function serializeDeveloper(dev: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};

  // Keep these vital fields as-is
  const alwaysKeep = ["id", "github_login", "contributions", "total_stars", "public_repos"];
  for (const key of alwaysKeep) {
    if (dev[key] !== undefined) {
      result[key] = dev[key];
    }
  }

  // Iterate over all other fields
  for (const key of Object.keys(dev)) {
    if (alwaysKeep.includes(key)) continue;

    const val = dev[key];

    // Omit null/undefined
    if (val === null || val === undefined) continue;

    // Omit empty arrays
    if (Array.isArray(val)) {
      if (val.length === 0) continue;
      result[key] = val;
      continue;
    }

    // Omit empty/default objects
    if (typeof val === "object" && val !== null) {
      if (key === "loadout") {
        const isDefault = !val.crown && !val.roof && !val.aura && !val.faces;
        if (isDefault) continue;
      }
      if (key === "active_raid_tag") {
        if (!val.attacker_login) continue;
      }
    }

    // Omit defaults for boolean, string, number
    if (key === "claimed" && val === false) continue;
    if (key === "kudos_count" && val === 0) continue;
    if (key === "visit_count" && val === 0) continue;
    if (key === "app_streak" && val === 0) continue;
    if (key === "raid_xp" && val === 0) continue;
    if (key === "current_week_contributions" && val === 0) continue;
    if (key === "current_week_kudos_given" && val === 0) continue;
    if (key === "current_week_kudos_received" && val === 0) continue;
    if (key === "rabbit_completed" && val === false) continue;
    if (key === "xp_total" && val === 0) continue;
    if (key === "xp_level" && val === 1) continue;
    if (key === "district_chosen" && val === false) continue;
    if (key === "building_style" && val === "tower") continue;

    // LeetCode metrics
    if (key === "easy_solved" && val === 0) continue;
    if (key === "medium_solved" && val === 0) continue;
    if (key === "hard_solved" && val === 0) continue;
    if (key === "acceptance_rate" && val === 0) continue;
    if (key === "contest_rating" && val === 0) continue;
    if (key === "lc_streak" && val === 0) continue;

    // V2 metrics
    if (key === "followers" && val === 0) continue;
    if (key === "following" && val === 0) continue;
    if (key === "organizations_count" && val === 0) continue;
    if (key === "current_streak" && val === 0) continue;
    if (key === "longest_streak" && val === 0) continue;
    if (key === "active_days_last_year" && val === 0) continue;
    if (key === "language_diversity" && val === 0) continue;
    if (key === "total_prs" && val === 0) continue;
    if (key === "total_reviews" && val === 0) continue;
    if (key === "total_issues" && val === 0) continue;
    if (key === "repos_contributed_to" && val === 0) continue;

    result[key] = val;
  }

  return result;
}
