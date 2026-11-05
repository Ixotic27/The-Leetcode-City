// ─── Types ───────────────────────────────────────────────────

export interface DeveloperRecord {
  id: number;
  github_login: string;
  github_id: number | null;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
  contributions: number;
  public_repos: number;
  total_stars: number;
  primary_language: string | null;
  top_repos?: TopRepo[];
  rank: number | null;
  fetched_at: string;
  created_at: string;
  claimed: boolean;
  fetch_priority: number;
  claimed_at: string | null;
  district?: string | null;
  district_chosen?: boolean; // `district` was picked by the user, not backfilled
  owned_items?: string[];
  custom_color?: string | null;
  billboard_images?: string[];
  // v2 fields (optional for backward compat)
  contributions_total?: number;
  contribution_years?: number[];
  total_prs?: number;
  total_reviews?: number;
  total_issues?: number;
  repos_contributed_to?: number;
  followers?: number;
  following?: number;
  organizations_count?: number;
  account_created_at?: string | null;
  current_streak?: number;
  longest_streak?: number;
  active_days_last_year?: number;
  language_diversity?: number;
  // XP fields
  xp_total?: number;
  xp_level?: number;
  xp_github?: number;
  building_style?: string; // bungalow | tower
  // LeetCode-specific fields
  easy_solved?: number;
  medium_solved?: number;
  hard_solved?: number;
  acceptance_rate?: number;
  contest_rating?: number;
  lc_streak?: number;
}

export interface TopRepo {
  name: string;
  stars: number;
  language: string | null;
  url: string;
}

export interface CityBuilding {
  login: string;
  rank: number;
  contributions: number;       // LC: total problems solved
  total_stars: number;         // LC: reputation
  public_repos: number;        // LC: rank boost (500000 - lc_rank)
  name: string | null;
  avatar_url: string | null;
  primary_language: string | null;
  claimed: boolean;
  owned_items: string[];
  custom_color?: string | null;
  billboard_images?: string[];
  led_banner_text?: string | null;
  achievements: string[];
  kudos_count: number;
  visit_count: number;
  loadout?: { crown: string | null; roof: string | null; aura: string | null; faces: string | null } | null;
  app_streak: number;
  raid_xp: number;
  current_week_contributions: number;
  current_week_kudos_given: number;
  current_week_kudos_received: number;
  active_raid_tag?: { attacker_login: string; tag_style: string; expires_at: string } | null;
  rabbit_completed: boolean;
  xp_total: number;
  xp_level: number;
  district?: string;
  district_chosen?: boolean;
  position: [number, number, number];
  width: number;
  depth: number;
  height: number;
  floors: number;
  windowsPerFloor: number;
  sideWindowsPerFloor: number;
  litPercentage: number;
  // LeetCode-specific fields
  easy_solved?: number;      // → green window lights (bottom floors)
  medium_solved?: number;    // → yellow window lights (mid floors)
  hard_solved?: number;      // → red window lights (top floors)
  acceptance_rate?: number;  // → building width modifier
  contest_rating?: number;   // → building depth modifier
  lc_streak?: number;        // → pulsing glow if > 30 days
  building_style?: string;
  selected_title?: string | null;
}

export interface CityPlaza {
  position: [number, number, number];
  size: number;
  variant: number; // 0-1 seeded random for visual variety
  district?: string;
  city?: string;
  reach?: [number, number]; // half-extent [x, z] of the district, out to its waterfront promenade
}

export interface CityRiver {
  x: number;
  width: number;
  length: number;
  centerZ: number;
}

export interface CityBridge {
  position: [number, number, number];
  width: number;
  rotation: number; // radians around Y axis
}

export interface CityCanal {
  position: [number, number, number]; // center of canal
  width: number;   // canal width (narrow dimension)
  length: number;  // canal length (long dimension)
  rotation: number; // radians around Y axis
  district?: string;
}

export interface CityDecoration {
  type: 'tree' | 'streetLamp' | 'car' | 'bench' | 'fountain' | 'sidewalk' | 'roadMarking' | 'roadSurface'
    | 'autoRickshaw' | 'chaiStall' | 'templeGopuram' | 'techParkSign'
    | 'nandiBull' | 'gatewayArch' | 'clockTower'
    | 'vidhanaSoudha' | 'bangalorePalace' | 'tipuFortWall' | 'busStop'
    | 'gatewayOfIndia' | 'charminar' | 'indiaGate' | 'marinaLighthouse' | 'shaniwarWada' | 'isroRocket'
    | 'landmarkSite'; // a paved downtown lot reserved for one of the custom landmark models (lib/city/landmarks.ts)
  position: [number, number, number];
  rotation: number;
  variant: number;
  size?: [number, number];
}

// ─── City Master Plan ────────────────────────────────────────
// Each district is built on the same lattice of 4x4-lot blocks, mirrored into four quadrants
// around a civic square, and grows ring by ring. The districts are then set on their compass
// slots (from DISTRICT_ORIGINS) with column/row widths taken from their actual size, so any
// population fits and islands never touch. Inside a district the axes and the lines at
// METRO_OFFSET are avenues kept clear for the inter-city links, trams and metro. Every solid
// thing gets a slot the plan reserves: buildings on lots, lamps and trees on sidewalks, parked
// cars on the curb lane, monuments on the square, small landmarks and ponds in park blocks.
// Nothing is nudged after placement, so nothing overlaps (checked by src/lib/city/layoutAudit.ts).

