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

async function checkPRStatus() {
    const prNumber = 40;
    console.log(`Fetching status checks for PR #${prNumber}...`);
    
    // Get PR to get head sha
    const prRes = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}`, { headers });
    const pr = await prRes.json();
    const sha = pr.head.sha;
    
    // Get statuses for sha
    const statusRes = await fetch(`https://api.github.com/repos/${repo}/commits/${sha}/statuses`, { headers });
    const statuses = await statusRes.json();
    
    console.log(`\nStatuses for SHA ${sha}:`);
    for (const st of statuses || []) {
        console.log(`- ${st.context}: ${st.state} (${st.description})`);
    }
}

checkPRStatus().catch(console.error);
