import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { resolveAuthenticatedDeveloper } from "@/lib/authenticated-developer";

export async function GET() {
  const auth = await resolveAuthenticatedDeveloper({ loadDeveloper: false });

  if (!auth.ok || !auth.user) {
    return NextResponse.json({ error: auth.error ?? "Not authenticated" }, { status: auth.status });
  }

  const sb = getSupabaseAdmin();
  const userId = auth.user.id;
  let commands: string[] = [];
  try {
    const { data } = await sb
      .from("arcade_discoveries")
      .select("commands")
      .eq("user_id", userId)
      .maybeSingle();
    commands = data?.commands ?? [];
  } catch (e) {
    console.warn("Could not query arcade_discoveries:", e);
  }

  return NextResponse.json({ commands }, {
    headers: { "Cache-Control": "private, max-age=10" },
  });
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedDeveloper({ loadDeveloper: false });

  if (!auth.ok || !auth.user) {
    return NextResponse.json({ error: auth.error ?? "Not authenticated" }, { status: auth.status });
  }

  let body: { command: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const command = String(body.command ?? "").trim().toLowerCase();
  if (!command || command.length > 50) {
    return NextResponse.json({ error: "Invalid command" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const userId = auth.user.id;
  let current: string[] = [];

  try {
    // Get current discoveries
    const { data: existing, error: readError } = await sb
      .from("arcade_discoveries")
      .select("commands")
      .eq("user_id", userId)
      .maybeSingle();

    if (readError) {
      console.error("Discoveries read error:", readError);
      return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }

    current = existing?.commands ?? [];
  } catch (e) {
    console.error("Could not query arcade_discoveries on POST:", e);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  // Already discovered
  if (current.includes(command)) {
    return NextResponse.json({ commands: current, new: false });
  }

  const updated = [...current, command];

  try {
    const { error } = await sb.from("arcade_discoveries").upsert(
      {
        user_id: userId,
        commands: updated,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) {
      console.error("Discoveries upsert error:", error);
      return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }
  } catch (e) {
    console.error("Could not upsert discoveries:", e);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({ commands: updated, new: true });
}
