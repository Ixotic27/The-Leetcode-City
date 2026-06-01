<h1 align="center">LeetCode City</h1>

<p align="center">
  <strong>Your LeetCode profile as a 3D pixel art building in an interactive city.</strong>
</p>

<p align="center">
  <a href="https://theleetcodecity.tech">theleetcodecity.tech</a>
</p>

<p align="center">
  <img src="public/og-image.png" alt="LeetCode City — Where Code Builds Cities" width="800" />
</p>

---

## What is LeetCode City?

LeetCode City transforms every LeetCode profile into a unique pixel art building. The more you solve, the taller your building grows. Explore an interactive 3D city, fly between buildings, and discover developers from around the world.

## Features

- **3D Pixel Art Buildings** — Each LeetCode user becomes a building with height based on submissions, width based on skill levels, and lit windows representing activity
- **Free Flight Mode** — Fly through the city with smooth camera controls, visit any building, and explore the skyline
- **Profile Pages** — Dedicated pages for each developer with stats, achievements, and top solved problems
- **Achievement System** — Unlock achievements based on submissions, points, and more
- **Building Customization** — Claim your building and customize it with items from the shop (crowns, auras, roof effects, face decorations)
- **Social Features** — Send kudos, gift items to other developers, refer friends, and see a live activity feed
- **Compare Mode** — Put two developers side by side and compare their buildings and stats
- **Share Cards** — Download shareable image cards of your profile in landscape or stories format

<!-- TODO: Add screenshots -->
<!-- ![City Overview](assets/screenshot-city.png) -->
<!-- ![Profile Page](assets/screenshot-profile.png) -->
<!-- ![Compare Mode](assets/screenshot-compare.png) -->

## How Buildings Work

| Metric         | Affects           | Example                                |
|----------------|-------------------|----------------------------------------|
| Submissions    | Building height   | 1,000 solved → taller building         |
| Active Days    | Building width    | More active days → wider base          |
| Points         | Window brightness | More points → more lit windows         |
| Recent Activity| Window pattern    | Recent solve → distinct glow pattern   |

