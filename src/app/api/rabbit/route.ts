import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";
import { getAuthenticatedDeveloper } from "@/lib/arena";

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

  if (sighting !== (dev.rabbit_progress ?? 0) + 1) {
    return NextResponse.json({ error: "Wrong sighting order" }, { status: 400 });
  }

  if (sighting === 5) {
    const { data, error } = await admin
      .from("developers")
      .update({
        rabbit_progress: 5,
        rabbit_completed: true,
        rabbit_completed_at: new Date().toISOString(),
      })
      .eq("id", dev.id)
      .eq("rabbit_completed", false)
      .select("id");

    if (error) {
      return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ progress: 5, completed: true });
    }

    await admin
      .from("developer_achievements")
      .upsert(
        { developer_id: dev.id, achievement_id: "white_rabbit" },
        { onConflict: "developer_id,achievement_id" },
      );

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
      );

    return NextResponse.json({ progress: 5, completed: true });
  }

  const updates: Record<string, unknown> = {
    rabbit_progress: sighting,
  };
  if (sighting === 1) {
    updates.rabbit_started_at = new Date().toISOString();
  }

  const { data: updated, error } = await admin
    .from("developers")
    .update(updates)
    .eq("id", dev.id)
    .eq("rabbit_progress", sighting - 1)
    .select("id");

  if (error) {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  if (!updated || updated.length === 0) {
    return NextResponse.json(
      { error: "Another request already advanced this sighting" },
      { status: 409 }
    );
  }

  return NextResponse.json({ progress: sighting, completed: false });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const admin = getSupabaseAdmin();

  if (searchParams.has("check")) {
    let dev: { rabbit_progress: number | null; rabbit_completed: boolean | null; rabbit_completed_at: string | null } | null = null;

    const authedDev = await getAuthenticatedDeveloper(request);
    if (authedDev) {
      const { data: qDev } = await admin
        .from("developers")
        .select("rabbit_progress, rabbit_completed, rabbit_completed_at")
        .eq("id", authedDev.id)
        .maybeSingle();
      dev = qDev;
    } else {
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
        console.error("[app/api/rabbit/route.ts] failed to load rabbit dev info:", err);
      }
    }

    return NextResponse.json({
      progress: dev?.rabbit_progress ?? 0,
      completed: dev?.rabbit_completed ?? false,
      completed_at: dev?.rabbit_completed_at ?? null,
    });
  }

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
