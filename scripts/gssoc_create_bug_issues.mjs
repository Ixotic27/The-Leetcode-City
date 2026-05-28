import fs from 'fs';

const repo = "Ixotic27/The-Leetcode-City";
const token = fs.readFileSync(".env.local", "utf-8")
    .split("\n")
    .find(line => line.startsWith("GITHUB_TOKEN="))
    ?.split("=")[1]?.trim();

if (!token) {
    console.error("No GITHUB_TOKEN found in .env.local");
    process.exit(1);
}

const headers = {
    "Accept": "application/vnd.github.v3+json",
    "Authorization": `token ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "Node-Script"
};

async function createLabel(name, color, description) {
    const res = await fetch(`https://api.github.com/repos/${repo}/labels`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name, color, description })
    });
    if (res.status === 201) {
        console.log(`Created label: ${name}`);
    } else if (res.status === 422) {
        console.log(`Label "${name}" already exists.`);
    }
}

async function createIssue(title, body, labels) {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ title, body, labels })
    });
    if (res.status === 201) {
        const issue = await res.json();
        console.log(`✅ Created issue #${issue.number}: "${title}"`);
    } else {
        console.error(`❌ Failed to create issue "${title}":`, await res.text());
    }
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 600));
}

const BRANCH_NOTE = `\n\n---\n**Note for Contributors:** Please create a branch named with this issue number and name to make it easier to identify (e.g., \`git checkout -b <issue-number>-issue-name\`).`;

