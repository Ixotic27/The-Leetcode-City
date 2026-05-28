import fs from 'fs';

const repo = "Ixotic27/The-Leetcode-City";
const token = fs.readFileSync(".env.local", "utf-8")
    .split("\n")
    .find(line => line.startsWith("GITHUB_TOKEN="))
    ?.split("=")[1]?.trim();

const headers = {
    "Accept": "application/vnd.github.v3+json",
    "Authorization": `token ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "Node-Script"
};

async function triggerReviews() {
    const prs = [38, 39, 40, 41];
    for (const pr of prs) {
        console.log(`Triggering review for PR #${pr}`);
        const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/ai-pr-review.yml/dispatches`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                ref: "main",
                inputs: { pr_number: pr.toString() }
            })
        });
        if (res.ok || res.status === 204) {
            console.log(`✅ Success for PR #${pr}`);
        } else {
            console.error(`❌ Failed for PR #${pr}:`, await res.text());
        }
        // Small delay
        await new Promise(r => setTimeout(r, 1000));
    }
}

triggerReviews().catch(console.error);
