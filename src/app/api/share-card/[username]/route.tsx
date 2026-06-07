import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";

export const runtime = "nodejs";

const TIER_COLORS: Record<string, string> = {
  bronze: "#cd7f32",
  silver: "#c0c0c0",
  gold: "#ffd700",
  diamond: "#b9f2ff",
};

const TIER_ORDER = ["diamond", "gold", "silver", "bronze"];

const TIER_LABELS: Record<string, string> = {
  bronze: "RISING",
  silver: "SKILLED",
  gold: "ELITE",
  diamond: "LEGEND",
};

// ─── i18n ─────────────────────────────────────────────────────
type Lang = "en";

const i18n: Record<Lang, {
  inTheCity: string;
  commits: string;
  repos: string;
  stars: string;
  kudos: string;
  cta: string;
  notFound: string;
}> = {
  en: {
    inTheCity: "in the city",
    commits: "SOLVED",
    repos: "LC RANK",
    stars: "REP.",
    kudos: "KUDOS",
    cta: "Can you beat this?",
    notFound: "Developer not found",
  }
};

// ─── Colors ───────────────────────────────────────────────────
const accent = "#ffa116";
const bg = "#0d0d0f";
const cream = "#e8dcc8";
const border = "#2a2a30";
const cardBg = "#1c1c20";
const muted = "#8c8c9c";

// ─── Window renderer (shared) ─────────────────────────────────
const WSIZE = 24;
const WGAP = 10;
const WCOLS = 5;

function renderWindows(bHeight: number, color: string) {
  const rowH = WSIZE + WGAP;
  const usable = bHeight - 36;
  const nRows = Math.max(2, Math.floor(usable / rowH));
  const rows = [];
  for (let r = 0; r < nRows; r++) {
    const cells = [];
    for (let c = 0; c < WCOLS; c++) {
      const lit = (r * 5 + c * 3) % 7 > 1;
      cells.push(
        <div
          key={c}
          style={{
            width: WSIZE,
            height: WSIZE,
            backgroundColor: lit ? color : `${color}18`,
          }}
        />
      );
    }
    rows.push(
      <div key={r} style={{ display: "flex", gap: WGAP }}>
        {cells}
      </div>
    );
  }
  return rows;
}

