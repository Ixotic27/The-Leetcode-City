import { getSupabaseAdmin } from "@/lib/supabase";
import { CitySerializer, type CityDeveloperLike, type CitySerializableValue } from "@/services/citySerializer";
import { OwnershipResolver } from "@/services/ownershipResolver";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CityLoadOptions = {
  from: number;
  to: number;
};

export type CityLoadSuccessBody = {
  developers: Array<Record<string, CitySerializableValue>>;
  stats: Record<string, CitySerializableValue>;
};

type CityLoadErrorBody = {
  error: string;
};

export type CityLoadResponse = {
  status: number;
  headers: Record<string, string>;
  body: CityLoadSuccessBody | CityLoadErrorBody;
};

function cityLoadError(): CityLoadResponse {
  return {
    status: 500,
    headers: { "Cache-Control": "no-store" },
    body: { error: "Failed to load city data" },
  };
}

function hasQueryError(...results: Array<{ error: unknown }>): boolean {
  return results.some((result) => result.error !== null && result.error !== undefined);
}

export class CityService {
  private readonly admin: SupabaseClient;
  private readonly serializer: CitySerializer;

  constructor(admin?: SupabaseClient, serializer?: CitySerializer) {
    this.admin = admin ?? getSupabaseAdmin();
    this.serializer = serializer ?? new CitySerializer();
  }