const BLOCK_SIZE = 4;     // 4x4 lots per block
const LOT_W = 38;         // lot width  (X axis)
const LOT_D = 32;         // lot depth  (Z axis)
const ALLEY_W = 3;        // gap between lots inside a block
const BLOCK_FOOTPRINT_X = BLOCK_SIZE * LOT_W + (BLOCK_SIZE - 1) * ALLEY_W; // 161
const BLOCK_FOOTPRINT_Z = BLOCK_SIZE * LOT_D + (BLOCK_SIZE - 1) * ALLEY_W; // 137
const BUNGALOW_W = 2 * LOT_W + ALLEY_W - 2; // a bungalow fills a 2x2 lot
const BUNGALOW_D = 2 * LOT_D + ALLEY_W - 2;
const SIDEWALK_W = 6;     // paved band around every block: lamps and trees stand here
const ROAD_W = 14;        // two lanes; the outer one is the parking lane
const AVENUE_W = 40;      // district axes and the metro boulevards
const METRO_OFFSET = 450; // MetroSystem runs its elevated line along origin + 450 on both axes
const BOULEVARD_LANE = 16;   // each carriageway of a metro boulevard
const BOULEVARD_MEDIAN = 36; // between them: room for MetroSystem's piers (r 6.4) and station footings (±16)
const PROMENADE_W = 14;   // tree-lined waterfront walk outside the ring road
const CHANNEL_W = 480;    // open water between neighbouring districts: river plus both shores
const PARK_SHARE = 0.1;   // share of blocks kept as parks (pond, landmark, trees)
const QUADRANT_SIGNS: [number, number][] = [[1, 1], [-1, 1], [1, -1], [-1, -1]];

/** Near-edge offsets of block footprints along one quadrant axis, leaving a boulevard centred on the metro line. */
function laneStarts(footprint: number, count: number): number[] {
  const starts: number[] = [];
  let start = AVENUE_W / 2 + SIDEWALK_W;
  while (starts.length < count) {
    const outer = start + footprint + SIDEWALK_W;
    if (start - SIDEWALK_W < METRO_OFFSET + AVENUE_W / 2 && outer > METRO_OFFSET - AVENUE_W / 2) {
      // Mirror the previous block's edge across the metro line so the boulevard is symmetric.
      start = 2 * METRO_OFFSET - (start - ROAD_W - SIDEWALK_W) + SIDEWALK_W;
      continue;
    }
    starts.push(start);
    start = outer + ROAD_W + SIDEWALK_W;
  }
  return starts;
}

// 64 rings hold ~59k residents per quadrant; the scale test covers 100k residents in one district.
const LANE_COUNT = 64;
const COL_STARTS = laneStarts(BLOCK_FOOTPRINT_X, LANE_COUNT);
const ROW_STARTS = laneStarts(BLOCK_FOOTPRINT_Z, LANE_COUNT);

/** Quadrant cells in fill order, ring by ring outward. Cell (0, 0) of each quadrant is the civic square. */
const QUADRANT_CELLS: [number, number][] = (() => {
  const cells: [number, number][] = [];
  for (let gx = 0; gx < LANE_COUNT; gx++) for (let gz = 0; gz < LANE_COUNT; gz++) if (gx || gz) cells.push([gx, gz]);
  return cells.sort((a, b) => Math.max(...a) - Math.max(...b) || a[0] + a[1] - b[0] - b[1] || a[0] - b[0]);
})();

/** Half-size of the paved civic square at each district origin (the four (0, 0) cells and the avenues between). */
const CIVIC_HALF_X = COL_STARTS[0] + BLOCK_FOOTPRINT_X; // 187
const CIVIC_HALF_Z = ROW_STARTS[0] + BLOCK_FOOTPRINT_Z; // 163, still clear of TramSystem's ~150 loop
/** Bus stop slot in the civic square's north-east corner, outside the tram loop (BusTransit draws the shelter here). */
export const BUS_STOP_OFFSET: [number, number] = [CIVIC_HALF_X - 20, CIVIC_HALF_Z - 20];



const MAX_BUILDING_HEIGHT = 600;
const MIN_BUILDING_HEIGHT = 35;
const HEIGHT_RANGE = MAX_BUILDING_HEIGHT - MIN_BUILDING_HEIGHT; // 565

function calcHeight(
  contributions: number,
  totalStars: number,
  publicRepos: number,
  maxContrib: number,
  maxStars: number,
): { height: number; composite: number } {
  const effMaxC = Math.min(maxContrib, 20_000);
  const effMaxS = Math.min(maxStars, 200_000);

  // Normalize to 0-1 (can exceed 1 for outliers)
  const cNorm = contributions / Math.max(1, effMaxC);
  const sNorm = totalStars / Math.max(1, effMaxS);
  const rNorm = Math.min(publicRepos / 200, 1);

  // Power curves — exponent < 1 compresses, > 0.5 gives more contrast than sqrt
  const cScore = Math.pow(Math.min(cNorm, 3), 0.55);   // contributions (allow up to 3x max)
  const sScore = Math.pow(Math.min(sNorm, 3), 0.45);   // stars (more generous curve)
  const rScore = Math.pow(rNorm, 0.5);                   // repos

  // Weights: contributions dominate, but stars matter a lot
  const composite = cScore * 0.55 + sScore * 0.35 + rScore * 0.10;

  const height = Math.min(MAX_BUILDING_HEIGHT, MIN_BUILDING_HEIGHT + composite * HEIGHT_RANGE);
  return { height, composite };
}

// ─── V2 Detection & Formulas ────────────────────────────────

function isV2Dev(dev: DeveloperRecord): boolean {
  // LeetCode-seeded devs have contributions_total=1000 and active_days_last_year=365
  // as placeholder values. Only treat as V2 if there are real GitHub-specific signals.
  const hasRealGitHubData = Boolean(
    (dev.contribution_years?.length ?? 0) > 0 ||
    (dev.total_prs ?? 0) > 0 ||
    (dev.total_reviews ?? 0) > 0 ||
    (dev.repos_contributed_to ?? 0) > 0 ||
    dev.account_created_at ||
    (dev.language_diversity ?? 0) > 0
  );
  // contributions_total=1000 with active_days_last_year=365 is a LeetCode placeholder pattern
  const isLcPlaceholder = (dev.contributions_total === 1000 && dev.active_days_last_year === 365 && !dev.account_created_at);
  return hasRealGitHubData && !isLcPlaceholder;
}

