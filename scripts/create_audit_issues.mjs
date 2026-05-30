import fs from 'fs';

const repo = "Ixotic27/The-Leetcode-City";
const token = fs.readFileSync(".env.local", "utf-8")
    .split("\n")
    .find(line => line.startsWith("GITHUB_TOKEN="))
    ?.split("=")[1]?.trim();

const headers = {
    "Accept": "application/vnd.github.v3+json",
    "Authorization": `token ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "Node-Script"
};

const issues = [
    // ─── CI/CD & Automation ───────────────────────────────────────
    {
        title: "AI PR Reviewer skips review when OPENAI_API_KEY secret is missing",
        body: `## Summary\n\nThe AI PR Reviewer workflow (\`.github/workflows/ai-pr-review.yml\`) silently exits when the \`OPENAI_API_KEY\` secret is not configured. This means **no automated review happens at all** — PRs go unreviewed, and the auto-merge action never gets triggered because it requires at least 1 approval.\n\n## Root Cause\n\nLines 57-60 in \`ai-pr-review.yml\`:\n\`\`\`js\nconst apiKey = process.env.OPENAI_API_KEY;\nif (!apiKey) {\n  console.log("No OPENAI_API_KEY provided. Skipping AI review.");\n  return;\n}\n\`\`\`\n\nIf the secret is missing, the step returns early with no review submitted.\n\n## Expected Behavior\n\n- If no API key is present, the workflow should fall back to a basic non-AI review (e.g., auto-approve if the diff is small and no suspicious patterns are found, or at minimum leave a comment).\n- Alternatively, clearly fail the workflow so maintainers know the secret is missing.\n\n## Files to Modify\n\n- \`.github/workflows/ai-pr-review.yml\`\n\n## Note for Contributors\n\nPlease create a branch named with this issue number (e.g., \`git checkout -b <issue-number>-fix-ai-review-fallback\`).`,
        labels: ["bug", "Gssoc 26", "gssoc:approved", "level: medium", "good first issue"]
    },
    {
        title: "Auto-merge action requires approval but AI reviewer can't approve without API key",
        body: `## Summary\n\nThe auto-merge workflow (\`.github/workflows/auto-merge.yml\`) is configured with \`MERGE_REQUIRED_APPROVALS: "1"\`, meaning it waits for at least one approval before merging. However, the only automated reviewer (the AI PR Reviewer) silently skips when the \`OPENAI_API_KEY\` secret is not set.\n\nThis creates a **deadlock**: PRs sit open forever because no approval is ever submitted, and the auto-merge never fires.\n\n## Expected Behavior\n\n- The auto-merge pipeline should work end-to-end: PR opened → review submitted → merge triggered.\n- If the AI reviewer is unavailable, there should be a fallback mechanism (e.g., maintainer approval, or a simpler automated check).\n\n## Files to Modify\n\n- \`.github/workflows/auto-merge.yml\`\n- \`.github/workflows/ai-pr-review.yml\`\n\n## Note for Contributors\n\nPlease create a branch named with this issue number.`,
        labels: ["bug", "Gssoc 26", "gssoc:approved", "level: hard", "good first issue"]
    },
    {
        title: "Docker package build fails — Next.js build requires environment variables at build time",
        body: `## Summary\n\nThe \`Publish Docker Package\` GitHub Action fails during the \`npm run build\` step because Next.js requires certain \`NEXT_PUBLIC_*\` environment variables at build time (they are baked into the client bundle).\n\nThe Dockerfile currently has placeholder \`ARG\` values, but the build may still fail if internal code paths throw on invalid Supabase URLs.\n\n## Steps to Reproduce\n\n1. Go to Actions → Publish Docker Package\n2. Trigger a workflow dispatch\n3. Observe the build failure in the "Build and push Docker image" step\n\n## Expected Behavior\n\nThe Docker image should build successfully with placeholder env vars and be overridable at runtime via \`docker run --env\`.\n\n## Files to Modify\n\n- \`Dockerfile\`\n- \`next.config.ts\` (verify \`output: "standalone"\` is set)\n- Potentially guard Supabase client initialization against invalid URLs\n\n## Note for Contributors\n\nPlease create a branch named with this issue number.`,
        labels: ["bug", "Gssoc 26", "gssoc:approved", "level: hard"]
    },

    // ─── Core Feature: LeetCode Pipeline ──────────────────────────
    {
        title: "LeetCode seeder only pulled 84 pages (~2k users) — pipeline stalled, not reaching 10k+ target",
        body: `## Summary\n\nThe infinite mass seeder (\`scripts/seed-lc-infinite.ts\`) is designed to paginate through LeetCode's global ranking and seed thousands of users. However, the state file (\`scripts/seed-lc-state.json\`) shows it stopped at **page 84** (approximately 2,000 users at 25 users/page).\n\nThe city should have **10,000+** developers to feel alive, but the seeder stalled — likely due to LeetCode rate limiting, and no one restarted it.\n\n## Root Cause\n\n- The seeder runs as a long-lived process and must be kept alive (via \`pm2\`, \`screen\`, or a Railway cron).\n- There is no automated GitHub Action or cron job to run the seeder periodically.\n- LeetCode may return empty pages when rate-limited, causing the seeder to sleep 10s and retry the same page forever.\n\n## Expected Behavior\n\n- A GitHub Action or external cron should run the seeder in batches (e.g., 5 pages per run, every 6 hours).\n- The seeder should have smarter backoff and skip logic when rate-limited.\n\n## Files to Modify\n\n- \`scripts/seed-lc-infinite.ts\` — add max-retry logic per page\n- Create \`.github/workflows/seed-cron.yml\` — scheduled action to run the seeder in batches\n\n## Note for Contributors\n\nPlease create a branch named with this issue number.`,
        labels: ["enhancement", "Gssoc 26", "gssoc:approved", "level: hard"]
    },
    {
        title: "Hourly fetcher only refreshes existing users — no new users are ever discovered",
        body: `## Summary\n\nThe hourly fetcher (\`scripts/lc-hourly-fetcher.ts\`) only picks the **most stale existing developers** from the database and refreshes their stats. It never discovers or adds **new** LeetCode users.\n\nThis means the city population never grows organically — only the initial seed set gets refreshed.\n\n## Expected Behavior\n\n- The hourly fetcher should also discover new users (e.g., by scanning 1-2 ranking pages per cycle and adding any users not already in the DB).\n- Or a separate "discovery" cron job should exist.\n\n## Files to Modify\n\n- \`scripts/lc-hourly-fetcher.ts\` — add a discovery phase before the refresh phase\n\n## Note for Contributors\n\nPlease create a branch named with this issue number.`,
        labels: ["enhancement", "Gssoc 26", "gssoc:approved", "level: medium", "good first issue"]
    },
    {
        title: "Seed script uses many fake/non-existent LeetCode usernames that get skipped",
        body: `## Summary\n\nThe curated seed list in \`scripts/seed-lc.ts\` (lines 29-55) contains **~80 usernames**, but many of them are clearly fabricated handles like \`"wrong_answer"\`, \`"memory_limit"\`, \`"dp_enjoyer"\`, \`"knapsack_pro"\`, etc. These usernames don't exist on LeetCode, so the seeder skips them, wasting API calls and time.\n\n## Expected Behavior\n\n- Replace fabricated usernames with real, verified LeetCode accounts.\n- Or remove the curated list entirely and rely solely on the ranking-page seeder (\`seed-lc-infinite.ts\`).\n\n## Files to Modify\n\n- \`scripts/seed-lc.ts\` — replace fake usernames with real ones\n\n## Note for Contributors\n\nPlease create a branch named with this issue number.`,
        labels: ["bug", "Gssoc 26", "gssoc:approved", "level: easy", "good first issue"]
    },

    // ─── Core Feature: Search & Building ──────────────────────────
    {
        title: "Searching for a LeetCode username only shows the building if it already exists — no visual feedback for new adds",
        body: `## Summary\n\nWhen a user searches for their LeetCode username:\n\n1. If the user **already exists** in the city, the camera pans to their building ✅\n2. If the user is **new**, the API fetches their data, upserts them into the database, and injects them into the layout — but **there is no clear visual animation or celebration** to indicate a new building was just created.\n\nThe user sees their building appear silently, with no fanfare. It feels like "just searching" rather than "adding yourself to the city."\n\n## Expected Behavior\n\n- When a new building is added, show a **construction animation** or **"Welcome to the City!" celebration overlay**.\n- Pan the camera to the new building with a zoom-in effect.\n- Optionally play a sound effect.\n\n## Files to Modify\n\n- \`src/app/page.tsx\` — around lines 1694-1716 where \`!existedBefore\` is handled\n- \`src/components/CelebrationEffect.tsx\` — potentially reuse or extend\n\n## Note for Contributors\n\nPlease create a branch named with this issue number.`,
        labels: ["enhancement", "Gssoc 26", "gssoc:approved", "level: medium", "good first issue"]
    },

    // ─── Animations & Visuals ─────────────────────────────────────
    {
        title: "Tank raid vehicle has no attack/firing animation during raids",
        body: `## Summary\n\nThe \`TankMesh\` component in \`src/components/RaidSequence3D.tsx\` (lines 410-490) renders a detailed tank model with animated treads, but during a raid:\n\n- The tank has **no cannon firing animation** (no muzzle flash, no recoil).\n- The tank turret doesn't rotate to face the target building.\n- No projectile is visually launched from the tank's cannon.\n\nOther vehicles like the airplane and rocket have proper attack animations with projectiles.\n\n## Expected Behavior\n\n- The tank turret should rotate to face the defender building.\n- A muzzle flash should appear at the cannon tip when firing.\n- A projectile (shell) should be launched toward the target building.\n- Optional: Add a cannon recoil animation.\n\n## Files to Modify\n\n- \`src/components/RaidSequence3D.tsx\` — \`TankMesh\` component + attack phase logic\n\n## Note for Contributors\n\nPlease create a branch named with this issue number.`,
        labels: ["enhancement", "Gssoc 26", "gssoc:approved", "level: hard"]
    },
    {
        title: "Ground vehicles (Tank) float in the air instead of driving on the ground during raids",
        body: `## Summary\n\nThe \`TankMesh\` component has a \`position={[0, -0.8, 0]}\` offset to simulate ground level, but during the actual raid sequence, the vehicle follows the same orbital flight path as airplanes and helicopters (\`ORBIT_HEIGHT = 30\`, \`ORBIT_RADIUS = 55\`).\n\nThis means the tank **flies in circles 30 units above the ground**, which looks absurd.\n\n## Expected Behavior\n\n- Ground vehicles should have a separate movement path that stays on the ground plane (Y ≈ 0).\n- The tank should drive toward the target building along the ground, stop at a distance, and fire.\n- Air vehicles can continue using the orbital flight path.\n\n## Files to Modify\n\n- \`src/components/RaidSequence3D.tsx\` — add ground vehicle movement logic, separate from air vehicles\n\n## Note for Contributors\n\nPlease create a branch named with this issue number.`,
        labels: ["bug", "Gssoc 26", "gssoc:approved", "level: hard"]
    },
    {
        title: "Add explosion and impact particle effects when raid projectiles hit the target building",
        body: `## Summary\n\nDuring a raid, projectiles fly toward the defender building, but when they hit:\n\n- There is **no explosion animation** on impact.\n- No screen shake or visual feedback.\n- The debris particles exist but are basic and could be enhanced.\n\n## Expected Behavior\n\n- A bright explosion burst (expanding sphere or cube particles) at the point of impact.\n- Screen shake effect when projectiles hit.\n- Enhanced debris particles flying outward from the impact point.\n- Optional: damage texture/cracks appearing on the target building.\n\n## Files to Modify\n\n- \`src/components/RaidSequence3D.tsx\` — impact handling section\n- \`src/components/BuildingEffects.tsx\` — potential damage effects\n\n## Note for Contributors\n\nPlease create a branch named with this issue number.`,
        labels: ["enhancement", "Gssoc 26", "gssoc:approved", "level: medium", "good first issue"]
    },

    // ─── Code Quality ─────────────────────────────────────────────
    {
        title: "page.tsx is 5,000+ lines — needs to be split into smaller components",
        body: `## Summary\n\nThe main \`src/app/page.tsx\` file is **5,078 lines** and **233KB** in size. This is extremely difficult to maintain, review, or debug. It contains:\n\n- City layout generation logic\n- Search/add user functionality\n- Building card UI\n- Leaderboard integration\n- Raid system integration\n- Multiple modal states\n- Camera controls\n- And much more\n\n## Expected Behavior\n\nRefactor into smaller, focused components/hooks:\n- \`hooks/useCityLayout.ts\` — city generation logic\n- \`hooks/useSearchUser.ts\` — search and add user logic\n- \`components/BuildingCard.tsx\` — building detail card\n- \`components/SearchBar.tsx\` — search input + feedback\n- Keep \`page.tsx\` as a thin orchestrator\n\n## Files to Modify\n\n- \`src/app/page.tsx\` — extract logic into new files\n- Create new files in \`src/components/\` and \`src/hooks/\`\n\n## Note for Contributors\n\nThis is a large refactor. Start with one section (e.g., search logic) and submit a PR for that alone. Please create a branch named with this issue number.`,
        labels: ["enhancement", "Gssoc 26", "gssoc:approved", "level: hard"]
    },
    {
        title: "Inconsistent error handling — catch blocks use mix of console.log, console.warn, console.error",
        body: `## Summary\n\nAcross the codebase, error handling is inconsistent:\n\n- Some catch blocks use \`console.log\` (too quiet)\n- Some use \`console.warn\` (better but inconsistent)\n- Some use \`console.error\` (correct for errors)\n- The recently merged PR #37 standardized many, but some files in \`src/lib/\` and \`src/components/\` still have inconsistencies\n\n## Expected Behavior\n\n- \`console.error\` for actual errors that affect functionality\n- \`console.warn\` for non-critical issues (e.g., missing optional data)\n- Include the error object in all logging for stack traces\n- Use a consistent format: \`console.error("[filename] descriptive message:", error)\`\n\n## Files to Check\n\n- \`src/lib/leetcode.ts\` — line 27\n- \`src/lib/radio.ts\`\n- \`src/lib/supabase.ts\`\n- \`src/components/ShopClient.tsx\`\n\n## Note for Contributors\n\nPlease create a branch named with this issue number.`,
        labels: ["enhancement", "Gssoc 26", "gssoc:approved", "level: easy", "good first issue"]
    },
    {
        title: "Rate limiter uses hardcoded values — should be configurable via environment variables",
        body: `## Summary\n\nIn \`src/app/api/dev/[username]/route.ts\`, the rate limiter uses hardcoded values:\n\n- Line 24: \`(count ?? 0) >= 15\` — max 15 requests per hour\n- Line 132: \`age < 12 * 60 * 60 * 1000\` — 12-hour cache TTL\n\nThese should be configurable via environment variables so they can be tuned without code changes.\n\n## Expected Behavior\n\n\`\`\`ts\nconst RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_HOUR ?? "15");\nconst CACHE_TTL_MS = parseInt(process.env.CACHE_TTL_HOURS ?? "12") * 3600000;\n\`\`\`\n\n## Files to Modify\n\n- \`src/app/api/dev/[username]/route.ts\`\n- \`.env.example\` — document the new variables\n\n## Note for Contributors\n\nPlease create a branch named with this issue number.`,
        labels: ["enhancement", "Gssoc 26", "gssoc:approved", "level: easy", "good first issue"]
    },
    {
        title: "LeetCode GraphQL query fetches calendar data for all years since 2015 — causes large payloads and potential rejections",
        body: `## Summary\n\nIn both \`scripts/seed-lc.ts\` (line 79-82) and \`scripts/lc-hourly-fetcher.ts\` (line 43-47), the GraphQL query dynamically generates calendar aliases for **every year from 2015 to the current year** (11+ years of data).\n\nThis creates an extremely large query that:\n- Takes longer to execute on LeetCode's servers\n- Returns massive JSON payloads\n- Is more likely to be rate-limited or rejected\n\nThe API endpoint \`src/app/api/dev/[username]/route.ts\` already uses a smarter approach — fetching only current + previous year.\n\n## Expected Behavior\n\n- Scripts should only fetch the last 2-3 years of calendar data (matching the API's approach).\n- Or make the year range configurable.\n\n## Files to Modify\n\n- \`scripts/seed-lc.ts\` — reduce calendar year range\n- \`scripts/lc-hourly-fetcher.ts\` — reduce calendar year range\n- \`scripts/seed-lc-infinite.ts\` — reduce calendar year range\n\n## Note for Contributors\n\nPlease create a branch named with this issue number.`,
        labels: ["enhancement", "Gssoc 26", "gssoc:approved", "level: easy", "good first issue"]
    },
    {
        title: "Add a cron-based GitHub Action to run the LeetCode seeder automatically",
        body: `## Summary\n\nCurrently the LeetCode seeder (\`seed-lc-infinite.ts\`) and hourly fetcher (\`lc-hourly-fetcher.ts\`) must be run manually on a local machine or server. There is no automated way to keep the city growing.\n\n## Expected Behavior\n\nCreate a GitHub Action workflow that:\n1. Runs on a schedule (e.g., every 6 hours)\n2. Executes the seeder for a limited batch (e.g., 5 ranking pages = ~125 users)\n3. Saves the state file back to the repo or uses a database cursor\n4. Has proper timeout and error handling\n\n## Files to Create/Modify\n\n- Create \`.github/workflows/seed-cron.yml\`\n- Modify \`scripts/seed-lc-infinite.ts\` to accept a \`--pages\` argument for batch mode\n\n## Note for Contributors\n\nPlease create a branch named with this issue number.`,
        labels: ["enhancement", "Gssoc 26", "gssoc:approved", "level: medium", "good first issue"]
    },
    {
        title: "Missing loading skeleton/shimmer for building cards and leaderboard",
        body: `## Summary\n\nWhen data is loading (e.g., clicking a building, loading the leaderboard, or searching for a user), the UI shows either nothing or a basic spinner. Modern apps use **skeleton/shimmer loading states** for a premium feel.\n\n## Expected Behavior\n\n- Building card popup should show a skeleton layout (gray boxes for avatar, name, stats) while data loads.\n- Leaderboard should show skeleton rows while loading.\n- Search results should show a shimmer effect.\n\n## Files to Modify\n\n- \`src/app/page.tsx\` — search feedback section\n- \`src/components/FlyLeaderboard.tsx\` — loading state\n- Create a reusable \`Skeleton.tsx\` component\n\n## Note for Contributors\n\nPlease create a branch named with this issue number.`,
        labels: ["enhancement", "Gssoc 26", "gssoc:approved", "level: easy", "good first issue"]
    },
    {
        title: "Add night/day cycle animation to the 3D city scene",
        body: `## Summary\n\nThe 3D city scene currently uses a static dark background. Adding a dynamic day/night cycle would make the city feel much more alive and premium.\n\n## Expected Behavior\n\n- Gradual sky color transition between day and night (based on user's local time or a configurable cycle).\n- Building windows should light up more at night and dim during the day.\n- Street lights/lamp posts could turn on at night.\n- Sun/moon positioning in the sky.\n\n## Files to Modify\n\n- \`src/components/CityScene.tsx\` — sky and lighting setup\n- \`src/components/InstancedBuildings.tsx\` — window lighting logic\n- \`src/components/EffectsLayer.tsx\` — ambient effects\n\n## Note for Contributors\n\nPlease create a branch named with this issue number.`,
        labels: ["enhancement", "Gssoc 26", "gssoc:approved", "level: hard"]
    },
];

async function createIssues() {
    console.log(`Creating ${issues.length} issues...\n`);
    
    for (let i = 0; i < issues.length; i++) {
        const issue = issues[i];
        console.log(`[${i + 1}/${issues.length}] Creating: "${issue.title}"`);
        
        const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                title: issue.title,
                body: issue.body,
                labels: issue.labels
            })
        });
        
        if (res.ok) {
            const data = await res.json();
            console.log(`  ✅ Created as #${data.number}`);
        } else {
            console.error(`  ❌ Failed:`, await res.text());
        }
        
        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 1000));
    }
    
    console.log("\n🎉 All issues created!");
}

createIssues().catch(console.error);
