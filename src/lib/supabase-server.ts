import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isValidUrl, createDummyClient } from "./supabase";

/** Server-side Supabase client with cookie-based auth (for Server Components & Route Handlers) */
export async function createServerSupabase() {
  const cookieStore = await cookies();
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

  if (!isValidUrl(url) || !key) {
    console.warn(`[Supabase] Returning dummy server client due to missing or invalid URL/Key. URL: "${url}"`);
    return createDummyClient() as unknown as ReturnType<typeof createServerClient>;
  }

  return createServerClient(
    url!,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch (err) {
            console.warn("[lib/supabase-server.ts] non-critical error:", err);
          }
        },
      },
    }
  );
}

