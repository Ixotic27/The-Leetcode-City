export type CityProjectionValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | CityProjectionValue[]
  | { [key: string]: CityProjectionValue };

export type CityDeveloperLike = Record<string, CityProjectionValue> & {
  loadout?: { crown?: string | null; roof?: string | null; aura?: string | null; faces?: string | null };
  active_raid_tag?: { attacker_login?: string; tag_style?: string; expires_at?: string };
};

function isObject(value: CityProjectionValue): value is Record<string, CityProjectionValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLoadout(value: CityProjectionValue): value is { crown?: string | null; roof?: string | null; aura?: string | null; faces?: string | null } {
  return isObject(value);
}

function isRaidTag(value: CityProjectionValue): value is { attacker_login?: string; tag_style?: string; expires_at?: string } {
  return isObject(value);
}

export function buildDeveloperProjection(dev: CityDeveloperLike): Record<string, CityProjectionValue> {
  const result: Record<string, CityProjectionValue> = {};

  const alwaysKeep = ["id", "github_login", "contributions", "total_stars", "public_repos"];
  for (const key of alwaysKeep) {
    if (dev[key] !== undefined) {
      result[key] = dev[key];
    }
  }

  for (const key of Object.keys(dev)) {
    if (alwaysKeep.includes(key)) continue;

    const val = dev[key];

    if (val === null || val === undefined) continue;

    if (Array.isArray(val)) {
      if (val.length === 0) continue;
      result[key] = val;
      continue;
    }

    if (typeof val === "object" && val !== null) {
      if (key === "loadout") {
        const isDefault = isLoadout(val) && !val.crown && !val.roof && !val.aura && !val.faces;
        if (isDefault) continue;
      }
      if (key === "active_raid_tag") {
        const isDefault = isRaidTag(val) && !val.attacker_login;
        if (isDefault) continue;
      }
    }

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

    if (key === "easy_solved" && val === 0) continue;
    if (key === "medium_solved" && val === 0) continue;
    if (key === "hard_solved" && val === 0) continue;
    if (key === "acceptance_rate" && val === 0) continue;
    if (key === "contest_rating" && val === 0) continue;
    if (key === "lc_streak" && val === 0) continue;

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
