import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;
// Cache the admin client, keyed by connection details to support env changes during tests
let adminClient: SupabaseClient | null = null;
let lastAdminKey: string | null = null;
let lastAdminUrl: string | null = null;

/**
 * Returns true if the string is a valid URL starting with http/https.
 */
export function isValidUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Creates a robust, chainable dummy/noop client to prevent runtime crashes during build.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDummyClient(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dummy: any = () => dummy;
  return new Proxy(dummy, {
    get(target, prop) {
      if (prop === "then") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (resolve: any) => resolve({ data: null, error: null });
      }
      if (prop === "auth") {
        return {
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
          getSession: async () => ({ data: { session: null }, error: null }),
          getUser: async () => ({ data: { user: null }, error: null }),
        };
      }
      return dummy;
    }
  });
}

/**
 * Safely creates a Supabase client. If the URL is invalid or key is missing,
 * returns a chainable dummy client to prevent build/runtime crashes.
 */
export function getSafeSupabaseClient(url?: string, key?: string): SupabaseClient {
  const targetUrl = url || process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const targetKey = key || process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

  if (!isValidUrl(targetUrl) || !targetKey) {
    console.warn(`[Supabase] Returning dummy client due to missing or invalid URL/Key. URL: "${targetUrl}"`);
    return createDummyClient() as unknown as SupabaseClient;
  }

  return createClient(targetUrl!, targetKey, { auth: { persistSession: false } });
}

/**
 * Returns true when running without the service-role key.
 * In dev mode, admin operations gracefully degrade (read-only via anon key).
 */
export function isDevMode(): boolean {
  return !process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/** Client-side Supabase client (anon key, respects RLS) — singleton for "use client" */
export function createBrowserSupabase() {
  if (browserClient) return browserClient;

  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

  if (!isValidUrl(url) || !key) {
    console.warn(`[Supabase] Returning dummy client for browser client due to missing or invalid URL/Key. URL: "${url}"`);
    return createDummyClient() as unknown as ReturnType<typeof createBrowserClient>;
  }

  browserClient = createBrowserClient(url!, key);
  return browserClient;
}

/**
 * Server-side Supabase client (service role, bypasses RLS).
 * In dev mode (no service-role key), falls back to the anon key.
 * Writes will be blocked by RLS but reads still work — perfect for
 * contributors working on frontend/UI changes.
 */
let adminClientWarned = false;
export function getSupabaseAdmin(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];

  if (!isValidUrl(url) || !key) {
    console.warn(`[Supabase] Returning dummy admin client due to missing or invalid URL/Key. URL: "${url}"`);
    return createDummyClient() as unknown as SupabaseClient;
  }

  // Return cached instance if credentials haven't changed
  if (adminClient && lastAdminKey === key && lastAdminUrl === url) {
    return adminClient;
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !adminClientWarned) {
    adminClientWarned = true;
    console.warn(
      "[dev mode] SUPABASE_SERVICE_ROLE_KEY not set — using anon key. " +
      "Reads work, writes are blocked by RLS. This is fine for frontend development."
    );
  }

  adminClient = createClient(
    url!,
    key,
    { auth: { persistSession: false } }
  );
  lastAdminKey = key ?? null;
  lastAdminUrl = url ?? null;

  return adminClient;
}

/**
 * Broadcast a message to all Supabase Realtime subscribers on a channel.
 * Uses the HTTP REST endpoint (no WebSocket needed, works in serverless).
 *
 * The supabase-js client prepends "realtime:" to channel names internally,
 * so we must match that prefix here for the message to reach browser clients.
 */
export async function broadcastToChannel(
  topic: string,
  event: string,
  payload: Record<string, unknown>,
) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return; // Dev mode — skip broadcast silently

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`;

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ topic, event, payload }],
      }),
    });
  } catch (err) {
    // Fire and forget: broadcast failure should never block the API response.
    console.warn("[lib/supabase.ts] failed to broadcast realtime message:", err);
  }
}

