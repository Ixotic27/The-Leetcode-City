import fs from "fs";

const repo = "Ixotic27/The-Leetcode-City";
const token = fs
  .readFileSync(".env.local", "utf-8")
  .split("\n")
  .find((line) => line.startsWith("GITHUB_TOKEN="))
  ?.split("=")[1]
  ?.trim();

if (!token) {
  console.error("No GITHUB_TOKEN found in .env.local");
  process.exit(1);
}

const headers = {
  Accept: "application/vnd.github.v3+json",
  Authorization: `token ${token}`,
  "Content-Type": "application/json",
  "User-Agent": "Node-Script",
};

async function createLabel(name, color, description) {
  const res = await fetch(`https://api.github.com/repos/${repo}/labels`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name, color, description }),
  });
  if (res.status === 201) {
    console.log(`Created label: ${name}`);
  } else if (res.status === 422) {
    console.log(`Label ${name} already exists.`);
  }
}

async function createIssue(title, body, labels) {
  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers,
    body: JSON.stringify({ title, body, labels }),
  });
  if (res.status === 201) {
    const issue = await res.json();
    console.log(`Created issue: ${title} (#${issue.number})`);
  } else {
    console.error(`Failed to create issue ${title}:`, await res.text());
  }
}

async function run() {
  await createLabel("advanced", "b60205", "Advanced level task");

  const issues = [
    {
      title: "Optimize and Scale LeetCode User Fetching Pipeline",
      body: `### The Problem\nCurrently, we fetch and update LeetCode user data using a long-running background script (\`scripts/lc-hourly-fetcher.ts\`). \n\n**Current Approach:**\n- Runs an infinite \`while(true)\` loop.\n- Fetches the 75 most "stale" users from the Supabase database every hour.\n- Makes individual sequential GraphQL requests to LeetCode API.\n- Sleeps between requests to avoid rate limits.\n\n**Why it needs improvement:**\n1. **Scalability:** We can only update ~1,800 developers per day. As the city grows, many buildings will become hopelessly outdated.\n2. **Infrastructure:** It requires a dedicated long-running process (like PM2 or Railway) instead of a modern serverless cron.\n3. **Discovery:** It only updates *existing* developers in the database; it doesn't help us efficiently discover and add *new* active LeetCode users every day.\n\n### Proposed Solution\nWe are looking for an efficient, robust way to sync thousands of users daily. \nSome ideas to explore:\n- **Serverless/Cron Migration:** Move the fetching logic to Vercel Cron or GitHub Actions matrix workflows to eliminate the need for a 24/7 background server.\n- **Batching & Concurrency:** Can we use proxies, edge functions, or batch GraphQL queries to fetch multiple users concurrently without getting IP banned by LeetCode?\n- **Automated Discovery:** Build a mechanism to scrape daily active LeetCode users (e.g., from contest leaderboards) and automatically insert them into our Supabase DB so they get a building in the city.\n\nIf you have experience with data pipelines, job queues, or web scraping at scale, we'd love to hear your architectural proposal before you start coding!`,
      labels: ["good first issue", "intermediate", "advanced"],
    },
  ];

  for (const issue of issues) {
    await createIssue(issue.title, issue.body, issue.labels);
  }
}

run().catch(console.error);
