import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { resolveAuthenticatedDeveloper } from "@/lib/authenticated-developer";

export async function GET() {
  const auth = await resolveAuthenticatedDeveloper({
    select: "id, github_login, claimed, xp_level, xp_total",
    applyQuery: (query) => query.eq("claimed", true),
  });

  if (!auth.ok || !auth.user) {
    return NextResponse.json({ leetcode_username: null, claimed: false });
  }

  const admin = getSupabaseAdmin();
  const data = auth.developer;

  let customizations: Record<string, unknown> | null = null;
  if (data?.id) {
    const { data: custData } = await admin
      .from("developer_customizations")
      .select("item_id, config")
      .eq("developer_id", data.id)
      .in("item_id", [
        "custom_color",
        "billboard",
        "loadout",
        "building_style",
        "led_banner",
        "selected_title",
      ]);

    customizations = {};
    for (const row of custData ?? []) {
      if (row.item_id === "custom_color") {
        customizations.custom_color = row.config;
      }
      if (row.item_id === "billboard") {
        customizations.billboard = row.config;
      }
      if (row.item_id === "loadout") {
        customizations.loadout = row.config;
      }
      if (row.item_id === "building_style") {
        customizations.building_style = row.config;
      }
      if (row.item_id === "led_banner") {
        customizations.led_banner = row.config;
      }
      if (row.item_id === "selected_title") {
        customizations.selected_title = row.config;
      }
    }
  }

  return NextResponse.json({
    leetcode_username: data?.github_login ?? null,
    claimed: data?.claimed ?? false,
    xp_level: data?.xp_level ?? 1,
    xp_total: data?.xp_total ?? 0,
    developer_id: data?.id ?? null,
    customizations,
  });
}
