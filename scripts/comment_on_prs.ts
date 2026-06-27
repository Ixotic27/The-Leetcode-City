import fs from "fs";
import path from "path";

const repo = "Ixotic27/The-Leetcode-City";
const envPath = path.join(process.cwd(), ".env.local");
const token = fs.readFileSync(envPath, "utf-8")
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

const comments = {
    675: `Hi @ShafinNigamana, 

Thank you for your pull request! We noticed a database execution issue with this implementation.

The SQL migration adds a partial unique index:
\`\`\`sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_unique_free
  ON purchases (developer_id, item_id)
  WHERE provider = 'free';
\`\`\`
Because this index is partial, performing a Supabase/PostgREST upsert with \`onConflict: "developer_id,item_id"\` compiles to a Postgres \`ON CONFLICT (developer_id, item_id)\` statement which does not specify the \`WHERE\` condition. Postgres rejects this with:
\`ERROR: there is no unique or exclusion constraint matching the ON CONFLICT specification (code 42P10)\`

This causes all free claim calls to fail with a database error. Please update the implementation (e.g. by using a standard \`insert\` or using the \`provider_tx_id\` column as the conflict target, which has a non-partial unique index).`,

    597: `Hi @Stewartsson,

Thank you for your contribution! We reviewed the code in detail and identified a few issues that will prevent it from working in production:

1. **Supabase Client / RLS Policies**: Inside \`src/services/achievementService.ts\`, the Supabase client is initialized using \`NEXT_PUBLIC_SUPABASE_ANON_KEY\`. Since \`developer_achievements\` and \`activity_feed\` tables have Row-Level Security (RLS) enabled and only allow \`SELECT\` for anonymous/public access, attempting to write (\`.insert()\`) with the anon key will be blocked by RLS policies. You should use the service-role admin client (\`getSupabaseAdmin()\`) for these backend database writes.
2. **Activity Feed Schema Mismatch**: The columns \`developer_id\`, \`activity_type\`, and \`description\` do not exist in the \`activity_feed\` table. The correct columns are \`actor_id\` (representing the developer), \`event_type\`, and any custom text/descriptions should be stored inside the \`metadata\` JSONB object. Attempting to insert non-existent columns will cause the database transaction to fail.

Could you please address these points so we can merge this manually? Thanks!`,

    627: `Hi @saurabhhhcodes,

Thank you for your pull request! 

We noticed that this PR conflicts with PR #647 as both address the minimap chat overlap issue by editing \`src/components/CityChat.tsx\`. 

Additionally, we found a small user experience issue in this implementation: \`lastSeenMsgCount\` is updated only within the close/open button \`onClick\` handlers. If new chat messages arrive while the chat panel is open, they are not marked as read, causing the unread indicator to reappear immediately after closing the panel. 

We will be proceeding with the implementation in PR #647 instead, as it handles derived state updates during render to keep the unread message count correctly synchronized when new messages arrive while the chat is open.`
};

async function run() {
    for (const [prNumber, body] of Object.entries(comments)) {
        console.log(`Posting comment to PR #${prNumber}...`);
        const url = `https://api.github.com/repos/${repo}/issues/${prNumber}/comments`;
        const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({ body })
        });
        if (!res.ok) {
            console.error(`Failed to post comment to PR #${prNumber}:`, await res.text());
        } else {
            console.log(`✅ Successfully posted comment to PR #${prNumber}!`);
        }
    }
}

run().catch(console.error);
