import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;
// Cache the admin client, keyed by connection details to support env changes during tests
let adminClient: SupabaseClient | null = null;
let lastAdminKey: string | null = null;
let lastAdminUrl: string | null = null;

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

  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;

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
    url,
    key!,
    { auth: { persistSession: false } }
  );
  lastAdminKey = key ?? null;
  lastAdminUrl = url;

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
  } catch (err) { console.warn("[lib/supabase.ts] non-critical error:", err); } // Fire and forget — broadcast failure should never block the API response
}

