import fs from 'fs';

const repo = "Ixotic27/The-Leetcode-City";
const token = fs.readFileSync(".env.local", "utf-8")
    .split("\n")
    .find(line => line.startsWith("GITHUB_TOKEN="))
    ?.split("=")[1]?.trim();

const headers = {
    "Accept": "application/vnd.github.v3+json",
    "Authorization": `token ${token}`,
    "Content-Type": "application/json"
};

async function mergePR(num) {
    console.log(`Merging PR #${num}...`);
    const mergeRes = await fetch(`https://api.github.com/repos/${repo}/pulls/${num}/merge`, {
        method: 'PUT', headers,
        body: JSON.stringify({ merge_method: 'squash' })
    });
    if (mergeRes.ok) {
        console.log(`✅ PR #${num} merged successfully!`);
    } else {
        console.error(`❌ Failed to merge PR #${num}:`, await mergeRes.text());
    }
}

await mergePR(216);
