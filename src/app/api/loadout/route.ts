import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { ZONE_ITEMS } from "@/lib/zones";
import { parseDeveloperId } from "./developer-id";
import { getOwnedItems } from "@/lib/items";

export const dynamic = "force-dynamic";

/**
 * @param {import('next/server').NextRequest} request
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const devId = searchParams.get("developer_id");

  if (!devId) {
    return NextResponse.json({ error: "Missing developer_id" }, { status: 400 });
  }

  const developerId = parseDeveloperId(devId);
  if (developerId === null) {
    return NextResponse.json({ error: "Invalid developer_id" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("developer_customizations")
    .select("config")
    .eq("developer_id", developerId)
    .eq("item_id", "loadout")
    .maybeSingle();

  return NextResponse.json(
    { loadout: data?.config ?? null },
    { headers: { "Cache-Control": "no-store" } }
  );
}

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

  const admin = getSupabaseAdmin();

  const { data: dev } = await admin
    .from("developers")
    .select("id, github_login, claimed, claimed_by")
    .eq("claimed_by", user.id)
    .single();

  const githubLogin = dev?.github_login ?? "";

  if (!dev || !dev.claimed || dev.claimed_by !== user.id) {
    return NextResponse.json({ error: "Must own a claimed building" }, { status: 403 });
  }

  const body = await request.json();
  const { crown, roof, aura, faces, dev_mode } = body as {
    crown?: string | null;
    roof?: string | null;
    aura?: string | null;
    faces?: string | null;
    dev_mode?: boolean;
  };

  const isDeveloper = ["ishant_27", "ixotic", "ixotic27"].includes(githubLogin.toLowerCase());
  const isDev = isDeveloper && dev_mode === true;

  // Fetch owned items (direct purchases + received gifts)
  const ownedItems = await getOwnedItems(dev.id);
  const ownedSet = new Set(ownedItems);

  // Validate each equipped item is owned and belongs to the correct zone
  const config: Record<string, string | null> = { crown: null, roof: null, aura: null, faces: null };

  for (const [zone, itemId] of [
    ["crown", crown],
    ["roof", roof],
    ["aura", aura],
    ["faces", faces],
  ] as const) {
    if (itemId === null || itemId === undefined) {
      config[zone] = null;
      continue;
    }
    if (!ZONE_ITEMS[zone]?.includes(itemId)) {
      return NextResponse.json(
        { error: `${itemId} is not valid for zone ${zone}` },
        { status: 400 }
      );
    }
    if (!isDev && !ownedSet.has(itemId)) {
      return NextResponse.json(
        { error: `You don't own ${itemId}` },
        { status: 403 }
      );
    }
    config[zone] = itemId;
  }

  // Get current loadout to detect changes
  const { data: currentLoadout } = await admin
    .from("developer_customizations")
    .select("config")
    .eq("developer_id", dev.id)
    .eq("item_id", "loadout")
    .maybeSingle();
  const prev = (currentLoadout?.config ?? { crown: null, roof: null, aura: null, faces: null }) as Record<string, string | null>;

  // Upsert loadout
  const { error: upsertError } = await admin.from("developer_customizations").upsert(
    {
      developer_id: dev.id,
      item_id: "loadout",
      config,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "developer_id,item_id" }
  );

  if (upsertError) {
    console.error("[api/loadout] Failed to save loadout:", upsertError);
    return NextResponse.json(
      { error: "Database error saving loadout" },
      { status: 500 }
    );
  }

  // Feed event for newly equipped items
  for (const zone of ["crown", "roof", "aura", "faces"] as const) {
    if (config[zone] && config[zone] !== prev[zone]) {
      await admin.from("activity_feed").insert({
        event_type: "item_equipped",
        actor_id: dev.id,
        metadata: { login: githubLogin, item_id: config[zone], zone },
      });
      break; // One event per save to avoid spam
    }
  }

  return NextResponse.json({ ok: true, loadout: config });
}
