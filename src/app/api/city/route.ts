import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * @param {import('next/server').NextRequest} request
 */

type DeveloperRow = {
  id: number;

  kudos_count?: number | null;
  visit_count?: number | null;

  app_streak?: number | null;
  raid_xp?: number | null;

  current_week_contributions?: number | null;
  current_week_kudos_given?: number | null;
  current_week_kudos_received?: number | null;

  rabbit_completed?: boolean | null;

  xp_total?: number | null;
  xp_level?: number | null;

  [key: string]: unknown;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawFrom = parseInt(searchParams.get("from") ?? "0", 10);
  const rawTo = parseInt(searchParams.get("to") ?? "500", 10);

  if (isNaN(rawFrom) || isNaN(rawTo)) {
    return NextResponse.json(
      { error: "Invalid pagination parameters: 'from' and 'to' must be numbers." },
      { status: 400 }
    );
  }

  const from = Math.max(0, rawFrom);
  const to = Math.min(from + 1000, rawTo);

  const sb = getSupabaseAdmin();

  // Round 1: devs + stats + support progress in parallel
  const [devsResult, statsResult, supportProgressResult] = await Promise.all([
    sb
      .from("developers")
      .select(
        "id, github_login, name, avatar_url, contributions, total_stars, public_repos, primary_language, rank, claimed, kudos_count, visit_count, contributions_total, contribution_years, total_prs, total_reviews, repos_contributed_to, followers, following, organizations_count, account_created_at, current_streak, active_days_last_year, language_diversity, app_streak, rabbit_completed, district, district_chosen, xp_total, xp_level, easy_solved, medium_solved, hard_solved, contest_rating, lc_streak, acceptance_rate"
      )
      .not("easy_solved", "is", null)
      .order("rank", { ascending: true })
      .range(from, to - 1),
    sb.from("city_stats").select("*").eq("id", 1).single(),
    sb.from("items").select("metadata").eq("id", "support_renewal").maybeSingle(),
  ]);

  const devs = (devsResult.data ?? []) as DeveloperRow[];
  const devIds = devs.map((d) => d.id);

  const supportMeta = (supportProgressResult?.data?.metadata as Record<string, any>) || {};
  const renewalRaisedInr = supportMeta.raised_inr ?? 0;
  const renewalTargetInr = supportMeta.target_inr ?? 2900;

  if (devIds.length === 0) {
    return NextResponse.json(
      {
        developers: [],
        stats: {
          ...(statsResult.data ?? { total_developers: 0, total_contributions: 0 }),
          renewal_raised_inr: renewalRaisedInr,
          renewal_target_inr: renewalTargetInr,
        },
      },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  }

  // Round 2: purchases + customizations + achievements + raid tags in parallel
  const [purchasesResult, giftPurchasesResult, customizationsResult, achievementsResult, raidTagsResult] = await Promise.all([
    sb
      .from("purchases")
      .select("developer_id, item_id, provider, amount_cents")
      .in("developer_id", devIds)
      .is("gifted_to", null)
      .eq("status", "completed"),
    sb
      .from("purchases")
      .select("gifted_to, item_id, provider, amount_cents")
      .in("gifted_to", devIds)
      .eq("status", "completed"),
    sb
      .from("developer_customizations")
      .select("developer_id, item_id, config")
      .in("developer_id", devIds)
      .in("item_id", ["custom_color", "billboard", "loadout", "building_style", "led_banner"]),
    sb
      .from("developer_achievements")
      .select("developer_id, achievement_id")
      .in("developer_id", devIds),
    sb
      .from("raid_tags")
      .select("building_id, attacker_login, tag_style, expires_at")
      .in("building_id", devIds)
      .eq("active", true),
  ]);

  // Build owned items map (direct purchases + received gifts)
  const ownedItemsMap: Record<number, string[]> = {};
  for (const row of purchasesResult.data ?? []) {
    if (row.amount_cents === 0 && ["stripe", "cashfree", "abacatepay", "nowpayments"].includes(row.provider)) {
      continue;
    }
    if (!ownedItemsMap[row.developer_id]) ownedItemsMap[row.developer_id] = [];
    ownedItemsMap[row.developer_id].push(row.item_id);
  }
  for (const row of giftPurchasesResult.data ?? []) {
    if (row.amount_cents === 0 && ["stripe", "cashfree", "abacatepay", "nowpayments"].includes(row.provider)) {
      continue;
    }
    const devId = row.gifted_to as number;
    if (!ownedItemsMap[devId]) ownedItemsMap[devId] = [];
    ownedItemsMap[devId].push(row.item_id);
  }

  // Build customization maps
  const customColorMap: Record<number, string> = {};
  const billboardImagesMap: Record<number, string[]> = {};
  const ledBannerTextMap: Record<number, string> = {};
  const loadoutMap: Record<number, { crown: string | null; roof: string | null; aura: string | null; faces: string | null }> = {};
  for (const row of customizationsResult.data ?? []) {
    const config = row.config as Record<string, unknown>;
    if (row.item_id === "custom_color" && typeof config?.color === "string") {
      customColorMap[row.developer_id] = config.color;
    }
    if (row.item_id === "billboard") {
      if (Array.isArray(config?.images)) {
        billboardImagesMap[row.developer_id] = config.images as string[];
      } else if (typeof config?.image_url === "string") {
        billboardImagesMap[row.developer_id] = [config.image_url];
      }
    }
    if (row.item_id === "loadout") {
      loadoutMap[row.developer_id] = {
        crown: (config?.crown as string) ?? null,
        roof: (config?.roof as string) ?? null,
        aura: (config?.aura as string) ?? null,
        faces: (config?.faces as string) ?? null,
      };
    }
    if (row.item_id === "building_style" && typeof config?.style === "string") {
      // Style is handled via styleMap below
    }
    if (row.item_id === "led_banner" && typeof config?.text === "string") {
      ledBannerTextMap[row.developer_id] = config.text;
    }
  }

  // Build a quick style map
  const styleMap: Record<number, string> = {};
  for (const row of customizationsResult.data ?? []) {
    const config = row.config as Record<string, unknown>;
    if (row.item_id === "building_style" && typeof config.style === "string") {
      styleMap[row.developer_id] = config.style;
    }
  }

  // Build achievements map
  const achievementsMap: Record<number, string[]> = {};
  for (const row of achievementsResult.data ?? []) {
    if (!achievementsMap[row.developer_id]) achievementsMap[row.developer_id] = [];
    achievementsMap[row.developer_id].push(row.achievement_id);
  }

  // Build raid tags map (1 active tag per building)
  const raidTagMap: Record<number, { attacker_login: string; tag_style: string; expires_at: string }> = {};
  for (const row of raidTagsResult.data ?? []) {
    raidTagMap[row.building_id] = {
      attacker_login: row.attacker_login,
      tag_style: row.tag_style,
      expires_at: row.expires_at,
    };
  }

  // Merge everything
  const developersWithItems = devs.map((dev) => ({
    ...dev,
    kudos_count: dev.kudos_count ?? 0,
    visit_count: dev.visit_count ?? 0,
    owned_items: ownedItemsMap[dev.id] ?? [],
    custom_color: customColorMap[dev.id] ?? null,
    billboard_images: billboardImagesMap[dev.id] ?? [],
    led_banner_text: ledBannerTextMap[dev.id] ?? null,
    achievements: achievementsMap[dev.id] ?? [],
    loadout: loadoutMap[dev.id] ?? null,
    building_style: styleMap[dev.id] ?? "tower",
    app_streak: dev.app_streak ?? 0,
    raid_xp: dev.raid_xp ?? 0,
    current_week_contributions: dev.current_week_contributions ?? 0,
    current_week_kudos_given: dev.current_week_kudos_given ?? 0,
    current_week_kudos_received: dev.current_week_kudos_received ?? 0,
    active_raid_tag: raidTagMap[dev.id] ?? null,
    rabbit_completed: dev.rabbit_completed ?? false,
    xp_total: dev.xp_total ?? 0,
    xp_level: dev.xp_level ?? 1,
  }));

  return NextResponse.json(
    {
      developers: developersWithItems,
      stats: {
        ...(statsResult.data ?? { total_developers: 0, total_contributions: 0 }),
        renewal_raised_inr: renewalRaisedInr,
        renewal_target_inr: renewalTargetInr,
      },
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}