Buildings are rendered with instanced meshes and a LOD (Level of Detail) system for performance. Close buildings show full detail with animated windows; distant buildings use simplified geometry.

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org) 16 (App Router, Turbopack)
- **3D Engine:** [Three.js](https://threejs.org) via [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) + [drei](https://github.com/pmndrs/drei)
- **Database & Auth:** [Supabase](https://supabase.com) (PostgreSQL, GitHub OAuth, Row Level Security)
- **Payments:** [Stripe](https://stripe.com)
- **Styling:** [Tailwind CSS](https://tailwindcss.com) v4 with pixel font (Silkscreen)
- **Hosting:** [Vercel](https://vercel.com)

## API & Data Sources

### LeetCode GraphQL API

All user data comes from LeetCode's public GraphQL endpoint at `https://leetcode.com/graphql`. The project uses four queries:

| Query | Purpose | Used By |
|-------|---------|---------|
| `matchedUser` | Full profile: submit stats, badges, calendar, contest ranking, tag counts | Profile fetch, verification, cron refresh |
| `userContestRanking` | Contest rating, global rank, attended contests | Profile fetch, verification, cron refresh |
| `userCalendar` | Submission calendars per year (for streak calculation) | Profile fetch, verification, cron refresh |
| `recentAcSubmissionList` | Last N accepted submissions (live presence) | LC Pulse endpoint |

Rate limits are respected by spacing requests 1.2s apart in the cron pipeline and 500ms apart in seed scripts.

### Data Fetching Flow

```
User searches username
        │
        ▼
GET /api/dev/[username]
        │
        ├── Check Supabase `developers` table
        │     └── If cached < 12h old → return cached record
        │
        ├── Rate limit check (15 req/hr per IP, stored in `add_requests` table)
        │     └── Authenticated force-refresh (↻ button) bypasses this
        │
        ├── Fetch LeetCode GraphQL (matchedUser + userContestRanking)
        │     └── Parse submitStats, calendar, badges, contest data
        │
        ├── Compute building parameters (height, width, lit%, XP, etc.)
        │
        ├── Upsert into `developers` table
        │
        └── Merge with customizations (purchases, loadouts, billboards, raid tags)
              └── Return full building record
```

### Verification Flow (Claiming a Building)

```
User pastes LeetCode username
        │
        ▼
POST /api/verify-leetcode
        │
        ├── Check authentication (Supabase auth)
        │
        ├── Generate expected token: "LCC-" + user.id (first UUID segment)
        │
        ├── Fetch user's LeetCode "About Me" via GraphQL
        │     └── Must contain the token in their profile summary
        │
        ├── Check for duplicate claims
        │
        ├── Fetch full profile + contest stats + all-year calendars
        │     └── Parse and compute all building metrics
        │
        └── Upsert into `developers` with claimed=true, store XP
              └── Insert "building_claimed" activity feed event
```

### Caching Strategy

| Layer | What's Cached | TTL | Mechanism |
|-------|--------------|-----|-----------|
| **Supabase DB** | Full developer profile + LC stats | 12h (claimed), 24h (unclaimed) | `fetched_at` timestamp column |
| **City API** | All buildings + stats for city render | 5 min CDN, 10 min stale | HTTP `Cache-Control: s-maxage=300, stale-while-revalidate=600` |
| **Client-side** | City building/plaza/decoration data | 5 min | In-memory singleton (`cityCache.ts`) |
| **Profile Pages** | Individual developer pages | 1 hour | Next.js ISR (`revalidate = 3600`) |

### Update Intervals

| Data | Frequency | Mechanism |
|------|-----------|-----------|
| All LC profiles (batch) | Daily at 06:00 UTC | Vercel Cron → `GET /api/cron/lc-refresh` |
| Profiles per run | 50 most-stale | Claimed profiles refresh after 6h stale; unclaimed after 24h |
| Live presence | On demand | Client `POST /api/lc-pulse` (checks recent solves within 30 min window) |
| Manual refresh | Instant | User clicks ↻ button (authenticated, bypasses rate limit) |

### Rate Limiting

| Limit | Scope | Implementation |
|-------|-------|----------------|
| 15 req/hour | Per IP (profile fetch) | Supabase `add_requests` table, IP hashed via SHA-256 |
| In-memory sliding window | Per process (general API) | `rate-limit.ts` — fixed-window counter per key, cleanup every 60s |
| 1.2s delay | Between cron LC requests | `setTimeout` in cron loop prevents LeetCode throttling |
| Authenticated bypass | Force-refresh button | Logged-in users skip the IP rate limit check |

### Profile & Building Generation

LeetCode stats are mapped to building properties through these formulas:

```
Height = f(problems_solved, lc_rank, reputation)
  └─ contributions (total solved) × 0.55 + stars (reputation) × 0.35 + rank_boost × 0.10
  └─ rank_boost = max(0, 500000 - lc_rank)  → lower rank = taller building

Width = f(rank, acceptance_rate)
  └─ Base width 14–26, scaled by rank percentile + seeded jitter

Depth = f(contest_rating, contest_rank)
  └─ Base depth 12–32, scaled by contest performance + seeded jitter

Lit % = active_days_last_year / 365
  └─ Clamped to [0.15, 0.92] so buildings always have some dark windows
  └─ Stored as contributions_total = Math.round(litPct × 1000)

XP = log₂(easy+1)×3 + log₂(medium+1)×6 + log₂(hard+1)×12
   + contest_rating_bonus + streak×1.5
```

The building 3D renderer visualizes these as:
- **Easy/Medium/Hard counts** → colored window zones (green bottom floors, amber mid floors, red top floors)
- **Lit percentage** → atlas-based window texture with randomized lit/unlit windows per building
- **Contest rating** → depth modifier (wider/deeper buildings for stronger contestants)
- **Streak (>30 days)** → pulsing glow effect on the building
- **XP level** → visual tier effects (neon trim at Lv5+, sky beams at Lv19+, prismatic beams at Lv24+)

## Getting Started

```bash
# Clone the repo
git clone https://github.com/Ixotic27/The-Leetcode-City.git
cd leetcode-city

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in Supabase and Stripe keys

# Run the dev server
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) to see the city.

## License

[AGPL-3.0](LICENSE) — You can use and modify LeetCode City, but any public deployment must share the source code.

---

<p align="center">
  Original creator <a href="https://github.com/Ixotic27">@Ixotic27</a>
</p>
<p align="center">
  Inspired by <a href="https://github.com/srizzon/git-city">Git City</a>
</p>
