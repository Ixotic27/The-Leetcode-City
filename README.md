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

<p align="center">
  <a href="https://www.npmjs.com/package/leetcode-city"><img src="https://img.shields.io/npm/v/leetcode-city?color=%23ffa116&label=npm&logo=npm" alt="npm version" /></a>
  <a href="https://github.com/Ixotic27/The-Leetcode-City/stargazers"><img src="https://img.shields.io/github/stars/Ixotic27/The-Leetcode-City?style=flat&color=%23ffa116" alt="GitHub Stars" /></a>
  <a href="https://github.com/Ixotic27/The-Leetcode-City/issues"><img src="https://img.shields.io/github/issues/Ixotic27/The-Leetcode-City?color=%23ffa116" alt="Issues" /></a>
  <a href="https://github.com/Ixotic27/The-Leetcode-City/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Ixotic27/The-Leetcode-City?color=%23ffa116" alt="License" /></a>
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
- **CI/CD:** GitHub Actions with automated PR review (Copilot), labeling, and security scans

---

## 🚀 Getting Started

### Option 1: One-Command Setup (Recommended)

```bash
npx leetcode-city init
cd The-Leetcode-City
npm run dev
```

That's it. **No API keys needed** for frontend development. The public keys are pre-filled.

### Option 2: Manual Setup

```bash
# Clone the repo
git clone https://github.com/Ixotic27/The-Leetcode-City.git
cd The-Leetcode-City

# Automated setup (installs deps + creates .env.local)
npm run setup

# Start dev server
npm run dev
```

### Option 3: Full Manual

```bash
git clone https://github.com/Ixotic27/The-Leetcode-City.git
cd The-Leetcode-City
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) to see the city.

---

## 🔧 Environment Variables

The `.env.example` file comes **pre-filled with public read-only keys** so you can start developing immediately. No extra configuration needed for frontend work.

| Variable | Pre-filled? | Needed For |
|----------|:-----------:|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Everything (public key) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Everything (public key) |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ | Auth, writes, API routes |
| `GITHUB_TOKEN` | ❌ | GitHub API integration |
| `STRIPE_SECRET_KEY` | ❌ | Payment features only |
| `RESEND_API_KEY` | ❌ | Email notifications only |
| `NOWPAYMENTS_API_KEY` | ❌ | Crypto payments only |

### What works without secret keys?

| ✅ Works out of the box | ⚠️ Needs service role key |
|------------------------|--------------------------|
| View the 3D city | Sign in / auth |
| Browse developer profiles | Claiming buildings |
| UI/CSS/component changes | Shop purchases |
| 3D rendering & animations | Raids & interactions |
| Leaderboard & search | API route writes |

> **Need full access?** Ask [@Ixotic27](https://github.com/Ixotic27) for the service role key.

---

## 🤝 Contributing

> **🎉 NEW: Zero-Config Contribution Workflow!**
> We've just made contributing 10x easier. You no longer need to set up any API keys to work on the UI, 3D scenes, or styling. Just run `npx leetcode-city init` and start coding immediately! See [Getting Started](#getting-started) for details.

Please see our comprehensive [Contributing Guide](CONTRIBUTING.md) for full details on:
- 🚀 How to set up the project (Zero-config)
- 📝 Assignment rules and PR guidelines
- 🏷️ Our label system and automated reviews
- 🏆 GSSoC 2026 Scoring and information

---

## License

[AGPL-3.0](LICENSE) — You can use and modify LeetCode City, but any public deployment must share the source code.

---

<p align="center">
  Original creator <a href="https://github.com/Ixotic27">@Ixotic27</a>
</p>
<p align="center">
  Inspired by <a href="https://github.com/srizzon/git-city">Git City</a>
</p>
