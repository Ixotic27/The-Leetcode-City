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

const unblockedPRs = [680, 679, 678, 677, 675, 674, 655, 654, 653, 647, 645, 627, 597];

async function run() {
    console.log(`Analyzing ${unblockedPRs.length} unblocked pull requests:\n`);
    for (const prNumber of unblockedPRs) {
        const res = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}`, { headers });
        if (!res.ok) {
            console.error(`Failed to fetch PR #${prNumber}:`, await res.text());
            continue;
        }
        const pr = await res.json();
        console.log(`PR #${pr.number}: "${pr.title}"`);
        console.log(`  Author: @${pr.user.login}`);
        console.log(`  Mergeable: ${pr.mergeable}`);
        console.log(`  Mergeable State: ${pr.mergeable_state}`);
        console.log(`  Changed files: ${pr.changed_files}`);
        console.log(`  Head ref: ${pr.head.ref} (${pr.head.sha.substring(0, 7)})`);
        console.log(`  Base ref: ${pr.base.ref} (${pr.base.sha.substring(0, 7)})`);
        
        // Find related issues from description
        const body = pr.body || '';
        const fixesMatches = body.match(/(?:fixes|closes|resolves)\s+#(\d+)/gi);
        console.log(`  Related Issues in Body: [${fixesMatches ? fixesMatches.join(', ') : 'None'}]`);
        console.log('--------------------------------------------------');
        await new Promise(r => setTimeout(r, 600)); // Rate limiting buffer
    }
}

run().catch(console.error);
