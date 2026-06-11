import type { User } from "@supabase/supabase-js";

type AuthUser = Pick<User, "id" | "user_metadata" | "identities">;
// Supabase route handlers select different developer column sets for preview and execute.

type DeveloperRow = {
  id: number;
  claimed?: boolean | null;
  claimed_by?: string | null;

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

  owned_items?: string[];

  easy_solved?: number | null;
  medium_solved?: number | null;
  hard_solved?: number | null;
  contest_rating?: number | null;
  lc_streak?: number | null;
  total_prs?: number | null;
};

type DeveloperResult = PromiseLike<{ data: DeveloperRow | null }>;
type DeveloperQuery = {
  eq(column: string, value: string | number | boolean): DeveloperQuery;
  ilike(column: string, value: string): DeveloperQuery;
  limit(count: number): DeveloperQuery;
  maybeSingle(): DeveloperResult;
};
type DeveloperUpdate = {
  eq(column: string, value: string | number): PromiseLike<{ error?: unknown }>;
};
type DeveloperTable = {
  select(columns: string): DeveloperQuery;
  update(values: Record<string, unknown>): DeveloperUpdate;
};
type DeveloperAdmin = {
  from(table: "developers"): DeveloperTable;
};

const LOGIN_METADATA_KEYS = [
  "user_name",
  "preferred_username",
  "login",
  "name",
  "full_name",
] as const;

function getGitHubProfileVariants(login: string): string[] {
  return [
    `https://github.com/${login}`,
    `https://github.com/${login}/`,
    `http://github.com/${login}`,
    `http://github.com/${login}/`,
    `github.com/${login}`,
    `github.com/${login}/`,
  ];
}

function normalizeLogin(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;

  const githubMatch = trimmed.match(/github\.com\/([^/?#]+)/);
  const login = githubMatch?.[1] ?? trimmed.replace(/^@/, "");

  return /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/.test(login) ? login : null;
}

function mergeSelectColumns(columns: string): string {
  const required = ["id", "claimed", "claimed_by"];
  const seen = new Set<string>();
  const merged = [...required, ...columns.split(",").map((column) => column.trim())]
    .filter(Boolean)
    .filter((column) => {
      if (seen.has(column)) return false;
      seen.add(column);
      return true;
    });

  return merged.join(", ");
}

export function getAuthLoginCandidates(user: AuthUser): string[] {
  const candidates = new Set<string>();

  for (const key of LOGIN_METADATA_KEYS) {
    const login = normalizeLogin(user.user_metadata?.[key]);
    if (login) candidates.add(login);
  }

  for (const identity of user.identities ?? []) {
    for (const key of LOGIN_METADATA_KEYS) {
      const login = normalizeLogin(identity.identity_data?.[key]);
      if (login) candidates.add(login);
    }
  }

  return [...candidates];
}

async function selectDeveloper(
  admin: DeveloperAdmin,
  columns: string,
  matcher: (query: DeveloperQuery) => DeveloperResult,
): Promise<DeveloperRow | null> {
  const query = admin.from("developers").select(columns);
  const { data } = await matcher(query);
  return data;
}

async function markClaimedForUser(
  admin: DeveloperAdmin,
  developerId: number,
  userId: string,
): Promise<void> {
  await admin
    .from("developers")
    .update({
      claimed: true,
      claimed_by: userId,
      claimed_at: new Date().toISOString(),
      fetch_priority: 1,
    })
    .eq("id", developerId);
}

async function prepareAttacker(
  admin: DeveloperAdmin,
  row: DeveloperRow | null,
  userId: string,
  canRebindStaleClaim: boolean,
): Promise<DeveloperRow | null> {
  if (!row) return null;

  if (row.claimed && row.claimed_by === userId) return row;

  const hasNoOwner = !row.claimed_by;
  const belongsToCurrentSession = row.claimed_by === userId;
  if (!hasNoOwner && !belongsToCurrentSession && !canRebindStaleClaim) {
    return null;
  }

  await markClaimedForUser(admin, row.id, userId);
  return { ...row, claimed: true, claimed_by: userId };
}

export async function findRaidAttackerForUser(
  admin: unknown,
  user: AuthUser,
  columns: string,
): Promise<DeveloperRow | null> {
  const developerAdmin = admin as DeveloperAdmin;
  const selectColumns = mergeSelectColumns(columns);

  const claimedBySession = await selectDeveloper(developerAdmin, selectColumns, (query) =>
    query.eq("claimed_by", user.id).limit(1).maybeSingle(),
  );
  const directAttacker = await prepareAttacker(developerAdmin, claimedBySession, user.id, true);
  if (directAttacker) return directAttacker;

  for (const login of getAuthLoginCandidates(user)) {
    const loginMatchedDeveloper = await selectDeveloper(developerAdmin, selectColumns, (query) =>
      query.ilike("github_login", login).limit(1).maybeSingle(),
    );
    const loginAttacker = await prepareAttacker(developerAdmin, loginMatchedDeveloper, user.id, false);
    if (loginAttacker) return loginAttacker;

    const lcUsernameMatchedDeveloper = await selectDeveloper(developerAdmin, selectColumns, (query) =>
      query.ilike("lc_username", login).limit(1).maybeSingle(),
    );
    const lcUsernameAttacker = await prepareAttacker(developerAdmin, lcUsernameMatchedDeveloper, user.id, false);
    if (lcUsernameAttacker) return lcUsernameAttacker;

    for (const profileUrl of getGitHubProfileVariants(login)) {
      const profileLinkedDeveloper = await selectDeveloper(developerAdmin, selectColumns, (query) =>
        query.ilike("lc_github", profileUrl).limit(1).maybeSingle(),
      );
      const profileLinkedAttacker = await prepareAttacker(developerAdmin, profileLinkedDeveloper, user.id, true);
      if (profileLinkedAttacker) return profileLinkedAttacker;
    }
  }

  return null;
}