function calcHeightV2(
  dev: DeveloperRecord,
  maxContribV2: number,
  maxStars: number,
): { height: number; composite: number } {
  const contribs = dev.contributions;

  const cNorm = contribs / Math.max(1, Math.min(maxContribV2, 50_000));
  const sNorm = dev.total_stars / Math.max(1, Math.min(maxStars, 200_000));
  const prNorm = ((dev.total_prs ?? 0) + (dev.total_reviews ?? 0)) / 5_000;
  const extNorm = (dev.repos_contributed_to ?? 0) / 100;
  const fNorm = Math.log10(Math.max(1, dev.followers ?? 0)) / Math.log10(50_000);

  // Consistency: years active / account age
  const dateStr = dev.account_created_at || dev.created_at;
  const parsedDate = dateStr ? new Date(dateStr) : null;
  const dateMs = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate.getTime() : 0;
  const accountAgeYears = dateMs > 0
    ? Math.max(1, (Date.now() - dateMs) / (365.25 * 24 * 60 * 60 * 1000))
    : 1; // Fallback: assume 1 year if no date available
  const yearsActive = dev.contribution_years?.length || 1;
  const consistencyRaw = (yearsActive / accountAgeYears) * Math.min(1, contribs / (accountAgeYears * 200));
  const consistencyNorm = Math.min(1, consistencyRaw);

  const cScore = Math.pow(Math.min(cNorm, 3), 0.55);
  const sScore = Math.pow(Math.min(sNorm, 3), 0.45);
  const prScore = Math.pow(Math.min(prNorm, 2), 0.5);
  const extScore = Math.pow(Math.min(extNorm, 2), 0.5);
  const fScore = Math.pow(Math.min(fNorm, 2), 0.5);
  const cnsScore = Math.pow(consistencyNorm, 0.6);

  const composite =
    cScore * 0.35 +
    sScore * 0.20 +
    prScore * 0.15 +
    extScore * 0.10 +
    cnsScore * 0.10 +
    fScore * 0.10;

  const height = Math.min(MAX_BUILDING_HEIGHT, MIN_BUILDING_HEIGHT + composite * HEIGHT_RANGE);
  return { height, composite };
}

function calcWidthV2(dev: DeveloperRecord): number {
  const repoNorm = Math.min(1, dev.public_repos / 200);
  const langNorm = Math.min(1, (dev.language_diversity ?? 1) / 10);
  const topStarNorm = Math.min(1, (dev.top_repos?.[0]?.stars ?? 0) / 50_000);

  const score =
    Math.pow(repoNorm, 0.5) * 0.50 +
    Math.pow(langNorm, 0.6) * 0.30 +
    Math.pow(topStarNorm, 0.4) * 0.20;

  const jitter = (seededRandom(hashStr(dev.github_login)) - 0.5) * 4;
  return Math.round(14 + score * 24 + jitter);
}

function calcDepthV2(dev: DeveloperRecord): number {
  const extNorm = Math.min(1, (dev.repos_contributed_to ?? 0) / 100);
  const orgNorm = Math.min(1, (dev.organizations_count ?? 0) / 10);
  const prNorm = Math.min(1, (dev.total_prs ?? 0) / 1_000);
  const ratioNorm = (dev.followers ?? 0) > 0
    ? Math.min(1, ((dev.followers ?? 0) / Math.max(1, dev.following ?? 1)) / 10)
    : 0;

  const score =
    Math.pow(extNorm, 0.5) * 0.40 +
    Math.pow(orgNorm, 0.5) * 0.25 +
    Math.pow(prNorm, 0.5) * 0.20 +
    Math.pow(ratioNorm, 0.5) * 0.15;

  const jitter = (seededRandom(hashStr(dev.github_login) + 99) - 0.5) * 4;
  return Math.round(12 + score * 20 + jitter);
}

function calcLitPercentageV2(dev: DeveloperRecord): number {
  const activeDaysNorm = Math.min(1, (dev.active_days_last_year ?? 0) / 300);
  const streakNorm = Math.min(1, (dev.current_streak ?? 0) / 100);

  const avgPerYear = (dev.contributions_total ?? 0) / Math.max(1, dev.contribution_years?.length ?? 1);
  const trendRaw = avgPerYear > 0 ? dev.contributions / avgPerYear : 1;
  const trendNorm = Math.min(2, Math.max(0, trendRaw)) / 2;

  const score =
    activeDaysNorm * 0.60 +
    streakNorm * 0.25 +
    trendNorm * 0.15;

  return 0.05 + score * 0.90;
}

export interface DistrictZone {
  id: string;
  name: string;
  center: [number, number, number];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  population: number;
  color: string;
}



function precomputeComposites(
  devs: DeveloperRecord[],
  maxContrib: number,
  maxStars: number,
  maxContribV2: number,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const dev of devs) {
    const { composite } = isV2Dev(dev)
      ? calcHeightV2(dev, maxContribV2, maxStars)
      : calcHeight(dev.contributions, dev.total_stars, dev.public_repos, maxContrib, maxStars);
    map.set(dev.github_login, composite);
  }
  return map;
}

// ─── District Layout ────────────────────────────────────────

export const DISTRICT_NAMES: Record<string, string> = {
  downtown: 'Bengaluru',
  frontend: 'Mumbai', backend: 'Hyderabad', fullstack: 'Delhi',
  mobile: 'Pune', data_ai: 'Ahmedabad', devops: 'Kolkata',
  security: 'Chennai', gamedev: 'Nandi Hills', vibe_coder: 'Goa',
  creator: 'Gurugram',
};

export const DISTRICT_COLORS: Record<string, string> = {
  // Using LeetCode City Theme Palette where possible, otherwise complimentary bright pixel colors
  downtown: '#ffa116', // Lime (Leetcode Accent)
  frontend: '#e8dcc8', // Cream
  backend: '#c8b89c', // Cream Dark
  fullstack: '#cc8111', // Lime Dark
  mobile: '#5a7a00', // Pixel Shadow Lime
  data_ai: '#06b6d4',
  devops: '#dc2626',
  security: '#3b82f6',
  gamedev: '#ec4899',
  vibe_coder: '#8b5cf6',
  creator: '#eab308',
};

