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
        console.log(`Label ${name} already exists.`);
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
        console.log(`Created issue: ${title} (#${issue.number})`);
    } else {
        console.error(`Failed to create issue ${title}:`, await res.text());
    }
}

async function run() {
    // Make sure tags/labels exist
    await createLabel("bug", "d73a4a", "Something isn't working");
    await createLabel("backend", "0052cc", "Backend database/API logic");
    await createLabel("realtime", "1d76db", "Supabase Realtime multiplayer features");
    await createLabel("performance", "cccccc", "Performance tuning and scaling");

    const issues = [
        {
            title: "Multiplayer Migrations: Missing Realtime Database Tables",
            body: `### Description
The tables \`arcade_chat_messages\` and \`arcade_active_players\` are missing from the hosted/remote Supabase database (resulting in 404 REST API errors in the browser console). This is because the migration file \`066_supabase_realtime_multiplayer.sql\` was not successfully run on the remote Supabase DB due to the missing \`exec_sql\` RPC helper function.

### Proposed Fix
1. Execute the DDL script manually inside the Supabase Dashboard SQL Editor:
\`\`\`sql
-- Create active players table for multiplayer presence heartbeat tracking
CREATE TABLE IF NOT EXISTS public.arcade_active_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL,
  last_heartbeat TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_user_active_room UNIQUE (user_id, room_id)
);

-- Enable RLS
ALTER TABLE public.arcade_active_players ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active players for counting
CREATE POLICY "Allow public read access to active players" ON public.arcade_active_players
  FOR SELECT TO public USING (true);

-- Allow authenticated users to upsert their own presence heartbeats
CREATE POLICY "Allow authenticated users to upsert heartbeats" ON public.arcade_active_players
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create chat messages table
CREATE TABLE IF NOT EXISTS public.arcade_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  username TEXT NOT NULL,
  text VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.arcade_chat_messages ENABLE ROW LEVEL SECURITY;

-- Allow public read access to chat messages
CREATE POLICY "Allow public read access to chat messages" ON public.arcade_chat_messages
  FOR SELECT TO public USING (true);

-- Allow authenticated users to insert messages
CREATE POLICY "Allow authenticated users to insert chat" ON public.arcade_chat_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
\`\`\`

2. To support automatic migrations going forward, optionally define the \`exec_sql\` RPC function in Supabase SQL editor:
\`\`\`sql
CREATE OR REPLACE FUNCTION exec_sql(query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE query;
END;
$$;
\`\`\`
`,
            labels: ["bug", "backend", "realtime"]
        },
        {
            title: "Multiplayer: Remote Player Position Interpolation / Smoothing",
            body: `### Description
The transition to client-authoritative movement via Supabase Realtime broadcast works instantly for the local player, but because position updates are broadcast on every step and Presence is throttled (\`PRESENCE_TRACK_THROTTLE_MS = 1500\`), remote players can appear laggy or snap between coordinates when moving, especially under network jitter.

### Proposed Solution
Add linear interpolation (lerp) or delta-time-based coordinate smoothing in the client rendering engine (\`src/lib/arcade/engine/renderer.ts\` or the page update loop) for remote player nodes. When a remote movement event is received:
1. Don't immediately teleport the player.
2. Smoothly slide the player's coordinate over the next ~150-200ms towards the target tile.
`,
            labels: ["performance", "realtime"]
        },
        {
            title: "Multiplayer: Pruning Inactive Active Players (Stale Presence Cleanup)",
            body: `### Description
When a player disconnects, we call \`disconnect()\` which deletes their row from \`arcade_active_players\`. However, if the player suddenly closes the tab, loses network connection, or the browser freezes/sleeps, the active player entry will remain in the database indefinitely.

### Proposed Solution
Implement a pruning mechanism to remove stale active player records.
1. Run a database cron job using pg_cron or an edge function that executes:
\`\`\`sql
DELETE FROM public.arcade_active_players WHERE last_heartbeat < now() - INTERVAL '1 minute';
\`\`\`
2. Or perform this cleanup periodically on room fetch/route handler calls to keep the room/player counts accurate.
`,
            labels: ["bug", "backend"]
        }
    ];

    for (const issue of issues) {
        await createIssue(issue.title, issue.body, issue.labels);
    }
}

run().catch(console.error);
