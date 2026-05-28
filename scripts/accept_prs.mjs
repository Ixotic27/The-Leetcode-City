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

async function processPrs() {
    // We will merge PR 29 and 30 (the real contributor PRs)
    const prsToMerge = [29, 30];
    
    // We will close the automated/duplicate Copilot PRs
    const prsToClose = [33, 34, 35, 36];

    for (const pr of prsToMerge) {
        console.log(`Approving PR #${pr}...`);
        await fetch(`https://api.github.com/repos/${repo}/pulls/${pr}/reviews`, {
            method: 'POST', headers,
            body: JSON.stringify({ event: 'APPROVE', body: '✅ Looks great! Thank you for the contribution. Merging now.' })
        });

        console.log(`Merging PR #${pr}...`);
        const res = await fetch(`https://api.github.com/repos/${repo}/pulls/${pr}/merge`, {
            method: 'PUT', headers,
            body: JSON.stringify({ merge_method: 'squash' })
        });
        
        if (!res.ok) {
            console.error(`Failed to merge PR #${pr}:`, await res.text());
        } else {
            console.log(`Successfully merged PR #${pr}!`);
        }
    }

    for (const pr of prsToClose) {
        console.log(`Closing duplicate/Copilot PR #${pr}...`);
        await fetch(`https://api.github.com/repos/${repo}/pulls/${pr}`, {
            method: 'PATCH', headers,
            body: JSON.stringify({ state: 'closed' })
        });
    }
    
    console.log("Finished processing PRs!");
}

processPrs().catch(console.error);
