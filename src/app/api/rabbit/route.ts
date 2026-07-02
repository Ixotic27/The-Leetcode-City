import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";
import { getAuthenticatedDeveloper } from "@/lib/arena";

// POST - Record rabbit sighting encounter
/**
 * @param {import('next/server').NextRequest} request
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { ok } = await rateLimit(`rabbit:${user.id}`, 2, 1000);
  if (!ok) {
    return NextResponse.json({ error: "Too fast" }, { status: 429 });
  }

  const { sighting } = await request.json();
  if (typeof sighting !== "number" || sighting < 1 || sighting > 5) {
    return NextResponse.json({ error: "Invalid sighting" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const { data: dev } = await admin
    .from("developers")
    .select("id, claimed, rabbit_progress, rabbit_completed")
    .eq("claimed_by", user.id)
    .single();

  if (!dev || !dev.claimed) {
    return NextResponse.json({ error: "Must claim building first" }, { status: 403 });
  }

  if (dev.rabbit_completed) {
    return NextResponse.json({ progress: 5, completed: true });
  }

  // Must be sequential: no skipping
  if (sighting !== (dev.rabbit_progress ?? 0) + 1) {
    return NextResponse.json({ error: "Wrong sighting order" }, { status: 400 });
  }

  if (sighting === 5) {
    // Final sighting: complete the quest.
    // Use an optimistic-lock WHERE clause so that only the first of any
    // concurrent sighting-5 requests commits; the rest see rowCount = 0
    // and return early before touching purchases.
    const { data, error } = await admin
      .from("developers")
      .update({
        rabbit_progress: 5,
        rabbit_completed: true,
        rabbit_completed_at: new Date().toISOString(),
      })
      .eq("id", dev.id)
      .eq("rabbit_completed", false)   // optimistic lock: only win the race once
      .select("id");

    if (error) {
      return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }

    // Another concurrent request already completed the quest — nothing to do.
    if (!data || data.length === 0) {
      return NextResponse.json({ progress: 5, completed: true });
    }

    // Grant achievement (upsert is already idempotent via ON CONFLICT).
    await admin
      .from("developer_achievements")
      .upsert(
        { developer_id: dev.id, achievement_id: "white_rabbit" },
        { onConflict: "developer_id,achievement_id" },
      );

    // Grant white_rabbit item atomically.
    // INSERT ... ON CONFLICT DO NOTHING relies on the partial unique index
    // idx_purchases_unique_completed (developer_id, item_id, coalesce(gifted_to,0))
    // WHERE status = 'completed' — only the first insert wins; duplicates are
    // silently dropped. No application-level SELECT is needed.
    await admin
      .from("purchases")
      .upsert(
        {
          developer_id: dev.id,
          item_id: "white_rabbit",
          provider: "system",
          amount_cents: 0,
          currency: "usd",
          status: "completed",
        },
        {
          onConflict: "developer_id,item_id",
          ignoreDuplicates: true,
        }
      );   // maps to ON CONFLICT DO NOTHING

    return NextResponse.json({ progress: 5, completed: true });
  }

  // Sightings 1-4
  // For sighting 1, only set rabbit_started_at when it hasn't been set yet
  // so concurrent first-sighting writes don't overwrite each other's timestamp.
  const updates: Record<string, unknown> = {
    rabbit_progress: sighting,
  };
  if (sighting === 1) {
    updates.rabbit_started_at = new Date().toISOString();
  }

  const { error } = await admin
    .from("developers")
    .update(updates)
    .eq("id", dev.id)
    // Only advance progress forward; never regress if a concurrent request
    // for a later sighting already moved the pointer past this one.
    .lt("rabbit_progress", sighting);

  if (error) {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  return NextResponse.json({ progress: sighting, completed: false });
}

// GET - Hall of completers (public) or progress check (authenticated)
/**
 * @param {import('next/server').NextRequest} request
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const admin = getSupabaseAdmin();

  // Check personal progress
  if (searchParams.has("check")) {
    let dev: { rabbit_progress: number | null; rabbit_completed: boolean | null; rabbit_completed_at: string | null } | null = null;

    // Try extension/custom token first
    const authedDev = await getAuthenticatedDeveloper(request);
    if (authedDev) {
      const { data: qDev } = await admin
        .from("developers")
        .select("rabbit_progress, rabbit_completed, rabbit_completed_at")
        .eq("id", authedDev.id)
        .maybeSingle();
      dev = qDev;
    } else {
      // Fallback to cookie user
      try {
        const supabase = await createServerSupabase();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: qDev } = await admin
            .from("developers")
            .select("rabbit_progress, rabbit_completed, rabbit_completed_at")
            .eq("claimed_by", user.id)
            .maybeSingle();
          dev = qDev;
        }
      } catch (err) {
        // ignore
      }
    }

    return NextResponse.json({
      progress: dev?.rabbit_progress ?? 0,
      completed: dev?.rabbit_completed ?? false,
      completed_at: dev?.rabbit_completed_at ?? null,
    });
  }

  // Hall of completers
  const { data: completers } = await admin
    .from("developers")
    .select("github_login, avatar_url, name, rabbit_completed_at")
    .eq("rabbit_completed", true)
    .order("rabbit_completed_at", { ascending: true })
    .limit(100);

  const hall = (completers ?? []).map((c, i) => ({
    position: i + 1,
    login: c.github_login,
    avatar_url: c.avatar_url,
    name: c.name,
    completed_at: c.rabbit_completed_at,
  }));

  return NextResponse.json({ completers: hall }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
  });
}
