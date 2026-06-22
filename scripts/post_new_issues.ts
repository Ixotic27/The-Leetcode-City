import fs from 'fs';
import path from 'path';

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

async function createIssue(title: string, body: string, labels: string[]) {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ title, body, labels })
    });
    if (res.status === 201) {
        const issue = await res.json();
        console.log(`Created issue: ${title} (#${issue.number}) -> ${issue.html_url}`);
    } else {
        console.error(`Failed to create issue ${title}:`, await res.text());
    }
}

async function run() {
    const issues = [
        {
            title: "🐛 Bug: Black screen flash before City Canvas is fully loaded",
            body: `### Description\nWhen the loading progress bar reaches 100%, there is a brief black or blank screen transition before the 3D City Scene appears. This is due to WebGL shader compilation and asset loading occurring after the loading overlay is dismissed.\n\n### Expected Behavior\nThe transition from the loading screen to the 3D City should be seamless, with no blank/black screen visible.\n\n### Proposed Solution\n1. Keep the loading overlay active until the React Three Fiber Canvas is fully ready.\n2. Use the \`onCreated\` callback on \`<Canvas>\` or a WebGL context compilation callback to confirm the first frame has successfully rendered before hiding the loader.`,
            labels: ["bug", "frontend", "performance"]
        },
        {
            title: "🔒 Security: XP Redeem Code Race Condition",
            body: `### Description\nThere is a race condition in the XP special code redemption process. If multiple requests are sent concurrently (or a user double-clicks the redeem button), the same code can be processed multiple times before the database flags it as redeemed/used.\n\n### Proposed Solution\nPerform the code validation and redemption entry inside a database transaction using \`SELECT ... FOR UPDATE\` or inside a secure Supabase RPC/stored procedure to guarantee atomicity.`,
            labels: ["bug", "backend"]
        },
        {
            title: "🔒 Security: Rate Limiting Vulnerability on Daily Check-In Route",
            body: `### Description\nThe daily check-in API endpoint lacks rate limiting, permitting automated script checks to spam the server and manipulate daily engagement rewards.\n\n### Proposed Solution\nImplement a sliding-window rate limiter inside the check-in route using Upstash Redis to prevent more than one request per developer account per 24 hours.`,
            labels: ["bug", "backend"]
        },
        {
            title: "🐛 Bug: White Rabbit Quest Capture Race Condition",
            body: `### Description\nMultiple clients can click and claim the same White Rabbit spawn event simultaneously because the capture confirmation is handled concurrently, leading to duplicate rewards for a single spawn.\n\n### Proposed Solution\nGate the capture confirmation with a database unique constraint or a distributed lock (e.g. via Upstash Redis) so that only the first capture event to reach the server is validated and rewarded.`,
            labels: ["bug", "backend", "realtime"]
        }
    ];

    for (const issue of issues) {
        await createIssue(issue.title, issue.body, issue.labels);
    }
}

run().catch(console.error);