async function run() {
    console.log("Creating any missing labels...\n");
    await createLabel("bug", "d73a4a", "Something isn't working");
    await createLabel("enhancement", "a2eeef", "New feature or request");
    await createLabel("beginner", "0e8a16", "Beginner level task");
    await createLabel("intermediate", "fbca04", "Intermediate level task");
    await createLabel("advanced", "b60205", "Advanced level task");
    await createLabel("good first issue", "7057ff", "Good for newcomers");
    await createLabel("Gssoc 26", "170100", "GSSoC 2026");
    await createLabel("gssoc:approved", "9313a8", "Approved for GSSoC");
    await createLabel("UI/UX", "c5def5", "User interface and experience");
    await createLabel("backend", "006b75", "Backend/API related");
    await createLabel("performance", "e6e600", "Performance improvement");

    console.log("\nCreating issues...\n");

    const issues = [
        // ──────────────────────────────────────────────────────────────
        // BUG 1: Battle shows "Must claim building first" even after login
        // ──────────────────────────────────────────────────────────────
        {
            title: "[Bug] Battle fails with 'Must claim building first' even after logging in",
            body: `### Description
When a logged-in user clicks the **⚔️ BATTLE** button on another user's building, the raid preview API returns:
\`\`\`
{ "error": "Must claim building first" }
\`\`\`
even when the user is authenticated and has linked their LeetCode account.

### Root Cause
In \`src/app/api/raid/preview/route.ts\` (line 42-52) and \`src/app/api/raid/execute/route.ts\` (line 62-82), the attacker lookup uses:
\`\`\`ts
.eq("claimed_by", user.id)
\`\`\`
This requires the user to have explicitly **claimed** a building via the old GitHub flow. However, users who **link via LeetCode verification** (\`/api/verify-leetcode\`) do get \`claimed: true\` and \`claimed_by: user.id\` set — but the lookup may fail if:
1. The session's \`user.id\` doesn't match the \`claimed_by\` column (e.g., after re-authentication)
2. The \`claimed\` flag check (\`!attacker.claimed\`) is overly strict when the user linked via LeetCode

### Steps to Reproduce
1. Sign in with GitHub OAuth
2. Link your LeetCode account via the modal
3. Navigate to another user's building
4. Click the **⚔️ BATTLE** button
5. Error appears: "Must claim building first"

### Expected Behavior
The battle preview should load and show the attack vs defense comparison.

### Affected Files
- \`src/app/api/raid/preview/route.ts\` — Lines 42-52
- \`src/app/api/raid/execute/route.ts\` — Lines 62-82
- \`src/app/api/claim/route.ts\` — Claim flow reference${BRANCH_NOTE}`,
            labels: ["bug", "good first issue", "intermediate", "Gssoc 26", "gssoc:approved"]
        },

        // ──────────────────────────────────────────────────────────────
        // BUG 2: Battle button appears on own building
        // ──────────────────────────────────────────────────────────────
        {
            title: "[Bug] Battle button appears on user's own building",
            body: `### Description
When a logged-in user clicks on **their own building**, the profile card shows the "⚔️ BATTLE" button alongside Kudos and Gift buttons. Clicking it results in a "Cannot raid yourself" error from the API.

### Root Cause
In \`src/app/page.tsx\` (around line 3767), the Kudos/Gift/Battle section is wrapped in:
\`\`\`tsx
{session && !isOwnBuilding && ( ... )}
\`\`\`
The \`isOwnBuilding\` check on line 753-756 compares \`authLogin\` (the GitHub username from OAuth metadata) with \`selectedBuilding.login\` (the LeetCode username stored in the DB). Since this project uses **LeetCode usernames** as building identifiers but authenticates via **GitHub OAuth**, these two values can be different for users who linked their LeetCode account.

The \`isOwnBuilding\` variable includes a secondary check for \`linkedLeetCodeUsername\`, but this state might not be populated yet when the profile card first renders (the \`/api/me\` fetch is async).

### Steps to Reproduce
1. Sign in with GitHub
2. Link your LeetCode account
3. Click on your own building in the city
4. Observe the Battle button is visible
5. Click it → "Cannot raid yourself" error

### Expected Behavior
The Battle, Kudos, and Gift buttons should **not** appear on the user's own building. Only the "Copy Invite Link" and settings options should be shown.

### Suggested Fix
Ensure \`isOwnBuilding\` waits for \`linkedLeetCodeUsername\` to be populated before rendering action buttons, or eagerly match both \`authLogin\` and \`linkedLeetCodeUsername\` on initial render.

### Affected Files
- \`src/app/page.tsx\` — Lines 750-756 (\`isOwnBuilding\` logic), Line 3767 (conditional render)${BRANCH_NOTE}`,
            labels: ["bug", "good first issue", "beginner", "Gssoc 26", "gssoc:approved", "UI/UX"]
        },

        // ──────────────────────────────────────────────────────────────
        // BUG 3: Building customizations reset on re-login
        // ──────────────────────────────────────────────────────────────
        {
            title: "[Bug] Building customizations (color, billboard, loadout) reset on re-login",
            body: `### Description
When a user customizes their building (custom color, billboard images, equipped crown/roof/aura loadout) and then logs out and logs back in, the building appears with default styling — all customizations are visually lost.

### Root Cause
The city data is fetched from \`/api/city\` which joins developer records. The customization data (\`custom_color\`, \`billboard_images\`, \`loadout\`) is fetched via separate API calls (\`/api/customizations\`) but may not be included in the initial city payload for all buildings.

When the auto-refresh logic runs on login (\`silentRefresh\` around line 700-742 in \`page.tsx\`), it merges the refreshed developer data but can overwrite customization fields with \`null\` if the refresh response doesn't include them:
\`\`\`ts
rawDevsRef.current[foundIdx] = {
  ...existing,
  ...devData,
  // Tries to preserve, but devData.loadout may be null
  loadout: devData.loadout ?? existing.loadout ?? null,
\`\`\`

The root issue is that the \`/api/dev/[username]\` endpoint doesn't always return the latest customization state, causing the city layout regeneration to wipe the visual state.

### Steps to Reproduce
1. Sign in and claim a building
2. Go to Shop → apply a custom color, equip crown/aura/roof items
3. Verify customizations appear on building
4. Sign out, then sign back in
5. Building appears with default styling

### Expected Behavior
All customizations should persist across login sessions and page refreshes.

### Affected Files
- \`src/app/page.tsx\` — Lines 700-742 (silent refresh logic)
- \`src/app/api/city/route.ts\` — City data payload assembly
- \`src/app/api/customizations/route.ts\` — Customization fetching${BRANCH_NOTE}`,
            labels: ["bug", "good first issue", "intermediate", "Gssoc 26", "gssoc:approved", "backend"]
        },

        // ──────────────────────────────────────────────────────────────
        // BUG 4: Bungalow preview camera angle in shop
        // ──────────────────────────────────────────────────────────────
        {
            title: "[Bug] Bungalow building preview shows wrong camera angle in Shop",
            body: `### Description
When a developer account selects the **Bungalow** building style in the Shop page, the 3D preview panel shows the building from a side/back angle instead of a proper front-facing view. The building appears flat and at an odd perspective, making it hard to see the front facade and equipped items.

Additionally, orbit rotation is **disabled** for bungalow preview (\`enableRotate={!isBungalow}\`), so the user cannot manually rotate to see a better angle.

### Root Cause
In \`src/components/ShopPreview.tsx\`:
- **Line 385:** The bungalow camera position is \`[0, camDist * 0.4, camDist * 1.2]\` — this places the camera at ground-level X=0, which creates a flat front view but at too steep a height relative to the target.
- **Line 276:** The \`OrbitControls\` target is \`[0, H * 0.8, 0]\` which looks near the top of the building instead of the center, creating the odd perspective.
- **Line 271:** \`enableRotate={!isBungalow}\` prevents the user from rotating the view.
- **Lines 372-375:** The bungalow dimensions are scaled aggressively (\`width * 2.5\`, height capped at 15), so \`camDist\` becomes very large, placing the camera extremely far away.

### Steps to Reproduce
1. Sign in and go to the Shop page (\`/shop/<username>\`)
2. Under "Building Style", select **BUNGALOW**
3. Observe the 3D preview panel — the building is shown from a bad angle with no option to rotate

### Expected Behavior
The bungalow should be shown from a slight 3/4 front-elevated angle (similar to how tower buildings appear), and users should be able to orbit/rotate the preview.

### Suggested Fix
1. Add a small X offset to the bungalow camera: \`[camDist * 0.3, camDist * 0.35, camDist * 0.8]\`
2. Center the OrbitControls target on the building body: \`[0, H * 0.3, 0]\`
3. Enable rotation for bungalow: \`enableRotate={true}\`

### Affected Files
- \`src/components/ShopPreview.tsx\` — Lines 271, 276, 385${BRANCH_NOTE}`,
            labels: ["bug", "good first issue", "beginner", "Gssoc 26", "gssoc:approved", "UI/UX"]
        },

        // ──────────────────────────────────────────────────────────────
        // BUG 5: Claim API error message is misleading
        // ──────────────────────────────────────────────────────────────
        {
            title: "[Bug] Claim API returns misleading error message for GitHub-auth users",
            body: `### Description
In \`src/app/api/claim/route.ts\` (line 22-26), the claim endpoint derives the \`githubLogin\` from OAuth metadata:
\`\`\`ts
const githubLogin = (
  user.user_metadata.user_name ??
  user.user_metadata.preferred_username ??
  ""
).toLowerCase();
\`\`\`

If no GitHub login is found, it returns:
\`\`\`json
{ "error": "No LeetCode username in profile" }
\`\`\`

This error message references "LeetCode username" but the variable is actually checking for a **GitHub** login from OAuth. This is confusing for users and developers.

### Root Cause
The error message was never updated after the project pivoted from "LeetCode City" to "LeetCode City". The variable is named \`githubLogin\` but the message says "LeetCode username".

### Steps to Reproduce
1. Authenticate via GitHub OAuth with an account that has no \`user_name\` or \`preferred_username\` in metadata
2. Call \`POST /api/claim\`
3. Observe the confusing error message

### Expected Behavior
The error message should accurately describe what's missing, e.g., "Could not determine your username from GitHub. Please try logging in again."

### Affected Files
- \`src/app/api/claim/route.ts\` — Lines 21-26${BRANCH_NOTE}`,
            labels: ["bug", "good first issue", "beginner", "Gssoc 26", "gssoc:approved"]
        },

        // ──────────────────────────────────────────────────────────────
        // BUG 6: Rate limiter memory leak in serverless
        // ──────────────────────────────────────────────────────────────
        {
            title: "[Bug] In-memory rate limiter leaks memory and resets on serverless cold starts",
            body: `### Description
The rate limiter in \`src/lib/rate-limit.ts\` uses an in-memory \`Map\` to store request counts. This has two problems:

1. **Memory leak in long-running processes:** The cleanup runs only every 60 seconds and only removes expired entries. Under sustained traffic, the Map can grow large.
2. **Ineffective on serverless:** Each Vercel serverless function cold start gets a new empty Map, meaning the rate limit resets every time a new instance spins up. Aggressive users can bypass limits by triggering new instances.

### Current Implementation
\`\`\`ts
const store = new Map<string, Entry>();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60_000;
\`\`\`

### Suggested Fix
Replace with a distributed rate limiter like:
- **Upstash Redis** (\`@upstash/ratelimit\`) — serverless-friendly, works across all instances
- **Supabase RPC** — use a DB-backed counter since Supabase is already in the stack

### Affected Files
- \`src/lib/rate-limit.ts\` — Entire file
- \`src/middleware.ts\` — Uses rate limiter${BRANCH_NOTE}`,
            labels: ["bug", "good first issue", "intermediate", "Gssoc 26", "gssoc:approved", "backend", "performance"]
        },

        // ──────────────────────────────────────────────────────────────
        // BUG 7: Raid execute has duplicate audio trigger
        // ──────────────────────────────────────────────────────────────
        {
            title: "[Bug] Raid sequence plays duplicate takeoff audio on execution",
            body: `### Description
In \`src/lib/useRaidSequence.ts\`, when \`executeRaid\` is called, the audio is triggered **twice**:

1. **Line 233-234:** After setting the phase to "intro":
\`\`\`ts
preloadRaidAudio();
playRaidSound("takeoff");
\`\`\`

2. **Line 100-102:** The \`setPhase("intro")\` callback inside the \`setState\` also triggers:
\`\`\`ts
case "intro":
  preloadRaidAudio();
  playRaidSound("takeoff");
  break;
\`\`\`

Since \`executeRaid\` calls \`setState\` with \`phase: "intro"\` (line 228), and then **also** manually calls \`preloadRaidAudio();\` and \`playRaidSound("takeoff");\` right after, the takeoff sound plays twice.

Similarly, the auto-advance timer is set **twice** — once in \`setPhase\` (line 131) and once in \`executeRaid\` (line 237).

### Steps to Reproduce
1. Sign in and start a battle against another building
2. Click "LAUNCH ATTACK" in the raid preview modal
3. Listen carefully — the takeoff sound plays twice/overlaps

### Expected Behavior
The takeoff sound and intro→flight timer should only trigger once.

### Suggested Fix
Remove the duplicate \`preloadRaidAudio();\`, \`playRaidSound("takeoff");\`, and timer setup from \`executeRaid\` (lines 232-237), and instead call \`setPhase("intro")\` which already handles all of those.

### Affected Files
- \`src/lib/useRaidSequence.ts\` — Lines 228-237 vs Lines 89-136${BRANCH_NOTE}`,
            labels: ["bug", "good first issue", "beginner", "Gssoc 26", "gssoc:approved"]
        },

        // ──────────────────────────────────────────────────────────────
        // BUG 8: Raid weekly cooldown date calculation mutates `now`
        // ──────────────────────────────────────────────────────────────
        {
            title: "[Bug] Date mutation bug in raid consumable weekly-uses calculation",
            body: `### Description
In \`src/app/api/raid/execute/route.ts\`, the weekly-use tracking for consumable items has a subtle bug where \`new Date()\` is mutated by \`setDate()\`, causing incorrect date calculations.

### Root Cause
At line 190:
\`\`\`ts
const now = new Date();
const currentWeekStr = new Date(now.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)))
  .toISOString().split('T')[0];
\`\`\`

\`now.setDate(...)\` **mutates** the \`now\` Date object in place and returns a timestamp (number). The outer \`new Date(...)\` wraps that number, but \`now\` is already modified. This means any subsequent use of \`now\` in the same function will get the wrong date (it's now pointing to the start of the week, not the current time).

This same pattern repeats at:
- Line 256 (auto-equip defense check)
- Line 390 (consumeDeveloperItem helper)

### Impact
Weekly use counters may be incorrectly tracked, potentially allowing more or fewer uses than intended.

### Suggested Fix
Create a separate Date object for the week calculation:
\`\`\`ts
const today = new Date();
const isoWeekStart = new Date(today);
isoWeekStart.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
isoWeekStart.setHours(0, 0, 0, 0);
const currentWeekStr = isoWeekStart.toISOString().split('T')[0];
\`\`\`

### Affected Files
- \`src/app/api/raid/execute/route.ts\` — Lines 190, 256, 390${BRANCH_NOTE}`,
            labels: ["bug", "good first issue", "beginner", "Gssoc 26", "gssoc:approved", "backend"]
        },

        // ──────────────────────────────────────────────────────────────
        // BUG 9: isV2Dev always returns false (dead code)
        // ──────────────────────────────────────────────────────────────
        {
            title: "[Bug] `isV2Dev()` always returns false — V2 building formulas are dead code",
            body: `### Description
In \`src/lib/github.ts\` at line 192, the \`isV2Dev()\` function always returns \`false\`:

\`\`\`ts
function isV2Dev(dev: DeveloperRecord): boolean {
  return false;
}
\`\`\`

This means the V2 building calculation functions (\`calcHeightV2\`, \`calcWidthV2\`, \`calcDepthV2\`, \`calcLitPercentageV2\`) are **completely dead code** — they are defined (lines 195-281) but never executed.

### Impact
- All buildings use the V1 formula regardless of their data richness
- The V2 formulas that account for \`contributions_total\`, \`total_prs\`, \`total_reviews\`, \`repos_contributed_to\`, \`followers\`, \`contribution_years\`, etc. are wasted
- The \`calcBuildingDims\` export (line 812) checks \`contributions_total > 0\` to decide V2, but the layout generation never does

### Suggested Fix
Either:
1. Implement proper V2 detection logic (e.g., \`return (dev.contributions_total ?? 0) > 0\`)
2. Or remove the dead V2 code to reduce bundle size and confusion

### Affected Files
- \`src/lib/github.ts\` — Lines 191-281 (V2 functions), Line 315 (\`isV2Dev\` call)${BRANCH_NOTE}`,
            labels: ["bug", "good first issue", "beginner", "Gssoc 26", "gssoc:approved"]
        },

        // ──────────────────────────────────────────────────────────────
        // BUG 10: checkin route uses GitHub GraphQL for LeetCode-based project
        // ──────────────────────────────────────────────────────────────
        {
            title: "[Bug] Check-in route fetches GitHub GraphQL contributions for a LeetCode-based project",
            body: `### Description
In \`src/app/api/checkin/route.ts\` (lines 80-129), the \`fetchWeeklyContributions()\` function uses the **GitHub GraphQL API** to fetch the user's weekly contribution count:

\`\`\`ts
const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: {
    Authorization: \\\`Bearer \${token}\\\`,
    ...
  },
  body: JSON.stringify({
    query: \\\`query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            weeks { contributionDays { contributionCount, date } }
          }
        }
      }
    }\\\`,
    variables: { login },
  }),
});
\`\`\`

However, this project is **LeetCode City** — the \`login\` variable is the user's **LeetCode username**, not their GitHub username. LeetCode usernames are not valid GitHub logins, so this API call will always fail silently (returning \`null\`) for most users.

### Impact
- \`current_week_contributions\` is never properly updated for LeetCode users
- Battle/Raid scores that depend on \`weeklyContributions\` will always be 0, making battles unfair
- The weekly contribution count shown in the UI will be stale/zero

### Suggested Fix
Replace the GitHub GraphQL call with a LeetCode API call to fetch recent submission activity, or use the existing data from the \`verify-leetcode\` flow (which already fetches submission calendars).

### Affected Files
- \`src/app/api/checkin/route.ts\` — Lines 80-129 (\`fetchWeeklyContributions\`)
- \`src/lib/leetcode.ts\` — Could be extended for this purpose${BRANCH_NOTE}`,
            labels: ["bug", "good first issue", "intermediate", "Gssoc 26", "gssoc:approved", "backend"]
        },

        // ──────────────────────────────────────────────────────────────
        // BUG 11: Empty catch blocks swallow errors silently
        // ──────────────────────────────────────────────────────────────
        {
            title: "[Improvement] Replace empty catch blocks with proper error logging",
            body: `### Description
Throughout the codebase, there are dozens of empty \`catch {}\` or \`catch { /* ignore */ }\` blocks that silently swallow errors with no logging. This makes debugging production issues extremely difficult.

### Examples Found
- \`src/app/page.tsx\` — Multiple instances (lines 661, 683, 734, 860, 920, etc.)
- \`src/app/api/raid/execute/route.ts\` — Line 130: \`catch { // raids table may not exist yet }\`
- \`src/app/api/raid/preview/route.ts\` — Line 117: same pattern
- \`src/app/api/verify-leetcode/route.ts\` — Line 114: \`catch { }\` swallows entire LC stats fetch failure
- \`src/app/api/checkin/route.ts\` — Line 308: swallows raid history fetch

### Impact
- Critical data fetch failures are invisible
- Bugs go undetected because errors are silently dropped
- Makes debugging production issues nearly impossible

### Suggested Fix
At minimum, add \`console.error\` or \`console.warn\` logging in catch blocks:
\`\`\`ts
// Before:
catch { /* ignore */ }

// After:
catch (err) {
  console.warn("[context] Non-critical error:", err);
}
\`\`\`

For truly ignorable errors, add a comment explaining **why** it's safe to ignore.

### Affected Files
Project-wide — primary files listed above${BRANCH_NOTE}`,
            labels: ["enhancement", "good first issue", "beginner", "Gssoc 26", "gssoc:approved"]
        },

        // ──────────────────────────────────────────────────────────────
        // BUG 12: Missing dotenv dependency for scripts
        // ──────────────────────────────────────────────────────────────
        {
            title: "[Bug] Script `add-leetcode-items.ts` crashes with 'Cannot find module dotenv'",
            body: `### Description
Running the \`scripts/add-leetcode-items.ts\` script fails with:
\`\`\`
Error: Cannot find module 'dotenv'
Require stack:
- D:\\leetcode\\scripts\\add-leetcode-items.ts
\`\`\`

The script imports \`dotenv\` but it's not listed in \`package.json\` dependencies or devDependencies. Other scripts use the \`--env-file=.env.local\` flag with \`tsx\` which doesn't need \`dotenv\`.

### Steps to Reproduce
1. Run any command that triggers \`scripts/add-leetcode-items.ts\`
2. Script crashes immediately with MODULE_NOT_FOUND error

### Expected Behavior
Either:
1. Add \`dotenv\` as a dev dependency: \`npm install -D dotenv\`
2. Or refactor the script to use the \`--env-file\` pattern like other scripts in \`package.json\`

### Evidence
Error captured in \`error.log\` at the project root.

### Affected Files
- \`scripts/add-leetcode-items.ts\` — Import statement
- \`package.json\` — Missing dependency${BRANCH_NOTE}`,
            labels: ["bug", "good first issue", "beginner", "Gssoc 26", "gssoc:approved"]
        },

        // ──────────────────────────────────────────────────────────────
        // BUG 13: Supabase admin client created on every API call
        // ──────────────────────────────────────────────────────────────
        {
            title: "[Performance] Supabase admin client is re-created on every API call",
            body: `### Description
In \`src/lib/supabase.ts\`, the \`getSupabaseAdmin()\` function creates a **new** Supabase client instance on every call:

\`\`\`ts
export function getSupabaseAdmin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
\`\`\`

Compare this to the browser client which uses a singleton pattern (\`createBrowserSupabase()\` on lines 7-15).

### Impact
- Each API endpoint call creates a new HTTP connection pool
- Increased memory usage and connection overhead
- Slower API response times due to connection setup

### Suggested Fix
Cache the admin client as a module-level singleton (similar to the browser client):
\`\`\`ts
let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;
  adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  return adminClient;
}
\`\`\`

### Affected Files
- \`src/lib/supabase.ts\` — \`getSupabaseAdmin()\` function${BRANCH_NOTE}`,
            labels: ["enhancement", "good first issue", "beginner", "Gssoc 26", "gssoc:approved", "performance", "backend"]
        },

        // ──────────────────────────────────────────────────────────────
        // BUG 14: Hardcoded bungalow login check
        // ──────────────────────────────────────────────────────────────
        {
            title: "[Bug] Bungalow building style contains hardcoded username check",
            body: `### Description
In \`src/lib/github.ts\` at lines 507-511, there is a hardcoded username check for the bungalow building style:

\`\`\`ts
// BUNGALOW OVERRIDE
if (dev.github_login.toLowerCase() === "ishant_27" && dev.building_style === "bungalow") {
  w = 80;
  d = 60;
  height = 25;
}
\`\`\`

This means only the user \`ishant_27\` gets the bungalow dimensions override. Any other user who selects "bungalow" style in the shop will get normal tower dimensions, making the bungalow style effectively broken for all other users.

### Impact
- The "Bungalow" building style option in the Shop is non-functional for 99.99% of users
- Users pay/select bungalow but see a normal-looking tower building

### Suggested Fix
Remove the hardcoded username check and apply bungalow dimensions based solely on \`building_style === "bungalow"\`:
\`\`\`ts
if (dev.building_style === "bungalow") {
  w = 80;
  d = 60;
  height = 25;
}
\`\`\`

### Affected Files
- \`src/lib/github.ts\` — Lines 507-511${BRANCH_NOTE}`,
            labels: ["bug", "good first issue", "beginner", "Gssoc 26", "gssoc:approved"]
        },

        // ──────────────────────────────────────────────────────────────
        // BUG 15: Main page.tsx is 5000+ lines monolith
        // ──────────────────────────────────────────────────────────────
        {
            title: "[Refactor] Main page.tsx is a 5000+ line monolithic component",
            body: `### Description
The main application file \`src/app/page.tsx\` is **5,079 lines** (232KB) containing a single massive \`HomeContent\` component. This file includes:
- 100+ state variables
- All UI rendering (HUD, search, profile cards, modals, leaderboards, fly mode, raid system, etc.)
- Dozens of \`useEffect\` hooks
- All event handlers and callbacks

### Impact
- Extremely difficult to review PRs that touch this file
- High risk of merge conflicts when multiple contributors work on different features
- Poor IDE performance (auto-complete, linting) due to file size
- Impossible to unit test individual features
- New contributors are overwhelmed trying to understand the codebase

### Suggested Fix
Break the monolithic component into smaller, focused components:
1. \`SearchBar\` — Search input + feedback
2. \`ProfileCard\` — Building profile panel + actions (kudos, gift, battle)
3. \`FlyModeHUD\` — Fly mode controls and score display
4. \`RaidSystem\` — Battle preview, execution, and results
5. \`CityHUD\` — District announcements, minimap, stats
6. \`AuthManager\` — Session management and LeetCode linking
7. \`SettingsPanel\` — Theme, preferences, loadout

Use React Context or a state management library for shared state.

### Affected Files
- \`src/app/page.tsx\` — Entire file (5,079 lines)${BRANCH_NOTE}`,
            labels: ["enhancement", "good first issue", "advanced", "Gssoc 26", "gssoc:approved"]
        },

        // ──────────────────────────────────────────────────────────────
        // BUG 16: eslint-disable comments for any types
        // ──────────────────────────────────────────────────────────────
        {
            title: "[Improvement] Replace `eslint-disable` comments and `any` types with proper typing",
            body: `### Description
Multiple API routes and components use \`// eslint-disable-next-line @typescript-eslint/no-explicit-any\` followed by \`Record<string, any>\` type assertions. This undermines TypeScript's type safety.

### Examples
- \`src/app/api/raid/preview/route.ts\` — Lines 47-48, 60-61
- \`src/app/api/raid/execute/route.ts\` — Lines 75-78
- \`src/app/api/verify-leetcode/route.ts\` — Lines 51, 168
- \`src/app/page.tsx\` — Line 383, 671

### Impact
- Runtime errors from unexpected data shapes go undetected at compile time
- Contributors can't rely on TypeScript for safe refactoring
- ESLint rules are defeated by disable comments

### Suggested Fix
Define proper interfaces for Supabase query results:
\`\`\`ts
interface DeveloperRow {
  id: number;
  claimed: boolean;
  app_streak: number;
  github_login: string;
  avatar_url: string | null;
  // ... etc
}
\`\`\`

Then use: \`const attacker = attackerRes.data as DeveloperRow | null;\`

### Affected Files
Project-wide — primary files listed above${BRANCH_NOTE}`,
            labels: ["enhancement", "good first issue", "beginner", "Gssoc 26", "gssoc:approved"]
        },
    ];

    for (const issue of issues) {
        await createIssue(issue.title, issue.body, issue.labels);
    }

    console.log(`\n🎉 Done! Created ${issues.length} new issues.`);
}

run().catch(console.error);