  async loadCityData(options: CityLoadOptions): Promise<CityLoadResponse> {
    const { from, to } = options;
    const sb = this.admin;

    const [devsResult, statsResult, supportProgressResult] = await Promise.all([
      sb
        .from("developers")
        .select(
          "id, github_login, name, avatar_url, contributions, total_stars, public_repos, primary_language, rank, claimed, kudos_count, visit_count, contributions_total, contribution_years, total_prs, total_reviews, repos_contributed_to, followers, following, organizations_count, account_created_at, current_streak, active_days_last_year, language_diversity, app_streak, rabbit_completed, district, district_chosen, xp_total, xp_level, raid_xp, easy_solved, medium_solved, hard_solved, contest_rating, lc_streak, acceptance_rate"
        )
        .not("easy_solved", "is", null)
        .order("rank", { ascending: true })
        .range(from, to - 1),
      sb.from("city_stats").select("*").eq("id", 1).single(),
      sb.from("items").select("metadata").eq("id", "support_renewal").maybeSingle(),
    ]);

    if (hasQueryError(devsResult, statsResult, supportProgressResult)) {
      return cityLoadError();
    }

    const devs = (devsResult.data ?? []) as Array<CityDeveloperLike>;
    const devIds = devs.map((d) => Number(d.id));

    const supportMeta = (supportProgressResult?.data?.metadata as Record<string, CitySerializableValue>) || {};
    const renewalRaisedInr = supportMeta.raised_inr ?? 0;
    const renewalTargetInr = supportMeta.target_inr ?? 2900;

    if (devIds.length === 0) {
      return {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
        body: {
          developers: [],
          stats: {
            ...(statsResult.data ?? { total_developers: 0, total_contributions: 0 }),
            renewal_raised_inr: renewalRaisedInr,
            renewal_target_inr: renewalTargetInr,
          },
        },
      };
    }

    let ownedItemsMap: Record<number, string[]> = {};
    try {
      const resolver = new OwnershipResolver();
      ownedItemsMap = await resolver.buildOwnedItemsMap(devIds);
    } catch {
      return cityLoadError();
    }

    const [customizationsResult, achievementsResult, raidTagsResult] = await Promise.all([
      sb
        .from("developer_customizations")
        .select("developer_id, item_id, config")
        .in("developer_id", devIds)
        .in("item_id", ["custom_color", "billboard", "loadout", "building_style", "led_banner", "selected_title"]),
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

    if (hasQueryError(customizationsResult, achievementsResult, raidTagsResult)) {
      return cityLoadError();
    }

    const customColorMap: Record<number, string> = {};
    const billboardImagesMap: Record<number, string[]> = {};
    const ledBannerTextMap: Record<number, string> = {};
    const loadoutMap: Record<number, { crown: string | null; roof: string | null; aura: string | null; faces: string | null }> = {};
    const selectedTitleMap: Record<number, string> = {};
    for (const row of customizationsResult.data ?? []) {
      const developerId = typeof row.developer_id === "number" ? row.developer_id : Number(row.developer_id);
      const config = typeof row.config === "object" && row.config !== null && !Array.isArray(row.config) ? row.config : {};
      if (row.item_id === "custom_color" && typeof config.color === "string") {
        customColorMap[developerId] = config.color;
      }
      if (row.item_id === "billboard") {
        if (Array.isArray(config.images)) {
          billboardImagesMap[developerId] = config.images as string[];
        } else if (typeof config.image_url === "string") {
          billboardImagesMap[developerId] = [config.image_url];
        }
      }
      if (row.item_id === "loadout") {
        loadoutMap[developerId] = {
          crown: typeof config.crown === "string" ? config.crown : null,
          roof: typeof config.roof === "string" ? config.roof : null,
          aura: typeof config.aura === "string" ? config.aura : null,
          faces: typeof config.faces === "string" ? config.faces : null,
        };
      }
      if (row.item_id === "led_banner" && typeof config.text === "string") {
        ledBannerTextMap[developerId] = config.text;
      }
      if (row.item_id === "selected_title" && typeof config.slug === "string") {
        selectedTitleMap[developerId] = config.slug;
      }
    }

    const styleMap: Record<number, string> = {};
    for (const row of customizationsResult.data ?? []) {
      const developerId = typeof row.developer_id === "number" ? row.developer_id : Number(row.developer_id);
      const config = typeof row.config === "object" && row.config !== null && !Array.isArray(row.config) ? row.config : {};
      if (row.item_id === "building_style" && typeof config.style === "string") {
        styleMap[developerId] = config.style;
      }
    }

    const achievementsMap: Record<number, string[]> = {};
    for (const row of achievementsResult.data ?? []) {
      const developerId = typeof row.developer_id === "number" ? row.developer_id : Number(row.developer_id);
      if (!achievementsMap[developerId]) achievementsMap[developerId] = [];
      achievementsMap[developerId].push(String(row.achievement_id));
    }

    const raidTagMap: Record<number, { attacker_login: string; tag_style: string; expires_at: string }> = {};
    for (const row of raidTagsResult.data ?? []) {
      const buildingId = typeof row.building_id === "number" ? row.building_id : Number(row.building_id);
      raidTagMap[buildingId] = {
        attacker_login: typeof row.attacker_login === "string" ? row.attacker_login : "",
        tag_style: typeof row.tag_style === "string" ? row.tag_style : "",
        expires_at: typeof row.expires_at === "string" ? row.expires_at : "",
      };
    }

    const developers = devs.map((dev) =>
      this.serializer.serializeDeveloper({
        ...dev,
        kudos_count: dev.kudos_count ?? 0,
        visit_count: dev.visit_count ?? 0,
        owned_items: ownedItemsMap[Number(dev.id)] ?? [],
        custom_color: customColorMap[Number(dev.id)] ?? null,
        billboard_images: billboardImagesMap[Number(dev.id)] ?? [],
        led_banner_text: ledBannerTextMap[Number(dev.id)] ?? null,
        achievements: achievementsMap[Number(dev.id)] ?? [],
        loadout: loadoutMap[Number(dev.id)] ?? null,
        building_style: styleMap[Number(dev.id)] ?? "tower",
        app_streak: dev.app_streak ?? 0,
        raid_xp: dev.raid_xp ?? 0,
        current_week_contributions: dev.current_week_contributions ?? 0,
        current_week_kudos_given: dev.current_week_kudos_given ?? 0,
        current_week_kudos_received: dev.current_week_kudos_received ?? 0,
        active_raid_tag: raidTagMap[Number(dev.id)] ?? null,
        rabbit_completed: dev.rabbit_completed ?? false,
        xp_total: dev.xp_total ?? 0,
        xp_level: dev.xp_level ?? 1,
        selected_title: selectedTitleMap[Number(dev.id)] ?? null,
      })
    );

    return {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
      body: {
        developers,
        stats: {
          ...(statsResult.data ?? { total_developers: 0, total_contributions: 0 }),
          renewal_raised_inr: renewalRaisedInr,
          renewal_target_inr: renewalTargetInr,
        },
      },
    };
  }
}