// ─── GET handler ──────────────────────────────────────────────
/**
 * @param {import('next/server').NextRequest} request
 * @param {{ params: any }} context
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const format = request.nextUrl.searchParams.get("format") ?? "landscape";
  const lang = "en"; // Hardcoded to English per maintainer instructions

  const fontData = await readFile(
    join(process.cwd(), "public/fonts/Silkscreen-Regular.ttf")
  );

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: dev } = await supabase
    .from("developers")
    .select(
      "id, github_login, name, avatar_url, contributions, contributions_total, public_repos, total_stars, rank, kudos_count"
    )
    .eq("github_login", username.toLowerCase())
    .single();

  if (!dev) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: bg,
            fontFamily: "Silkscreen",
            color: cream,
            fontSize: 48,
            border: `6px solid ${border}`,
          }}
        >
          {i18n[lang].notFound}
        </div>
      ),
      {
        width: 1200,
        height: 675,
        fonts: [
          {
            name: "Silkscreen",
            data: fontData,
            style: "normal" as const,
            weight: 400 as const,
          },
        ],
      }
    );
  }

  // Fetch achievements
  const { data: devAchievements } = await supabase
    .from("developer_achievements")
    .select("achievement_id, achievements(name, tier)")
    .eq("developer_id", dev.id);

  const achievements = (devAchievements ?? []).map(
    (a: Record<string, unknown>) => ({
      name:
        ((a.achievements as Record<string, unknown>)?.name as string) ??
        (a.achievement_id as string),
      tier:
        ((a.achievements as Record<string, unknown>)?.tier as string) ??
        "bronze",
    })
  );

  // Find highest tier
  const highestTier =
    achievements.length > 0
      ? TIER_ORDER.find((tier) => achievements.some((a) => a.tier === tier)) ??
      "bronze"
      : null;

  // Fetch selected custom title from developer_customizations
  const { data: titleCustomization } = await supabase
    .from("developer_customizations")
    .select("config")
    .eq("developer_id", dev.id)
    .eq("item_id", "selected_title")
    .maybeSingle();

  const titleSlug =
    (titleCustomization?.config as Record<string, unknown>)?.slug as string | null ?? null;

  // Resolve slug to a human-readable display name via arena_items
  let titleLabel: string | null = null;
  if (titleSlug) {
    const { data: titleItem } = await supabase
      .from("arena_items")
      .select("name")
      .eq("slug", titleSlug)
      .maybeSingle();
    // Fall back to raw slug if the arena_items row is missing (e.g. developer-reserved titles)
    titleLabel = titleItem?.name ?? titleSlug;
  }

  // Effective contributions (matches rank calculation)
  const contribs = (dev.contributions_total && dev.contributions_total > 0) ? dev.contributions_total : dev.contributions;
  const devEff = { ...dev, contributions: contribs };

  const t = i18n[lang];
  if (format === "stories") {
    return renderStories(devEff, achievements, highestTier, titleLabel, fontData, t);
  }
  return renderLandscape(devEff, achievements, highestTier, titleLabel, fontData, t);
}

// ─── Landscape (1200x675) ─────────────────────────────────────
function renderLandscape(
  dev: Record<string, unknown>,
  achievements: { name: string; tier: string }[],
  highestTier: string | null,
  titleLabel: string | null,
  fontData: Buffer,
  t: typeof i18n.en
) {
  const buildingH = Math.round(
    Math.min(
      520,
      Math.max(320, 320 + ((dev.contributions as number) / 1000) * 160)
    )
  );
  const GROUND_Y = 590;

  const stats = [
    { label: t.commits, value: (dev.contributions as number).toLocaleString() },
    { label: t.repos, value: (dev.public_repos as number).toLocaleString() },
    { label: t.stars, value: (dev.total_stars as number).toLocaleString() },
    { label: t.kudos, value: ((dev.kudos_count as number) ?? 0).toLocaleString() },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: bg,
          fontFamily: "Silkscreen",
          border: `6px solid ${border}`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Building */}
        <div
          style={{
            position: "absolute",
            left: 80,
            top: GROUND_Y - buildingH,
            width: 260,
            height: buildingH,
            backgroundColor: cardBg,
            borderTop: `6px solid ${accent}`,
            borderLeft: `3px solid ${accent}50`,
            borderRight: `3px solid ${accent}50`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingTop: 16,
            gap: WGAP,
          }}
        >
          {renderWindows(buildingH, accent)}
        </div>

        {/* Right column */}
        <div
          style={{
            position: "absolute",
            left: 420,
            top: 36,
            width: 720,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Avatar + Name */}
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            {dev.avatar_url ? (
              <img
                src={dev.avatar_url as string}
                width={110}
                height={110}
                style={{ border: `4px solid ${accent}` }}
              />
            ) : null}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {dev.name ? (
                <div
                  style={{
                    display: "flex",
                    fontSize: 44,
                    color: cream,
                    textTransform: "uppercase",
                  }}
                >
                  {dev.name as string}
                </div>
              ) : null}
              <div
                style={{
                  display: "flex",
                  fontSize: 24,
                  color: muted,
                  textTransform: "uppercase",
                }}
              >
                {`@${dev.github_login}`}
              </div>
              {/* Custom title badge — rendered between @username and rank pill */}
              {titleLabel ? (
                <div
                  style={{
                    display: "flex",
                    fontSize: 16,
                    color: accent,
                    border: `2px solid ${accent}`,
                    padding: "3px 12px",
                    textTransform: "uppercase",
                    marginTop: 2,
                  }}
                >
                  {titleLabel}
                </div>
              ) : null}
              {dev.rank ? (
                <div
                  style={{
                    display: "flex",
                    fontSize: 18,
                    color: accent,
                    border: `3px solid ${accent}`,
                    padding: "4px 14px",
                    marginTop: 2,
                    textTransform: "uppercase",
                  }}
                >
                  {`#${dev.rank} ${t.inTheCity}`}
                </div>
              ) : null}
            </div>
          </div>

          {/* Stats 2x2 */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              marginTop: 30,
            }}
          >
            {stats.map((stat) => (
              <div
                key={stat.label}
                style={{
                  width: 310,
                  display: "flex",
                  flexDirection: "column",
                  backgroundColor: cardBg,
                  border: `3px solid ${border}`,
                  padding: "12px 20px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: 16,
                    color: muted,
                    textTransform: "uppercase",
                  }}
                >
                  {stat.label}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: 40,
                    color: accent,
                    marginTop: 2,
                  }}
                >
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* Achievements + Tier label */}
          {achievements.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginTop: 20,
                flexWrap: "wrap",
              }}
            >
              {highestTier && (
                <div
                  style={{
                    display: "flex",
                    fontSize: 18,
                    color: TIER_COLORS[highestTier],
                    border: `3px solid ${TIER_COLORS[highestTier]}`,
                    padding: "4px 14px",
                    textTransform: "uppercase",
                  }}
                >
                  {TIER_LABELS[highestTier] ?? highestTier.toUpperCase()}
                </div>
              )}
              {achievements.slice(0, 4).map((ach, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    fontSize: 12,
                    color: TIER_COLORS[ach.tier] ?? accent,
                    border: `2px solid ${TIER_COLORS[ach.tier] ?? accent}`,
                    padding: "3px 10px",
                    textTransform: "uppercase",
                  }}
                >
                  {ach.name}
                </div>
              ))}
              {achievements.length > 4 && (
                <div
                  style={{
                    display: "flex",
                    fontSize: 12,
                    color: muted,
                  }}
                >
                  +{achievements.length - 4}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ground line */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: GROUND_Y,
            width: 1200,
            height: 4,
            backgroundColor: accent,
            display: "flex",
          }}
        />

        {/* Ground fill */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: GROUND_Y + 4,
            width: 1200,
            height: 90,
            backgroundColor: "#141418",
            display: "flex",
          }}
        />

        {/* Branding bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 14,
            left: 0,
            width: 1200,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0 40px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              textTransform: "uppercase",
            }}
          >
            <span style={{ fontSize: 24, color: cream }}>LEETCODE</span>
            <span style={{ fontSize: 24, color: accent }}>CITY</span>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 16,
              color: muted,
              textTransform: "uppercase",
            }}
          >
            theleetcodecity.tech/dev/{dev.github_login as string}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 675,
      fonts: [
        {
          name: "Silkscreen",
          data: fontData,
          style: "normal" as const,
          weight: 400 as const,
        },
      ],
    }
  );
}

// ─── Taunt phrases by rank/contributions ──────────────────────
const TAUNTS: Record<Lang, { rank: [number, string][]; contribs: [number, string][]; fallback: string }> = {
  en: {
    rank: [
      [5, "I AM THE SKYLINE"],
      [15, "THE VIEW FROM UP HERE IS INSANE"],
      [50, "I CAN SEE YOUR BUILDING FROM HERE"],
      [100, "MY ELEVATOR DOESN'T GO THAT LOW"],
      [250, "PENTHOUSE VIBES ONLY"],
      [500, "MY BUILDING HAS A ROOFTOP POOL"],
      [1000, "NOT BAD FOR SOMEONE WHO SLEEPS"],
    ],
    contribs: [
      [5000, "I DON'T TOUCH GRASS. I PUSH CODE."],
      [2000, "YOUR BUILDING FITS IN MY LOBBY"],
      [1000, "MY COMMITS HAVE COMMITS"],
      [500, "TALLER THAN YOUR ATTENTION SPAN"],
      [200, "SMALL BUILDING, BIG ENERGY"],
      [50, "EVERY SKYSCRAPER STARTS SOMEWHERE"],
    ],
    fallback: "JUST MOVED IN. WATCH ME GROW.",
  }
};

function getTaunt(rank: number | null, contributions: number): string {
  const t = TAUNTS["en"];
  if (rank) {
    for (const [threshold, phrase] of t.rank) {
      if (rank <= threshold) return phrase;
    }
  }
  for (const [threshold, phrase] of t.contribs) {
    if (contributions >= threshold) return phrase;
  }
  return t.fallback;
}

// ─── Stories (1080x1920) ──────────────────────────────────────
function renderStories(
  dev: Record<string, unknown>,
  achievements: { name: string; tier: string }[],
  highestTier: string | null,
  titleLabel: string | null,
  fontData: Buffer,
  t: typeof i18n.en
) {
  const contributions = dev.contributions as number;
  const rank = dev.rank as number | null;
  const buildingH = Math.round(
    Math.min(750, Math.max(500, 500 + (contributions / 1000) * 200))
  );
  const BWIDTH = 320;
  const GROUND_Y = 1320;
  const taunt = getTaunt(rank, contributions);

  const stats = [
    { label: t.commits, value: contributions.toLocaleString() },
    { label: t.stars, value: dev.total_stars?.toLocaleString() || "0" },
    { label: t.repos, value: (dev.rank as number)?.toLocaleString() ?? (dev.public_repos as number).toLocaleString() },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: bg,
          fontFamily: "Silkscreen",
          position: "relative",
          overflow: "hidden",
          alignItems: "center",
        }}
      >
        {/* ── Taunt ── */}
        <div
          style={{
            position: "absolute",
            top: 150,
            width: 920,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 36,
              color: accent,
              textTransform: "uppercase",
              textAlign: "center",
              justifyContent: "center",
            }}
          >
            &ldquo;{taunt}&rdquo;
          </div>
        </div>

        {/* ── Profile ── */}
        <div
          style={{
            position: "absolute",
            top: 230,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: 920,
          }}
        >
          {dev.avatar_url ? (
            <img
              src={dev.avatar_url as string}
              width={110}
              height={110}
              style={{ border: `4px solid ${accent}` }}
            />
          ) : null}
          {dev.name ? (
            <div
              style={{
                display: "flex",
                fontSize: 42,
                color: cream,
                textTransform: "uppercase",
                marginTop: 16,
                textAlign: "center",
                justifyContent: "center",
              }}
            >
              {dev.name as string}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              fontSize: 22,
              color: muted,
              textTransform: "uppercase",
              marginTop: 6,
            }}
          >
            @{dev.github_login as string}
          </div>
          {/* Custom title badge — rendered between @username and rank/tier pills */}
          {titleLabel ? (
            <div
              style={{
                display: "flex",
                fontSize: 18,
                color: accent,
                border: `2px solid ${accent}`,
                padding: "4px 14px",
                textTransform: "uppercase",
                marginTop: 8,
              }}
            >
              {titleLabel}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: 10,
            }}
          >
            {rank ? (
              <div
                style={{
                  display: "flex",
                  fontSize: 18,
                  color: accent,
                  border: `3px solid ${accent}`,
                  padding: "5px 14px",
                  textTransform: "uppercase",
                }}
              >
                #{rank} {t.inTheCity}
              </div>
            ) : null}
            {highestTier ? (
              <div
                style={{
                  display: "flex",
                  fontSize: 18,
                  color: TIER_COLORS[highestTier],
                  border: `3px solid ${TIER_COLORS[highestTier]}`,
                  padding: "5px 14px",
                  textTransform: "uppercase",
                }}
              >
                {TIER_LABELS[highestTier] ?? highestTier.toUpperCase()}
              </div>
            ) : null}
          </div>
        </div>

        {/* ── Building ── */}
        <div
          style={{
            position: "absolute",
            left: (1080 - BWIDTH) / 2,
            top: GROUND_Y - buildingH,
            width: BWIDTH,
            height: buildingH,
            backgroundColor: cardBg,
            borderTop: `6px solid ${accent}`,
            borderLeft: `3px solid ${accent}50`,
            borderRight: `3px solid ${accent}50`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingTop: 16,
            gap: WGAP,
          }}
        >
          {renderWindows(buildingH, accent)}
        </div>

        {/* ── Ground line ── */}
        <div
          style={{
            position: "absolute",
            left: 100,
            top: GROUND_Y,
            width: 880,
            height: 4,
            backgroundColor: accent,
            display: "flex",
          }}
        />

        {/* ── Stats ── */}
        <div
          style={{
            position: "absolute",
            top: GROUND_Y + 36,
            left: 100,
            width: 880,
            display: "flex",
            justifyContent: "space-around",
          }}
        >
          {stats.map((stat) => (
            <div
              key={stat.label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", fontSize: 50, color: accent }}>
                {stat.value}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 16,
                  color: muted,
                  textTransform: "uppercase",
                  marginTop: 4,
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Achievement badges ── */}
        {achievements.length > 0 ? (
          <div
            style={{
              position: "absolute",
              top: GROUND_Y + 150,
              left: 80,
              width: 920,
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              justifyContent: "center",
            }}
          >
            {achievements.slice(0, 5).map((ach, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  fontSize: 15,
                  color: TIER_COLORS[ach.tier] ?? accent,
                  border: `2px solid ${TIER_COLORS[ach.tier] ?? accent}`,
                  padding: "4px 10px",
                  textTransform: "uppercase",
                }}
              >
                {ach.name}
              </div>
            ))}
          </div>
        ) : null}

        {/* ── Challenge CTA ── */}
        <div
          style={{
            position: "absolute",
            top: GROUND_Y + 220,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: 1080,
            gap: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 26,
              color: bg,
              backgroundColor: accent,
              padding: "14px 44px",
              textTransform: "uppercase",
            }}
          >
            {t.cta} → theleetcodecity.tech
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              textTransform: "uppercase",
            }}
          >
            <span style={{ fontSize: 20, color: cream }}>LEETCODE</span>
            <span style={{ fontSize: 20, color: accent }}>CITY</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      fonts: [
        {
          name: "Silkscreen",
          data: fontData,
          style: "normal" as const,
          weight: 400 as const,
        },
      ],
    }
  );
}