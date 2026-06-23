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
    "Accept": "application/vnd.github.v3.diff", // Fetch raw diff
    "Authorization": `token ${token}`,
    "User-Agent": "Node-Script"
};

const unblockedPRs = [680, 679, 678, 677, 675, 674, 655, 654, 653, 647, 645, 627, 597];

async function run() {
    const outputDir = path.join(process.cwd(), "scratch", "pr_diffs");
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`Downloading diffs for ${unblockedPRs.length} PRs:\n`);
    for (const prNumber of unblockedPRs) {
        const res = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}`, { headers });
        if (!res.ok) {
            console.error(`Failed to fetch diff for PR #${prNumber}:`, await res.text());
            continue;
        }
        const diffText = await res.text();
        const outputPath = path.join(outputDir, `${prNumber}.diff`);
        fs.writeFileSync(outputPath, diffText, 'utf-8');
        console.log(`✅ Downloaded diff for PR #${prNumber} to scratch/pr_diffs/${prNumber}.diff`);
        await new Promise(r => setTimeout(r, 600)); // Rate limit buffer
    }
}

run().catch(console.error);