// Compass slots only (column = x / 3500, row = z / 4000 around downtown). Real district positions
// depend on population: read them from the layout's plazas, one per district at its civic square.
export const DISTRICT_ORIGINS: Record<string, [number, number, number]> = {
  downtown: [500, 0, 500],
  frontend: [500, 0, 4500],
  backend: [4000, 0, 500],
  fullstack: [500, 0, -3500],
  security: [4000, 0, 4500],       // Chennai
  algorithms: [4000, 0, 4500],     // Chennai alias
  mobile: [-3000, 0, 500],           // Pune
  devops: [-3000, 0, -3500],       // Kolkata
  data_ai: [-3000, 0, 4500],       // Ahmedabad
  data: [-3000, 0, 4500],          // Ahmedabad alias
  gamedev: [4000, 0, -3500],       // Nandi Hills
  vibe_coder: [-6500, 0, 500],       // Goa
  creator: [500, 0, -7500],          // Gurugram
};

export const DISTRICT_DESCRIPTIONS: Record<string, string> = {
  downtown: 'The elite core. Top 50 devs by global rank.',
  frontend: 'Startup hustle, cafes, and front-end magic.',
  backend: 'Massive enterprise tech parks and server farms.',
  fullstack: 'Premium shops, hip cafes, and full-stack devs.',
  mobile: 'The next big app starts here.',
  data_ai: 'Big data lakes and AI research centers.',
  devops: 'The ultimate gauntlet of deployment and traffic jams.',
  security: 'Fortified walls and cryptography experts.',
  gamedev: 'Weekend escapades and physics engines.',
  vibe_coder: 'Aesthetic code. Filter coffee and good vibes.',
  creator: 'Open-source tools and content creators.',
};

const LANGUAGE_TO_DISTRICT: Record<string, string> = {
  TypeScript: 'frontend', JavaScript: 'frontend', CSS: 'frontend',
  HTML: 'frontend', SCSS: 'frontend', Vue: 'frontend', Svelte: 'frontend',
  Java: 'backend', Go: 'backend', Rust: 'backend', 'C#': 'backend',
  PHP: 'backend', Ruby: 'backend', Elixir: 'backend', C: 'backend',
  'C++': 'backend', Assembly: 'backend', Verilog: 'backend', VHDL: 'backend',
  Python: 'data_ai', 'Jupyter Notebook': 'data_ai', R: 'data_ai', Julia: 'data_ai',
  Swift: 'mobile', Kotlin: 'mobile', Dart: 'mobile', 'Objective-C': 'mobile',
  HCL: 'devops', Shell: 'devops', Dockerfile: 'devops', Nix: 'devops',
  GDScript: 'gamedev', Lua: 'gamedev',
};

export function inferDistrict(lang: string | null): string {
  if (!lang) return 'fullstack';
  return LANGUAGE_TO_DISTRICT[lang] ?? 'fullstack';
}

const CITY_DISTRICTS = [
  'backend', 'frontend', 'fullstack', 'data_ai', 'devops',
  'mobile', 'gamedev', 'vibe_coder', 'creator', 'security',
];

function developerDistrict(dev: DeveloperRecord): string {
  // Migration 019 backfilled `district` for everyone; only a district the user picked counts.
  const chosen = !dev.district_chosen ? null
    : dev.district === 'data' ? 'data_ai' : dev.district === 'algorithms' ? 'security' : dev.district;
  if (chosen && Object.hasOwn(DISTRICT_ORIGINS, chosen)) return chosen;
  const byLanguage = dev.primary_language ? LANGUAGE_TO_DISTRICT[dev.primary_language] : undefined;
  if (byLanguage) return byLanguage;
  // LeetCode profiles rarely carry a language: spread everyone else evenly and stably by login.
  return CITY_DISTRICTS[hashStr(dev.github_login) % CITY_DISTRICTS.length];
}

// Monuments stand on fixed spots of the civic square, inside TramSystem's loop.
const DISTRICT_MONUMENTS: Record<string, CityDecoration['type'][]> = {
  downtown: ['vidhanaSoudha', 'isroRocket'],
  frontend: ['gatewayOfIndia'],
  backend: ['charminar'],
  fullstack: ['indiaGate'],
  security: ['marinaLighthouse'],
  mobile: ['shaniwarWada'],
  devops: ['tipuFortWall'],
  data_ai: ['bangalorePalace'],
};
const MONUMENT_SPOTS: [number, number][] = [[0, 0], [-85, -85]];
const PARK_LANDMARKS: CityDecoration['type'][] = ['gatewayArch', 'clockTower', 'nandiBull', 'templeGopuram', 'chaiStall', 'techParkSign'];
const DOWNTOWN_COUNT = 50;
const LANDMARK_SITES = 16; // the 15 custom landmarks in CityCanvas plus the Founder Spire

