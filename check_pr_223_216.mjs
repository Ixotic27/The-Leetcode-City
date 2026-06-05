import fs from 'fs';

const repo = "Ixotic27/The-Leetcode-City";
const token = fs.readFileSync(".env.local", "utf-8")
    .split("\n")
    .find(line => line.startsWith("GITHUB_TOKEN="))
    ?.split("=")[1]?.trim();

const headers = {
    "Accept": "application/vnd.github.v3+json",
    "Authorization": `token ${token}`
};

async function getPR(num) {
    const res = await fetch(`https://api.github.com/repos/${repo}/pulls/${num}`, { headers });
    const data = await res.json();
    
    // get diff
    const diffRes = await fetch(data.diff_url, { headers });
    const diff = await diffRes.text();
    
    console.log(`\n\n=== PR #${num}: ${data.title} ===`);
    console.log(`State: ${data.state}, Mergeable: ${data.mergeable}`);
    console.log(`Diff length: ${diff.length} bytes`);
    console.log(diff.slice(0, 3000)); // print first 3000 chars of diff
}

await getPR(223);
await getPR(216);
