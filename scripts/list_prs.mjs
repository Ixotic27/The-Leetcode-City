import fs from 'fs';

const repo = "Ixotic27/The-Leetcode-City";
const token = fs.readFileSync(".env.local", "utf-8")
    .split("\n")
    .find(line => line.startsWith("GITHUB_TOKEN="))
    ?.split("=")[1]?.trim();

const headers = {
    "Accept": "application/vnd.github.v3+json",
    "Authorization": `token ${token}`,
    "User-Agent": "Node-Script"
};

async function listPrs() {
    const res = await fetch(`https://api.github.com/repos/${repo}/pulls?state=open`, { headers });
    const prs = await res.json();
    
    if (prs.length === 0) {
        console.log("No open pull requests found!");
        return;
    }
    
    console.log(`Found ${prs.length} open pull requests:`);
    for (const pr of prs) {
        console.log(`\n[PR #${pr.number}] ${pr.title}`);
        console.log(`Author: @${pr.user.login}`);
        console.log(`Branch: ${pr.head.ref}`);
        console.log(`URL: ${pr.html_url}`);
    }
}

listPrs().catch(console.error);
