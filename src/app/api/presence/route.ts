import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - 5 * 60_000).toISOString();

  try {
    // Timeout the query to prevent 28s+ hangs seen in production
    const queryPromise = sb
      .from("developer_sessions")
      .select(`
        developer_id,
        session_id,
        status,
        current_language,
        last_heartbeat_at,
        developers!inner(github_login, avatar_url)
      `)
      .in("status", ["active", "idle"])
      .gte("last_heartbeat_at", cutoff);

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Presence query timed out after 8s")), 8_000)
    );

    const { data: sessions, error } = await Promise.race([queryPromise, timeoutPromise]);

    if (error) {
      console.warn("[/api/presence] query error:", error.message);
      return NextResponse.json({ count: 0, developers: [] }, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    // Deduplicate by developer (keep latest session)
    const byDev = new Map<number, (typeof sessions)[number]>();
    for (const s of sessions ?? []) {
      const existing = byDev.get(s.developer_id);
      if (!existing || s.last_heartbeat_at > existing.last_heartbeat_at) {
        byDev.set(s.developer_id, s);
      }
    }

    const developers = Array.from(byDev.values()).map((s) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dev = s.developers as any;
      return {
        githubLogin: dev.github_login,
        avatarUrl: dev.avatar_url,
        status: s.status,
        language: s.current_language,
        // project and developerId intentionally excluded for privacy/security
      };
    });

    return NextResponse.json(
      { count: developers.length, developers },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (err) {
    console.warn("[/api/presence] timeout or error:", err instanceof Error ? err.message : err);
    // Return empty result instead of 500 — clients will get fresh data on next poll
    return NextResponse.json({ count: 0, developers: [] }, {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
