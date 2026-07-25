import type { User } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";

export interface AuthenticatedDeveloperRecord extends Record<string, unknown> {
  id?: number;
  claimed?: boolean;
  claimed_by?: string | null;
  github_login?: string | null;
  name?: string | null;
  avatar_url?: string | null;
  xp_level?: number | null;
  city_theme?: number | null;
  easy_solved?: number | null;
  medium_solved?: number | null;
  hard_solved?: number | null;
  lc_streak?: number | null;
  app_streak?: number | null;
  dailies_completed?: number | null;
  dailies_streak?: number | null;
  xp_total?: number | null;
}

interface DeveloperLookupResult {
  data: AuthenticatedDeveloperRecord | null;
  error: { code?: string; message?: string } | null;
}

interface DeveloperLookupQuery {
  eq: (column: string, value: unknown) => DeveloperLookupQuery;
  maybeSingle?: () => PromiseLike<unknown>;
  single?: () => PromiseLike<unknown>;
}

export interface ResolveAuthenticatedDeveloperOptions {
  requireAuth?: boolean;
  select?: string;
  ownerField?: string;
  loadDeveloper?: boolean;
  applyQuery?: (query: DeveloperLookupQuery) => DeveloperLookupQuery;
  validateDeveloper?: (developer: AuthenticatedDeveloperRecord | null, user: User | null) => {
    ok: boolean;
    error?: string;
    status?: number;
  };
}

export interface AuthenticatedDeveloperResult {
  ok: boolean;
  authenticated: boolean;
  user: User | null;
  developer: AuthenticatedDeveloperRecord | null;
  error: string | null;
  status: number;
}

export async function resolveAuthenticatedDeveloper(
  options: ResolveAuthenticatedDeveloperOptions = {}
): Promise<AuthenticatedDeveloperResult> {
  const {
    requireAuth = true,
    select = "id, github_login, claimed",
    ownerField = "claimed_by",
    loadDeveloper = true,
    applyQuery,
    validateDeveloper,
  } = options;

  const supabase = await createServerSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    if (requireAuth) {
      return {
        ok: false,
        authenticated: false,
        user: null,
        developer: null,
        error: "Not authenticated",
        status: 401,
      };
    }

    return {
      ok: true,
      authenticated: false,
      user: null,
      developer: null,
      error: null,
      status: 200,
    };
  }

  if (!loadDeveloper) {
    return {
      ok: true,
      authenticated: true,
      user,
      developer: null,
      error: null,
      status: 200,
    };
  }

  const admin = getSupabaseAdmin();
  let query: DeveloperLookupQuery = admin
    .from("developers")
    .select(select)
    .eq(ownerField, user.id);

  if (applyQuery) {
    query = applyQuery(query);
  }

  const maybeSingle = query.maybeSingle;
  const single = query.single;

  let developer: AuthenticatedDeveloperRecord | null = null;
  let developerError: { code?: string; message?: string } | null = null;

  if (maybeSingle) {
    const response = (await maybeSingle()) as { data: AuthenticatedDeveloperRecord | null; error: { code?: string; message?: string } | null };
    developer = response.data;
    developerError = response.error;
  } else if (single) {
    const response = (await single()) as { data: AuthenticatedDeveloperRecord | null; error: { code?: string; message?: string } | null };
    developer = response.data;
    developerError = response.error;
  }

  if (developerError && developerError.code !== "PGRST116") {
    return {
      ok: false,
      authenticated: true,
      user,
      developer: null,
      error: developerError.message ?? "Developer lookup failed",
      status: 500,
    };
  }

  if (validateDeveloper) {
    const validation = validateDeveloper(developer, user);
    if (!validation.ok) {
      return {
        ok: false,
        authenticated: true,
        user,
        developer,
        error: validation.error ?? "Developer validation failed",
        status: validation.status ?? 403,
      };
    }
  }

  return {
    ok: true,
    authenticated: true,
    user,
    developer,
    error: null,
    status: 200,
  };
}
