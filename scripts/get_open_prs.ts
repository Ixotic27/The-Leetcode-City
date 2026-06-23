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

async function run() {
    const res = await fetch(`https://api.github.com/repos/${repo}/pulls?state=open&per_page=100`, { headers });
    if (!res.ok) {
        console.error("Failed to fetch pulls:", await res.text());
        return;
    }
    const pulls = await res.json();
    console.log(`Found ${pulls.length} open pull requests:\n`);
    for (const pr of pulls) {
        const labels = pr.labels.map((l: any) => l.name);
        console.log(`PR #${pr.number}: "${pr.title}"`);
        console.log(`  Author: @${pr.user.login}`);
        console.log(`  Labels: [${labels.join(', ')}]`);
        console.log(`  Branch: ${pr.head.ref}`);
        console.log(`  Link: ${pr.html_url}`);
        console.log(`  Body length: ${pr.body ? pr.body.length : 0} chars`);
        console.log('--------------------------------------------------');
    }
}

run().catch(console.error);
