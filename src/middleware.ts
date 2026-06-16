import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { rateLimit } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// Route-specific rate limits: [maxRequests, windowMs]
// ---------------------------------------------------------------------------
const WINDOW_1_MIN_MS = 60_000; // 1 minute

const ROUTE_LIMITS: [string, number, number][] = [
  // Exact-prefix match – order from most-specific to least-specific
  ["/api/customizations/upload", 5, WINDOW_1_MIN_MS],
  ["/api/customizations", 10, WINDOW_1_MIN_MS],
  ["/api/sky-ads/track", 30, WINDOW_1_MIN_MS],
  ["/api/sky-ads", 30, WINDOW_1_MIN_MS],
  ["/api/raid", 15, WINDOW_1_MIN_MS],
  ["/api/checkin", 10, WINDOW_1_MIN_MS],
  ["/api/heartbeats", 60, WINDOW_1_MIN_MS],
  ["/api/interactions/kudos", 20, WINDOW_1_MIN_MS],
  ["/api/interactions/visit", 50, WINDOW_1_MIN_MS],
  ["/api/interactions", 60, WINDOW_1_MIN_MS],
  ["/api/achievements", 30, WINDOW_1_MIN_MS],
  ["/api/loadout", 10, WINDOW_1_MIN_MS],
  ["/api/feed", 30, WINDOW_1_MIN_MS],
  ["/api/checkout/status", 40, WINDOW_1_MIN_MS],
  ["/api/checkout", 6, WINDOW_1_MIN_MS],
  ["/api/claim", 5, WINDOW_1_MIN_MS],
  ["/api/city", 30, WINDOW_1_MIN_MS],
  ["/api/dev/", 60, WINDOW_1_MIN_MS],
  ["/api/items", 30, WINDOW_1_MIN_MS],
  ["/api/auth", 10, WINDOW_1_MIN_MS],
];

const DEFAULT_API: [number, number] = [60, WINDOW_1_MIN_MS];
const DEFAULT_PAGE: [number, number] = [120, WINDOW_1_MIN_MS];

function getLimitForPath(pathname: string): {
  limit: number;
  window: number;
  group: string;
} {
  // Webhooks are called by trusted third-parties (Stripe, AbacatePay, Cashfree) –
  // they verify signatures, so we don't rate-limit them.
  if (pathname.startsWith("/api/webhooks")) {
    return { limit: 1000, window: WINDOW_1_MIN_MS, group: "webhooks" };
  }

  for (const [prefix, limit, window] of ROUTE_LIMITS) {
    if (pathname.startsWith(prefix)) {
      return { limit, window, group: prefix };
    }
  }

  if (pathname.startsWith("/api/")) {
    return { limit: DEFAULT_API[0], window: DEFAULT_API[1], group: "/api" };
  }

  return { limit: DEFAULT_PAGE[0], window: DEFAULT_PAGE[1], group: "/pages" };
}

/**
 * Extract the real client IP from the request.
 *
 * Vercel's reverse proxy appends the true client IP as the LAST entry in
 * x-forwarded-for. Trusting the first entry is spoofable: an attacker can
 * send `X-Forwarded-For: 1.2.3.4` which becomes `1.2.3.4, <real-ip>` after
 * Vercel appends its value — reading [0] returns the forged address.
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ips = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
    if (ips.length > 0) return ips[ips.length - 1];
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. Rate Limit ────────────────────────────────────────────────────
  const ip = getClientIp(request);
  const { limit, window, group } = getLimitForPath(pathname);
  const key = `${ip}:${group}`;
  const { ok, remaining, reset } = await rateLimit(key, limit, window);

  if (!ok) {
    return new NextResponse(
      JSON.stringify({ error: "Too many requests. Please slow down." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(reset / 1000)),
        },
      },
    );
  }

  // ── 2. Supabase Session Refresh ──────────────────────────────────────
  const hasSession = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-"));

  let supabaseResponse = NextResponse.next({ request });

  if (hasSession) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options),
            );
          },
        },
      },
    );

    try {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error) {
        console.error(
          "Supabase authentication validation failed:",
          error.message || error,
        );
      } else {
        void user; // session refreshed; user object not needed here
      }
    } catch (error) {
      console.error(
        "Supabase authentication validation threw an error:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  // ── 3. Security headers ───────────────────────────────────────────────
  supabaseResponse.headers.set("X-Frame-Options", "DENY");
  supabaseResponse.headers.set("X-Content-Type-Options", "nosniff");
  supabaseResponse.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  supabaseResponse.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  // ── 4. Attach rate-limit headers so clients can self-throttle ────────
  supabaseResponse.headers.set("X-RateLimit-Limit", String(limit));
  supabaseResponse.headers.set("X-RateLimit-Remaining", String(remaining));
  supabaseResponse.headers.set(
    "X-RateLimit-Reset",
    String(Math.ceil(reset / 1000)),
  );

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|models|fonts).*)",
  ],
};