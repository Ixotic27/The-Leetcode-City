// Helpers for building the Fly-game leaderboard from raw Supabase rows.
//
// `fly_scores.developer_id` is a single-column FK to `developers(id)`, so the
// `developers` embed is a to-one relationship and PostgREST returns it as a
// single object (not an array). Supabase's generated types sometimes still
// type to-one embeds as arrays, so we normalize defensively here.

export interface FlyDeveloperEmbed {
  github_login: string | null;
  avatar_url: string | null;
}

export interface FlyScoreRow {
  score: number;
  collected: number;
  max_combo: number;
  flight_ms: number;
  created_at: string;
  developer_id: number;
  // Object for a to-one embed; array tolerated for resilience to typegen quirks.
  developers: FlyDeveloperEmbed | FlyDeveloperEmbed[] | null;
}

export interface FlyLeaderboardEntry {
  score: number;
  collected: number;
  max_combo: number;
  flight_ms: number;
  created_at: string;
  github_login: string | null;
  avatar_url: string | null;
}

/** Normalize a to-one embed that may arrive as an object, an array, or null. */
function firstDeveloper(
  embed: FlyDeveloperEmbed | FlyDeveloperEmbed[] | null,
): FlyDeveloperEmbed | null {
  if (!embed) return null;
  return Array.isArray(embed) ? (embed[0] ?? null) : embed;
}

/**
 * Build the Fly leaderboard: keep the best row per developer (rows are expected
 * pre-sorted best-first), take the top `limit`, and project to public entries
 * with the developer's login/avatar resolved from the to-one embed.
 */
export function buildFlyLeaderboard(
  rows: FlyScoreRow[] | null | undefined,
  limit = 20,
): FlyLeaderboardEntry[] {
  const seen = new Set<number>();
  const unique = (rows ?? []).filter((row) => {
    if (seen.has(row.developer_id)) return false;
    seen.add(row.developer_id);
    return true;
  });

  return unique.slice(0, limit).map((row) => {
    const dev = firstDeveloper(row.developers);
    return {
      score: row.score,
      collected: row.collected,
      max_combo: row.max_combo,
      flight_ms: row.flight_ms,
      created_at: row.created_at,
      github_login: dev?.github_login ?? null,
      avatar_url: dev?.avatar_url ?? null,
    };
  });
}