export function generateCityLayout(devs: DeveloperRecord[]): {
  buildings: CityBuilding[];
  plazas: CityPlaza[];
  decorations: CityDecoration[];
  districtZones: DistrictZone[];
  river: CityRiver | null;
  bridges: CityBridge[];
  canals: CityCanal[];
} {
  const buildings: CityBuilding[] = [];
  const plazas: CityPlaza[] = [];
  const decorations: CityDecoration[] = [];
  const districtZones: DistrictZone[] = [];
  const canals: CityCanal[] = [];
  const maxContrib = devs.reduce((max, d) => Math.max(max, d.contributions), 1);
  const maxStars = devs.reduce((max, d) => Math.max(max, d.total_stars), 1);
  const maxContribV2 = devs.reduce((max, d) => Math.max(max, d.contributions_total ?? 0), 1);
  const composites = precomputeComposites(devs, maxContrib, maxStars, maxContribV2);

  // ── 1. Zoning: the top residents form downtown, everyone else lives in their district ──
  const score = (dev: DeveloperRecord) => composites.get(dev.github_login) ?? 0;
  const ranked = [...devs].sort((a, b) => score(b) - score(a) || a.github_login.localeCompare(b.github_login));
  const residents = new Map<string, DeveloperRecord[]>();
  ranked.forEach((dev, index) => {
    const did = index < DOWNTOWN_COUNT ? 'downtown' : developerDistrict(dev);
    const group = residents.get(did);
    if (group) group.push(dev); else residents.set(did, [dev]);
  });

  function makeBuilding(dev: DeveloperRecord, posX: number, posZ: number, did: string, rank: number): CityBuilding {
    let height: number, composite: number, w: number, d: number, litPercentage: number;

    if (isV2Dev(dev)) {
      ({ height, composite } = calcHeightV2(dev, maxContribV2, maxStars));
      w = calcWidthV2(dev);
      d = calcDepthV2(dev);
      litPercentage = calcLitPercentageV2(dev);
    } else {
      ({ height, composite } = calcHeight(dev.contributions, dev.total_stars, dev.public_repos, maxContrib, maxStars));
      const seed1 = hashStr(dev.github_login);
      const repoFactor = Math.min(1, dev.public_repos / 100);
      const baseW = 14 + repoFactor * 12;
      w = Math.round(baseW + seededRandom(seed1) * 8);
      d = Math.round(12 + seededRandom(seed1 + 99) * 16);
      litPercentage = 0.2 + composite * 0.7;

      // For LC-claimed buildings: decode submission-frequency litPercentage
      // contributions_total is stored as Math.round(litPct * 1000) by verify-leetcode
      if (dev.claimed && dev.contributions_total && dev.contributions_total <= 1000) {
        litPercentage = dev.contributions_total / 1000;
      }
    }

    // BUNGALOW OVERRIDE (applied uniformly to all users — Fixes #825); it takes a 2x2 lot
    if (dev.building_style === "bungalow") {
      w = BUNGALOW_W;
      d = BUNGALOW_D;
      height = 25;
    }

    // Safety guard: if any dimension is NaN or invalid, use safe defaults
    if (isNaN(height) || height <= 0) height = MIN_BUILDING_HEIGHT;
    if (isNaN(w) || w <= 0) w = 16;
    if (isNaN(d) || d <= 0) d = 14;
    if (isNaN(litPercentage) || litPercentage < 0) litPercentage = 0.3;
    // A building never leaves its lot, whatever the stats say.
    if (dev.building_style !== "bungalow") {
      w = Math.min(w, LOT_W - 2);
      d = Math.min(d, LOT_D - 2);
    }

    const extra = dev as unknown as Record<string, unknown>;
    return {
      login: dev.github_login,
      rank: dev.rank ?? rank,
      contributions: dev.contributions,
      total_stars: dev.total_stars,
      public_repos: dev.public_repos,
      name: dev.name,
      avatar_url: dev.avatar_url,
      primary_language: dev.primary_language,
      claimed: dev.claimed ?? false,
      owned_items: dev.owned_items ?? [],
      custom_color: dev.custom_color ?? null,
      billboard_images: dev.billboard_images ?? [],
      led_banner_text: extra.led_banner_text as string | null ?? null,
      achievements: extra.achievements as string[] ?? [],
      kudos_count: extra.kudos_count as number ?? 0,
      visit_count: extra.visit_count as number ?? 0,
      loadout: extra.loadout as CityBuilding["loadout"] ?? null,
      app_streak: extra.app_streak as number ?? 0,
      raid_xp: extra.raid_xp as number ?? 0,
      current_week_contributions: extra.current_week_contributions as number ?? 0,
      current_week_kudos_given: extra.current_week_kudos_given as number ?? 0,
      current_week_kudos_received: extra.current_week_kudos_received as number ?? 0,
      active_raid_tag: extra.active_raid_tag as CityBuilding["active_raid_tag"] ?? null,
      rabbit_completed: extra.rabbit_completed as boolean ?? false,
      xp_total: extra.xp_total as number ?? 0,
      xp_level: extra.xp_level as number ?? 1,
      district: did,
      district_chosen: extra.district_chosen as boolean ?? false,
      building_style: dev.building_style ?? "tower",
      position: [posX, 0, posZ],
      width: w,
      depth: d,
      height,
      floors: Math.max(3, Math.floor(height / 6)),
      windowsPerFloor: Math.max(3, Math.floor(w / 5)),
      sideWindowsPerFloor: Math.max(3, Math.floor(d / 5)),
      litPercentage,
      // LeetCode-specific: pass through for building visuals
      easy_solved: extra.easy_solved as number ?? undefined,
      medium_solved: extra.medium_solved as number ?? undefined,
      hard_solved: extra.hard_solved as number ?? undefined,
      acceptance_rate: extra.acceptance_rate as number ?? undefined,
      contest_rating: extra.contest_rating as number ?? undefined,
      lc_streak: extra.lc_streak as number ?? undefined,
    };
  }

  const halfX = BLOCK_FOOTPRINT_X / 2;
  const halfZ = BLOCK_FOOTPRINT_Z / 2;

  /** Paving, corner lamps and sidewalk trees shared by residential blocks and parks. */
  function pave(cx: number, cz: number) {
    decorations.push({ type: 'sidewalk', position: [cx, 0.1, cz], rotation: 0, variant: 0, size: [BLOCK_FOOTPRINT_X + 2 * SIDEWALK_W, BLOCK_FOOTPRINT_Z + 2 * SIDEWALK_W] });
    const edgeX = halfX + SIDEWALK_W / 2, edgeZ = halfZ + SIDEWALK_W / 2;
    for (const [sx, sz] of QUADRANT_SIGNS) {
      decorations.push({ type: 'streetLamp', position: [cx + sx * edgeX, 0, cz + sz * edgeZ], rotation: 0, variant: 0 });
      decorations.push({
        type: 'tree', position: [cx + sx * halfX / 2, 0, cz + sz * edgeZ],
        rotation: seededRandom(hashStr(`${cx},${cz},${sx},${sz}`)) * Math.PI * 2, variant: (sx + sz + 2) % 3,
      });
    }
  }

  /** Fills one block with the next residents; returns how many found a lot. */
  function fillBlock(cx: number, cz: number, queue: DeveloperRecord[], from: number, did: string): number {
    const occupied = new Set<number>();
    let placed = 0;
    for (let next = from; next < queue.length; next++) {
      const dev = queue[next];
      const span = dev.building_style === 'bungalow' ? 2 : 1;
      let lot: [number, number] | null = null;
      for (let row = 0; row <= BLOCK_SIZE - span && !lot; row++) {
        for (let col = 0; col <= BLOCK_SIZE - span && !lot; col++) {
          const cells = Array.from({ length: span * span }, (_, i) => (row + Math.floor(i / span)) * BLOCK_SIZE + col + i % span);
          if (cells.some((cell) => occupied.has(cell))) continue;
          cells.forEach((cell) => occupied.add(cell));
          lot = [row + (span - 1) / 2, col + (span - 1) / 2];
        }
      }
      if (!lot) break;
      const posX = cx + (lot[1] - (BLOCK_SIZE - 1) / 2) * (LOT_W + ALLEY_W);
      const posZ = cz + (lot[0] - (BLOCK_SIZE - 1) / 2) * (LOT_D + ALLEY_W);
      buildings.push(makeBuilding(dev, posX, posZ, did, buildings.length + 1));
      placed++;
    }

    pave(cx, cz);
    return placed;
  }

  /** A park block: a pond, one small landmark and a few trees and benches. */
  function placePark(cx: number, cz: number, index: number) {
    pave(cx, cz);
    canals.push({ position: [cx + 38, 0.3, cz], width: 60, length: 70, rotation: 0 });
    decorations.push({ type: PARK_LANDMARKS[index % PARK_LANDMARKS.length], position: [cx - 40, 0, cz], rotation: 0, variant: 0 });
    decorations.push({ type: 'bench', position: [cx + 38, 0, cz + 45], rotation: 0, variant: 0 });
    for (const [tx, tz] of [[-70, -50], [-70, 50], [-10, -50], [-10, 50]]) {
      decorations.push({ type: 'tree', position: [cx + tx, 0, cz + tz], rotation: seededRandom(index * 31 + tx + tz) * Math.PI * 2, variant: index % 3 });
    }
  }

  /** The civic square at a district origin: monuments, fountain, benches, ring of trees, bus stop. */
  function placeCivicSquare(did: string, ox: number, oz: number) {
    plazas.push({
      position: [ox, 0, oz], size: 2 * Math.min(CIVIC_HALF_X, CIVIC_HALF_Z),
      variant: seededRandom(hashStr(did)), district: did, city: DISTRICT_NAMES[did] ?? did,
    });
    decorations.push({ type: 'sidewalk', position: [ox, 0.1, oz], rotation: 0, variant: 0, size: [2 * (CIVIC_HALF_X + SIDEWALK_W), 2 * (CIVIC_HALF_Z + SIDEWALK_W)] });
    (DISTRICT_MONUMENTS[did] ?? []).forEach((type, i) => {
      const [mx, mz] = MONUMENT_SPOTS[i];
      // Face the monument toward downtown.
      decorations.push({ type, position: [ox + mx, 0, oz + mz], rotation: Math.atan2(ox - 500, oz - 500) + Math.PI, variant: 0 });
    });
    if (did === 'downtown') decorations.push({ type: 'fountain', position: [ox + 85, 0, oz - 85], rotation: 0, variant: 0 });
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2;
      decorations.push({ type: 'bench', position: [ox + Math.cos(angle) * 70, 0, oz + Math.sin(angle) * 70], rotation: angle, variant: 0 });
    }
    for (let i = 0; i < 8; i++) {
      const angle = (i + 0.5) * Math.PI / 4;
      decorations.push({ type: 'tree', position: [ox + Math.cos(angle) * 105, 0, oz + Math.sin(angle) * 105], rotation: angle, variant: i % 3 });
    }
    decorations.push({ type: 'busStop', position: [ox + BUS_STOP_OFFSET[0], 0, oz + BUS_STOP_OFFSET[1]], rotation: Math.PI, variant: 0 });
  }

  /** One road per lattice gap across the whole district, so the grid is continuous by construction. Returns the half-extent. */
  function placeStreets(cols: number, rows: number): [number, number] {
    const DASH = 6, DASH_STEP = 20;
    // Gaps along one axis: [center offset, road width], both sides of the axis, outermost being the ring road.
    const gaps = (starts: number[], footprint: number, count: number) => {
      const out: [number, number][] = [[0, AVENUE_W]];
      for (let i = 0; i < count; i++) {
        const from = starts[i] + footprint + SIDEWALK_W;
        const to = i + 1 < count ? starts[i + 1] - SIDEWALK_W : from + ROAD_W;
        out.push([(from + to) / 2, to - from], [-(from + to) / 2, to - from]);
      }
      return out;
    };
    const xGaps = gaps(COL_STARTS, BLOCK_FOOTPRINT_X, cols);
    const zGaps = gaps(ROW_STARTS, BLOCK_FOOTPRINT_Z, rows);
    const ringX = COL_STARTS[cols - 1] + BLOCK_FOOTPRINT_X + SIDEWALK_W + ROAD_W;
    const ringZ = ROW_STARTS[rows - 1] + BLOCK_FOOTPRINT_Z + SIDEWALK_W + ROAD_W;
    const tree = (x: number, z: number) => decorations.push({
      type: 'tree', position: [x, 0, z], rotation: seededRandom(hashStr(`${x},${z}`)) * Math.PI * 2, variant: Math.abs(Math.round(x + z)) % 3,
    });
    const crossesRoad = (t: number, crossing: [number, number][]) => crossing.some(([c, w]) => Math.abs(t - c) < w / 2 + 4);

    // One carriageway: asphalt, a dashed centre line when wider than a street, and cars parked along both curbs.
    const carriageway = (x: number, z: number, width: number, from: number, to: number, alongZ: boolean, crossing: [number, number][]) => {
      const at = (lateral: number, t: number): [number, number, number] => alongZ ? [x + lateral, 0, t] : [t, 0, z + lateral];
      decorations.push({
        type: 'roadSurface', position: alongZ ? [x, 0.05, (from + to) / 2] : [(from + to) / 2, 0.05, z],
        rotation: alongZ ? 0 : Math.PI / 2, variant: 0, size: [width, to - from],
      });
      if (width > ROAD_W) {
        for (let t = from + DASH; t < to - DASH; t += DASH_STEP) {
          const [mx, , mz] = at(0, t);
          decorations.push({ type: 'roadMarking', position: [mx, 0.2, mz], rotation: alongZ ? 0 : Math.PI / 2, variant: 0, size: [2, DASH] });
        }
      }
      // Car models are long along X at rotation 0; keep clear of junctions by a car length.
      for (let t = from + 12; t < to - 12; t += LOT_W + ALLEY_W) {
        if (crossing.some(([c, w]) => Math.abs(t - c) < w / 2 + 8)) continue;
        for (const side of [-1, 1]) {
          const roll = hashUnit(`car:${x}:${z}:${t}:${side}`);
          if (roll > 0.12) continue;
          decorations.push({
            type: roll < 0.02 ? 'autoRickshaw' : 'car', position: at(side * (width / 2 - 2), t),
            rotation: (alongZ ? Math.PI / 2 : 0) + (side > 0 ? 0 : Math.PI), variant: Math.floor(hashUnit(`paint:${x}:${z}:${t}`) * 4),
          });
        }
      }
    };

    const road = (x: number, z: number, width: number, from: number, to: number, alongZ: boolean, crossing: [number, number][]) => {
      if (to - from <= 0) return;
      if (width <= AVENUE_W) return carriageway(x, z, width, from, to, alongZ, crossing);
      // Boulevard: two carriageways around a central median that carries the metro piers and
      // stations, with a planted strip on each outer side.
      const lateral = BOULEVARD_MEDIAN / 2 + BOULEVARD_LANE / 2;
      const strip = (BOULEVARD_MEDIAN / 2 + BOULEVARD_LANE + width / 2) / 2;
      for (const side of [-1, 1]) {
        carriageway(alongZ ? x + side * lateral : x, alongZ ? z : z + side * lateral, BOULEVARD_LANE, from, to, alongZ, crossing);
        for (let t = from + 20; t < to - 20; t += 40) {
          if (crossesRoad(t, crossing)) continue;
          tree(alongZ ? x + side * strip : t, alongZ ? t : z + side * strip);
        }
      }
    };
    // The central avenues stop at the civic square instead of crossing it.
    for (const [x, width] of xGaps) {
      if (x === 0) { road(x, 0, width, -ringZ, -CIVIC_HALF_Z - SIDEWALK_W, true, zGaps); road(x, 0, width, CIVIC_HALF_Z + SIDEWALK_W, ringZ, true, zGaps); }
      else road(x, 0, width, -ringZ, ringZ, true, zGaps);
    }
    for (const [z, width] of zGaps) {
      if (z === 0) { road(0, z, width, -ringX, -CIVIC_HALF_X - SIDEWALK_W, false, xGaps); road(0, z, width, CIVIC_HALF_X + SIDEWALK_W, ringX, false, xGaps); }
      else road(0, z, width, -ringX, ringX, false, xGaps);
    }

    // Waterfront promenade: a tree row outside the ring road, open where avenues and boulevards leave the district.
    const promenadeX = ringX + PROMENADE_W / 2, promenadeZ = ringZ + PROMENADE_W / 2;
    const open = (t: number) => Math.abs(t) < AVENUE_W / 2 + 6 || Math.abs(Math.abs(t) - METRO_OFFSET) < AVENUE_W / 2 + 6;
    for (let t = -ringZ; t <= ringZ; t += 45) if (!open(t)) { tree(promenadeX, t); tree(-promenadeX, t); }
    for (let t = -ringX; t <= ringX; t += 45) if (!open(t)) { tree(t, promenadeZ); tree(t, -promenadeZ); }
    return [ringX + PROMENADE_W, ringZ + PROMENADE_W];
  }

  // ── 2. Build every district around a local origin ──
  interface Built { did: string; slot: [number, number]; reach: [number, number]; from: [number, number, number, number]; to: [number, number, number, number] }
  const built: Built[] = [];
  const counts = (): [number, number, number, number] => [buildings.length, decorations.length, canals.length, plazas.length];
  let parkIndex = 0;
  for (const did of ['downtown', ...CITY_DISTRICTS, ...[...residents.keys()].filter((id) => id !== 'downtown' && !CITY_DISTRICTS.includes(id))]) {
    const group = residents.get(did);
    const slotOrigin = DISTRICT_ORIGINS[did];
    if (!group?.length || !slotOrigin) continue;
    const from = counts();
    placeCivicSquare(did, 0, 0);

    // Round-robin keeps the quadrant skylines alike; ranked order puts the tallest towers by the square.
    const quadrants: DeveloperRecord[][] = [[], [], [], []];
    group.forEach((dev, i) => quadrants[i % 4].push(dev));
    let cols = 1, rows = 1;
    quadrants.forEach((queue, q) => {
      const [sx, sz] = QUADRANT_SIGNS[q];
      let next = 0;
      // Downtown's towers are ringed by the custom landmarks, each on a lot of its own.
      let sites = did === 'downtown' ? LANDMARK_SITES / 4 : 0;
      for (const [gx, gz] of QUADRANT_CELLS) {
        if (next >= queue.length && !sites) break;
        cols = Math.max(cols, gx + 1);
        rows = Math.max(rows, gz + 1);
        const cx = sx * (COL_STARTS[gx] + halfX);
        const cz = sz * (ROW_STARTS[gz] + halfZ);
        if (next >= queue.length) {
          pave(cx, cz);
          decorations.push({ type: 'landmarkSite', position: [cx, 0, cz], rotation: 0, variant: 0 });
          sites--;
        } else if (hashUnit(`park:${did}:${q}:${gx}:${gz}`) < PARK_SHARE) placePark(cx, cz, parkIndex++);
        else next += fillBlock(cx, cz, queue, next, did);
      }
      if (next < queue.length) throw new Error(`District ${did} outgrew the city lattice (${queue.length} residents in one quadrant)`);
    });
    const reach = placeStreets(cols, rows);
    // The old fixed origins only give each district its compass slot (column, row) around downtown.
    const slot: [number, number] = [Math.round((slotOrigin[0] - 500) / 3500), Math.round((slotOrigin[2] - 500) / 4000)];
    plazas[from[3]].reach = reach;
    built.push({ did, slot, reach, from, to: counts() });
  }

  // ── 3. Set the districts on their compass slots, columns and rows as wide as their largest member ──
  const axisCenters = (axis: 0 | 1) => {
    const half = new Map<number, number>();
    for (const b of built) half.set(b.slot[axis], Math.max(half.get(b.slot[axis]) ?? 0, b.reach[axis]));
    const center = new Map<number, number>([[0, 500]]);
    const lo = Math.min(0, ...half.keys()), hi = Math.max(0, ...half.keys());
    for (let i = 1; i <= hi; i++) center.set(i, center.get(i - 1)! + (half.get(i - 1) ?? 0) + CHANNEL_W + (half.get(i) ?? 0));
    for (let i = -1; i >= lo; i--) center.set(i, center.get(i + 1)! - (half.get(i + 1) ?? 0) - CHANNEL_W - (half.get(i) ?? 0));
    return { center, half };
  };
  const columns = axisCenters(0), rowsOf = axisCenters(1);
  const MONUMENT_TYPES = new Set(Object.values(DISTRICT_MONUMENTS).flat());
  for (const b of built) {
    const ox = columns.center.get(b.slot[0])!, oz = rowsOf.center.get(b.slot[1])!;
    for (let i = b.from[0]; i < b.to[0]; i++) { buildings[i].position[0] += ox; buildings[i].position[2] += oz; }
    for (let i = b.from[1]; i < b.to[1]; i++) {
      const d = decorations[i];
      d.position = [d.position[0] + ox, d.position[1], d.position[2] + oz];
      // Monuments face downtown's square (downtown's own face south).
      if (MONUMENT_TYPES.has(d.type)) d.rotation = Math.atan2(ox - 500, oz - 500) + Math.PI;
    }
    for (let i = b.from[2]; i < b.to[2]; i++) { const p = canals[i].position; canals[i].position = [p[0] + ox, p[1], p[2] + oz]; }
    for (let i = b.from[3]; i < b.to[3]; i++) { const p = plazas[i].position; plazas[i].position = [p[0] + ox, p[1], p[2] + oz]; }
  }

  // ── 4. District zones (computed from actual building positions) ──
  const dzMap: Record<string, CityBuilding[]> = {};
  for (const b of buildings) {
    const did = b.district ?? 'fullstack';
    if (!dzMap[did]) dzMap[did] = [];
    dzMap[did].push(b);
  }
  for (const [did, dBlds] of Object.entries(dzMap)) {
    let mnX = Infinity, mxX = -Infinity, mnZ = Infinity, mxZ = -Infinity;
    let sX = 0, sZ = 0;
    for (const b of dBlds) {
      mnX = Math.min(mnX, b.position[0]); mxX = Math.max(mxX, b.position[0]);
      mnZ = Math.min(mnZ, b.position[2]); mxZ = Math.max(mxZ, b.position[2]);
      sX += b.position[0]; sZ += b.position[2];
    }
    districtZones.push({
      id: did, name: DISTRICT_NAMES[did] ?? did,
      center: [sX / dBlds.length, 0, sZ / dBlds.length],
      bounds: { minX: mnX, maxX: mxX, minZ: mnZ, maxZ: mxZ },
      population: dBlds.length,
      color: DISTRICT_COLORS[did] ?? '#888888',
    });
  }

  // ── 5. River in the open channel south of the downtown row; bridges carry the district axes over it ──
  const RIVER_WIDTH = 120;
  const riverCenterZ = 500 - (rowsOf.half.get(0) ?? 0) - CHANNEL_W / 2;
  const xs = [...columns.half.keys()];
  const riverWest = columns.center.get(Math.min(...xs))! - columns.half.get(Math.min(...xs))!;
  const riverEast = columns.center.get(Math.max(...xs))! + columns.half.get(Math.max(...xs))!;
  const river: CityRiver | null = built.length ? { x: riverWest, width: riverEast - riverWest, length: RIVER_WIDTH, centerZ: riverCenterZ } : null;
  // A bridge spans waterfront to waterfront wherever a column has districts on both banks.
  const bridges: CityBridge[] = [];
  for (const ix of xs) {
    const north = built.find((b) => b.slot[0] === ix && b.slot[1] === 0);
    const south = built.find((b) => b.slot[0] === ix && b.slot[1] === -1);
    if (!river || !north || !south) continue;
    const from = rowsOf.center.get(-1)! + south.reach[1], to = 500 - north.reach[1];
    bridges.push({ position: [columns.center.get(ix)!, 0, (from + to) / 2], width: to - from, rotation: Math.PI / 2 });
  }

  return { buildings, plazas, decorations, districtZones, river, bridges, canals };
}

