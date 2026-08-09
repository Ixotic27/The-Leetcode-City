import { getSupabaseAdmin } from "@/lib/supabase";
import { getCityCache, setCityCache } from "@/lib/cityCache";
import { CitySerializer, type CityDeveloperLike, type CitySerializableValue } from "./citySerializer";
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

type CityCacheReadModel = {
  from: number;
  to: number;
  developers: Array<Record<string, CitySerializableValue>>;
  stats: Record<string, CitySerializableValue>;
};

type DeveloperEnrichmentContext = {
  ownedItems?: string[];
  customColor?: string | null;
  billboardImages?: string[];
  ledBannerText?: string | null;
  achievements?: string[];
  loadout?: { crown: string | null; roof: string | null; aura: string | null; faces: string | null } | null;
  buildingStyle?: string;
  activeRaidTag?: { attacker_login: string; tag_style: string; expires_at: string } | null;
  selectedTitle?: string | null;
  appStreak?: number;
  raidXp?: number;
  kudosCount?: number;
  visitCount?: number;
  currentWeekContributions?: number;
  currentWeekKudosGiven?: number;
  currentWeekKudosReceived?: number;
  rabbitCompleted?: boolean;
  xpTotal?: number;
  xpLevel?: number;
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

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asLoadout(value: unknown): { crown: string | null; roof: string | null; aura: string | null; faces: string | null } | undefined {
  const record = asRecord(value);
  if (Object.keys(record).length === 0) return undefined;
  return {
    crown: typeof record.crown === "string" ? record.crown : null,
    roof: typeof record.roof === "string" ? record.roof : null,
    aura: typeof record.aura === "string" ? record.aura : null,
    faces: typeof record.faces === "string" ? record.faces : null,
  };
}

function asRaidTag(value: unknown): { attacker_login: string; tag_style: string; expires_at: string } | undefined {
  const record = asRecord(value);
  if (Object.keys(record).length === 0) return undefined;
  return {
    attacker_login: typeof record.attacker_login === "string" ? record.attacker_login : "",
    tag_style: typeof record.tag_style === "string" ? record.tag_style : "",
    expires_at: typeof record.expires_at === "string" ? record.expires_at : "",
  };
}

export class CityReadModel {
  private readonly admin: SupabaseClient;
  private readonly serializer: CitySerializer;

  constructor(admin?: SupabaseClient, serializer?: CitySerializer) {
    this.admin = admin ?? getSupabaseAdmin();
    this.serializer = serializer ?? new CitySerializer();
  }

  async loadCityData(options: CityLoadOptions): Promise<CityLoadResponse> {
    const { from, to } = options;

    const cachedResponse = this.getCachedCityReadModel(options);
    if (cachedResponse) {
      return cachedResponse;
    }

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
      const response = {
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
      } satisfies CityLoadResponse;
      this.cacheCityReadModel(options, response.body.developers, response.body.stats);
      return response;
    }

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

    if (hasQueryError(
      purchasesResult,
      giftPurchasesResult,
      customizationsResult,
      achievementsResult,
      raidTagsResult,
    )) {
      return cityLoadError();
    }

    const ownedItemsMap: Record<number, string[]> = {};
    for (const row of purchasesResult.data ?? []) {
      const developerId = typeof row.developer_id === "number" ? row.developer_id : Number(row.developer_id);
      const provider = typeof row.provider === "string" ? row.provider : "";
      const amountCents = typeof row.amount_cents === "number" ? row.amount_cents : Number(row.amount_cents);
      if (amountCents === 0 && ["stripe", "cashfree", "abacatepay", "nowpayments"].includes(provider)) {
        continue;
      }
      if (!ownedItemsMap[developerId]) ownedItemsMap[developerId] = [];
      ownedItemsMap[developerId].push(String(row.item_id));
    }
    for (const row of giftPurchasesResult.data ?? []) {
      const amountCents = typeof row.amount_cents === "number" ? row.amount_cents : Number(row.amount_cents);
      const provider = typeof row.provider === "string" ? row.provider : "";
      if (amountCents === 0 && ["stripe", "cashfree", "abacatepay", "nowpayments"].includes(provider)) {
        continue;
      }
      const devId = typeof row.gifted_to === "number" ? row.gifted_to : Number(row.gifted_to);
      if (!ownedItemsMap[devId]) ownedItemsMap[devId] = [];
      ownedItemsMap[devId].push(String(row.item_id));
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

    const developers = devs.map((dev) => {
      const rawDev = dev as Record<string, unknown>;
      return this.buildDeveloperReadModel(dev, {
        ownedItems: ownedItemsMap[Number(rawDev.id)] ?? [],
        customColor: customColorMap[Number(rawDev.id)] ?? null,
        billboardImages: billboardImagesMap[Number(rawDev.id)] ?? [],
        ledBannerText: ledBannerTextMap[Number(rawDev.id)] ?? null,
        achievements: achievementsMap[Number(rawDev.id)] ?? [],
        loadout: asLoadout(loadoutMap[Number(rawDev.id)] ?? null),
        buildingStyle: styleMap[Number(rawDev.id)] ?? "tower",
        appStreak: asNumber(rawDev.app_streak, 0),
        raidXp: asNumber(rawDev.raid_xp, 0),
        kudosCount: asNumber(rawDev.kudos_count, 0),
        visitCount: asNumber(rawDev.visit_count, 0),
        currentWeekContributions: asNumber(rawDev.current_week_contributions, 0),
        currentWeekKudosGiven: asNumber(rawDev.current_week_kudos_given, 0),
        currentWeekKudosReceived: asNumber(rawDev.current_week_kudos_received, 0),
        activeRaidTag: asRaidTag(raidTagMap[Number(rawDev.id)] ?? null),
        rabbitCompleted: asBoolean(rawDev.rabbit_completed, false),
        xpTotal: asNumber(rawDev.xp_total, 0),
        xpLevel: asNumber(rawDev.xp_level, 1),
        selectedTitle: selectedTitleMap[Number(rawDev.id)] ?? null,
      });
    });

    const response = {
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
    } satisfies CityLoadResponse;

    this.cacheCityReadModel(options, response.body.developers, response.body.stats);
    return response;
  }

  buildDeveloperReadModel(
    dev: CityDeveloperLike,
    context: DeveloperEnrichmentContext = {},
  ): Record<string, CitySerializableValue> {
    const rawDev = dev as Record<string, unknown>;
    return this.serializer.serializeDeveloper({
      ...dev,
      kudos_count: typeof context.kudosCount === "number" ? context.kudosCount : asNumber(rawDev.kudos_count, 0),
      visit_count: typeof context.visitCount === "number" ? context.visitCount : asNumber(rawDev.visit_count, 0),
      owned_items: context.ownedItems ?? [],
      custom_color: context.customColor ?? null,
      billboard_images: context.billboardImages ?? [],
      led_banner_text: context.ledBannerText ?? null,
      achievements: context.achievements ?? [],
      loadout: context.loadout ?? undefined,
      building_style: context.buildingStyle ?? "tower",
      app_streak: typeof context.appStreak === "number" ? context.appStreak : asNumber(rawDev.app_streak, 0),
      raid_xp: typeof context.raidXp === "number" ? context.raidXp : asNumber(rawDev.raid_xp, 0),
      current_week_contributions: typeof context.currentWeekContributions === "number" ? context.currentWeekContributions : asNumber(rawDev.current_week_contributions, 0),
      current_week_kudos_given: typeof context.currentWeekKudosGiven === "number" ? context.currentWeekKudosGiven : asNumber(rawDev.current_week_kudos_given, 0),
      current_week_kudos_received: typeof context.currentWeekKudosReceived === "number" ? context.currentWeekKudosReceived : asNumber(rawDev.current_week_kudos_received, 0),
      active_raid_tag: context.activeRaidTag ? context.activeRaidTag : undefined,
      rabbit_completed: typeof context.rabbitCompleted === "boolean" ? context.rabbitCompleted : asBoolean(rawDev.rabbit_completed, false),
      xp_total: typeof context.xpTotal === "number" ? context.xpTotal : asNumber(rawDev.xp_total, 0),
      xp_level: typeof context.xpLevel === "number" ? context.xpLevel : asNumber(rawDev.xp_level, 1),
      selected_title: context.selectedTitle ?? null,
    });
  }

  buildSnapshotPayload(payload: {
    developers: Array<unknown>;
    purchases: Array<{ developer_id?: number; gifted_to?: number; item_id: string; provider: string; amount_cents: number }>;
    giftPurchases: Array<{ gifted_to?: number; item_id: string; provider: string; amount_cents: number }>;
    customizations: Array<{ developer_id: number; item_id: string; config?: Record<string, unknown> }>;
    achievements: Array<{ developer_id: number; achievement_id: string }>;
    raidTags: Array<{ building_id: number; attacker_login: string; tag_style: string; expires_at: string }>;
    stats: Record<string, unknown>;
  }) {
    const ownedItemsMap: Record<number, string[]> = {};
    for (const row of payload.purchases) {
      const developerId = typeof row.developer_id === "number" ? row.developer_id : Number(row.developer_id);
      const provider = typeof row.provider === "string" ? row.provider : "";
      const amountCents = typeof row.amount_cents === "number" ? row.amount_cents : Number(row.amount_cents);
      if (amountCents === 0 && ["stripe", "cashfree", "abacatepay", "nowpayments"].includes(provider)) {
        continue;
      }
      if (!ownedItemsMap[developerId]) ownedItemsMap[developerId] = [];
      ownedItemsMap[developerId].push(String(row.item_id));
    }
    for (const row of payload.giftPurchases) {
      const amountCents = typeof row.amount_cents === "number" ? row.amount_cents : Number(row.amount_cents);
      const provider = typeof row.provider === "string" ? row.provider : "";
      if (amountCents === 0 && ["stripe", "cashfree", "abacatepay", "nowpayments"].includes(provider)) {
        continue;
      }
      const devId = typeof row.gifted_to === "number" ? row.gifted_to : Number(row.gifted_to);
      if (!ownedItemsMap[devId]) ownedItemsMap[devId] = [];
      ownedItemsMap[devId].push(String(row.item_id));
    }

    const customColorMap: Record<number, string> = {};
    const billboardImagesMap: Record<number, string[]> = {};
    const ledBannerTextMap: Record<number, string> = {};
    const loadoutMap: Record<number, { crown: string | null; roof: string | null; aura: string | null; faces: string | null }> = {};
    const styleMap: Record<number, string> = {};
    const selectedTitleMap: Record<number, string> = {};
    for (const row of payload.customizations) {
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
      if (row.item_id === "building_style" && typeof config.style === "string") {
        styleMap[developerId] = config.style;
      }
      if (row.item_id === "led_banner" && typeof config.text === "string") {
        ledBannerTextMap[developerId] = config.text;
      }
      if (row.item_id === "selected_title" && typeof config.slug === "string") {
        selectedTitleMap[developerId] = config.slug;
      }
    }

    const achievementsMap: Record<number, string[]> = {};
    for (const row of payload.achievements) {
      const developerId = typeof row.developer_id === "number" ? row.developer_id : Number(row.developer_id);
      if (!achievementsMap[developerId]) achievementsMap[developerId] = [];
      achievementsMap[developerId].push(String(row.achievement_id));
    }

    const raidTagMap: Record<number, { attacker_login: string; tag_style: string; expires_at: string }> = {};
    for (const row of payload.raidTags) {
      const buildingId = typeof row.building_id === "number" ? row.building_id : Number(row.building_id);
      raidTagMap[buildingId] = {
        attacker_login: typeof row.attacker_login === "string" ? row.attacker_login : "",
        tag_style: typeof row.tag_style === "string" ? row.tag_style : "",
        expires_at: typeof row.expires_at === "string" ? row.expires_at : "",
      };
    }

    return {
      developers: payload.developers.map((dev) => {
        const normalizedDev = dev as CityDeveloperLike;
        const rawDev = normalizedDev as Record<string, unknown>;
        return this.buildDeveloperReadModel(normalizedDev, {
          ownedItems: ownedItemsMap[Number(rawDev.id)] ?? [],
          customColor: customColorMap[Number(rawDev.id)] ?? null,
          billboardImages: billboardImagesMap[Number(rawDev.id)] ?? [],
          ledBannerText: ledBannerTextMap[Number(rawDev.id)] ?? null,
          achievements: achievementsMap[Number(rawDev.id)] ?? [],
          loadout: asLoadout(loadoutMap[Number(rawDev.id)] ?? null),
          buildingStyle: styleMap[Number(rawDev.id)] ?? "tower",
          appStreak: asNumber(rawDev.app_streak, 0),
          raidXp: asNumber(rawDev.raid_xp, 0),
          kudosCount: asNumber(rawDev.kudos_count, 0),
          visitCount: asNumber(rawDev.visit_count, 0),
          currentWeekContributions: asNumber(rawDev.current_week_contributions, 0),
          currentWeekKudosGiven: asNumber(rawDev.current_week_kudos_given, 0),
          currentWeekKudosReceived: asNumber(rawDev.current_week_kudos_received, 0),
          activeRaidTag: asRaidTag(raidTagMap[Number(rawDev.id)] ?? null),
          rabbitCompleted: asBoolean(rawDev.rabbit_completed, false),
          xpTotal: asNumber(rawDev.xp_total, 0),
          xpLevel: asNumber(rawDev.xp_level, 1),
          selectedTitle: selectedTitleMap[Number(rawDev.id)] ?? null,
        });
      }),
      stats: payload.stats,
    };
  }

  private getCachedCityReadModel(options: CityLoadOptions): CityLoadResponse | null {
    const cached = getCityCache();
    const readModel = cached?.readModel as CityCacheReadModel | undefined;

    if (!readModel) {
      return null;
    }

    if (readModel.from !== options.from || readModel.to !== options.to) {
      return null;
    }

    return {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
      body: {
        developers: readModel.developers,
        stats: readModel.stats,
      },
    };
  }

  private cacheCityReadModel(options: CityLoadOptions, developers: Array<Record<string, CitySerializableValue>>, stats: Record<string, CitySerializableValue>) {
    const currentCache = getCityCache();

    setCityCache({
      buildings: currentCache?.buildings ?? [],
      plazas: currentCache?.plazas ?? [],
      decorations: currentCache?.decorations ?? [],
      districtZones: currentCache?.districtZones ?? [],
      river: currentCache?.river ?? null,
      bridges: currentCache?.bridges ?? [],
      canals: currentCache?.canals ?? [],
      stats: currentCache?.stats ?? { total_developers: 0, total_contributions: 0 },
      readModel: {
        from: options.from,
        to: options.to,
        developers,
        stats,
      },
    });
  }
}
