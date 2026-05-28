# Contributing to LeetCode City

Thanks for your interest in contributing! 

> **🎉 NEW: Zero-Config Contribution Workflow!**
> We've completely overhauled the setup process for contributors. You no longer need to hunt down API keys, set up services, or manually configure `.env.local` files just to work on the frontend. The new `leetcode-city` CLI handles everything for you automatically!

## 🚀 Quick Setup (Zero Keys Needed)

### Option 1: One-Command Setup
```bash
npx leetcode-city init
cd The-Leetcode-City
npm run dev
```

### Option 2: Manual Setup
```bash
git clone https://github.com/Ixotic27/The-Leetcode-City.git
cd The-Leetcode-City
npm run setup
npm run dev
```

The app runs on [http://localhost:3001](http://localhost:3001).

> **No API keys are needed for most work!** The `.env.example` comes pre-filled with public Supabase keys. The app runs in dev mode (read-only) when the service role key is not set.

## Requirements

- Node.js 18+
- npm
- git

## Environment Variables

Run `npm run setup` and it handles everything. Or copy `.env.example` to `.env.local` — the public keys are already filled in.

| Variable | Pre-filled? | Needed For |
|----------|:-----------:|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Everything (public, safe to share) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Everything (public, safe to share) |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ | Auth, writes, API routes |
| `GITHUB_TOKEN` | ❌ | GitHub API integration |
| `STRIPE_SECRET_KEY` | ❌ | Payment features only |
| `RESEND_API_KEY` | ❌ | Email notifications only |

### What works without secret keys?

| ✅ Works out of the box | ⚠️ Needs service role key |
|------------------------|--------------------------|
| View the 3D city | Sign in / auth |
| Browse developer profiles | Claiming buildings |
| UI/CSS/component changes | Shop purchases |
| 3D rendering & animations | Raids & interactions |
| Leaderboard & search | API route writes |

> **Need full API access?** DM me on [LinkedIn](https://www.linkedin.com/in/ishant-singh-bisht-247a4b322/) for the service role key.

## 🏷️ Getting Assigned to an Issue

1. Find an open, unassigned issue
2. Comment `assign me` (or `I want to work on this`, `can I take this`, etc.) **AND include a "Proposed Solution" heading**.
   - Example:
     ```markdown
     assign me!
     ### Proposed Solution
     I will update the components to use the new API structure...
     ```
3. The bot will automatically assign you (first-come, first-served) if your comment includes a proposed solution.
4. You have **48 hours** to submit a PR
5. The issue conversation is locked — further discussion happens in your PR

### Assignment Rules

- **Maximum 3 open issues** per contributor at a time
- Must submit a PR within **48 hours** or be unassigned
- Already-assigned issues are not available

## Code Style

- TypeScript everywhere
- Tailwind CSS v4 for styling
- Pixel font (Silkscreen) for UI text
- React Three Fiber (R3F) + drei for 3D
- App Router (Next.js 16)

Run `npm run lint` before submitting.

## Making Changes

1. Fork the repo
2. Create a branch from `main` and name it with the issue number and name (e.g. `git checkout -b 12-issue-name`).
> **🛑 STOP:** Do NOT commit your changes to your fork's `main` branch. You MUST create a new branch. Pull Requests submitted from a `main` or `master` branch will be automatically rejected by our bots.
3. Make your changes
4. Run `npm run lint` and fix any issues
5. Commit with a clear message (e.g. `feat: add rain weather effect`)
6. Open a Pull Request against `main`. **Please make sure to fill out the Pull Request template provided.**
7. Include `Fixes #<issue-number>` in your PR description to link it to the issue.

### Automated PR Review

Every PR automatically gets:
- 🤖 **GitHub Copilot** reviews your code and provides suggestions
- 🔍 **Security scan** checks for dangerous patterns (regex-based, zero AI tokens)
- 🏷️ **Auto-labeling** detects type from title/branch and inherits issue labels
- ✅ **CI checks** run `npm run lint` and `npm run build`

If CI fails, the bot adds a `status:blocked` label and posts instructions on how to fix it.

## Commit Messages

Start with an emoji + type. Single line, present tense, concise.

| Emoji | Type | When |
| --- | --- | --- |
| ✨ | `feat` | New features |
| 🐛 | `fix` | Bug fixes |
| ♻️ | `refactor` | Code restructuring |
| 📝 | `docs` | Documentation |
| 🎨 | `style` | UI/CSS changes |
| ⚡ | `perf` | Performance |
| 🧪 | `test` | Tests |
| 🔧 | `ci` | CI/CD |

**Examples:**

```
✨ feat(popover): add popover component
🐛 fix(command): resolve input focus issue
♻️ refactor(command): improve component structure
```

## Good First Issues

Look for issues labeled [`good first issue`](https://github.com/Ixotic27/The-Leetcode-City/labels/good%20first%20issue). These are scoped tasks that don't require deep knowledge of the codebase.

## Project Structure

```
src/
  app/          # Next.js App Router pages and API routes
  components/   # React components (UI + 3D)
  lib/          # Utilities, Supabase clients, helpers
  types/        # TypeScript types
public/         # Static assets (audio, images)
supabase/       # Database migrations
cli/            # npm CLI package (leetcode-city)
scripts/        # Setup & maintenance scripts
.github/        # GitHub Actions workflows
```

## 3D / Three.js

The city is rendered with React Three Fiber. Key files:

- `src/components/CityScene.tsx` - Main 3D scene
- `src/components/Building.tsx` - Individual building rendering
- `src/lib/zones.ts` - Item definitions for building customization

If you're adding a new building effect or item, start with `zones.ts`.

## Troubleshooting

**Setup fails?**
Run `npx leetcode-city doctor` or `npm run setup:check` to diagnose issues.

**`npm run dev` fails with a Supabase error**
Run `npm run setup` — it creates `.env.local` with the correct public keys pre-filled.

**Port 3001 already in use**
Kill the process using port 3001, or change the port in `package.json`.

**TypeScript errors after pulling latest changes**
Run `npm install` to pick up new dependencies, then `npm run lint`.

## Questions?

Open an issue or reach out on [LinkedIn](https://www.linkedin.com/in/ishant-singh-bisht-247a4b322/).

---

## 🏷️ PR Label System

Our bot and maintainers use labels to manage the workflow and review process.

### Auto-Applied by Bot

| Label | When |
|-------|------|
| `type:bug`, `type:feature`, `type:docs`, etc. | Detected from PR title/branch |
| `status:blocked` | CI fails |
| `needs-rebase` | Merge conflicts |
| `needs-details` | PR template incomplete |

### Applied by Maintainer

| Label | Purpose |
|-------|---------|
| `level:beginner` / `intermediate` / `advanced` / `critical` | Issue difficulty level |
| `quality:clean` / `quality:exceptional` | Code quality assessment |

---

## 🏆 GSSoC 2026 (GirlScript Summer of Code)

If you are participating in GSSoC 2026, LeetCode City is proud to be a participating project! 

### GSSoC Labels

These labels are specifically used for tracking GSSoC contributions:

| Label | Purpose |
|-------|---------|
| `Gssoc 26` | Automatically applied to every assigned issue and opened PR |
| `gssoc:approved` | Automatically applied when a GSSoC PR is merged |
| `mentor:username` | Indicates which mentor reviewed this PR |

### 📊 GSSoC Scoring System

Points are awarded based on a combination of difficulty, code quality, and the type of contribution.

```
Score = 50 + (difficulty_multiplier × quality_multiplier) + type_bonus
```

- **Base Points:** `gssoc:approved` gives **+50 base points** (applied to every merged PR).
- **Multipliers:** Difficulty and quality multipliers are set by maintainers during review.
- **Type Bonus:** Bonus points are automatically detected based on the `type:` label (e.g., features grant more bonus points than minor doc fixes).