// ─── Building Dimensions (reusable for shop preview) ────────

export function calcBuildingDims(
  githubLogin: string,
  contributions: number,
  publicRepos: number,
  totalStars: number,
  maxContrib: number,
  maxStars: number,
  v2Data?: Partial<DeveloperRecord>,
  buildingStyle?: string,
): { width: number; height: number; depth: number } {
  // BUNGALOW OVERRIDE — must match generateCityLayout (Fixes #825)
  if (buildingStyle === "bungalow") {
    return { width: BUNGALOW_W, height: 25, depth: BUNGALOW_D };
  }

  // V2 path when expanded data is available
  const dev: DeveloperRecord = {
    id: 0, github_login: githubLogin, github_id: null, name: null,
    avatar_url: null, bio: null, contributions, public_repos: publicRepos,
    total_stars: totalStars, primary_language: null, top_repos: [],
    rank: null, fetched_at: '', created_at: '', claimed: false,
    fetch_priority: 0, claimed_at: null,
    ...v2Data,
  };

  if (isV2Dev(dev)) {
    const { height } = calcHeightV2(dev, maxContrib, maxStars);
    return { width: calcWidthV2(dev), height, depth: calcDepthV2(dev) };
  }

  // V1 fallback
  const { height } = calcHeight(contributions, totalStars, publicRepos, maxContrib, maxStars);
  const seed1 = hashStr(githubLogin);
  const repoFactor = Math.min(1, publicRepos / 100);
  const baseW = 14 + repoFactor * 16;
  const width = Math.round(baseW + seededRandom(seed1) * 10);
  const depth = Math.round(12 + seededRandom(seed1 + 99) * 20);
  return { width, height, depth };
}

// ─── Utilities (kept for Building3D seeded variance) ─────────

export function hashStr(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Well-mixed value in [0, 1) for a key; neighbouring keys don't give neighbouring values (unlike seededRandom). */
function hashUnit(key: string): number {
  let h = hashStr(key);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function seededRandom(seed: number): number {
  const s = (seed * 16807) % 2147483647;
  return (s - 1) / 2147483646;
}
