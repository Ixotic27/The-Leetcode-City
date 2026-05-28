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

async function processPRs() {
    const prs = [
        { number: 37, author: "PranavAgarkar07", action: "merge", reason: "Already approved, ready to merge" },
        { number: 38, author: "Shreeya1207", action: "setup", reason: "Needs labels, assignee, reviewer" },
        { number: 39, author: "Shreeya1207", action: "setup", reason: "Needs labels, assignee, reviewer" },
        { number: 40, author: "Shreeya1207", action: "setup", reason: "Needs labels, assignee, reviewer" },
        { number: 41, author: "Logesh-Pro", action: "setup", reason: "Needs labels, assignee, reviewer" },
    ];

    for (const pr of prs) {
        console.log(`\n--- Processing PR #${pr.number} (${pr.reason}) ---`);

        if (pr.action === "merge") {
            // PR #37 is already approved — merge it
            console.log(`Merging PR #${pr.number}...`);
            const mergeRes = await fetch(`https://api.github.com/repos/${repo}/pulls/${pr.number}/merge`, {
                method: 'PUT', headers,
                body: JSON.stringify({ merge_method: 'squash' })
            });
            if (mergeRes.ok) {
                console.log(`✅ PR #${pr.number} merged successfully!`);
            } else {
                console.error(`❌ Failed to merge PR #${pr.number}:`, await mergeRes.text());
            }
            continue;
        }

        // For "setup" PRs: add assignee, labels, and request reviewer

        // 1. Assign the PR to the author
        console.log(`  Assigning @${pr.author}...`);
        await fetch(`https://api.github.com/repos/${repo}/issues/${pr.number}`, {
            method: 'PATCH', headers,
            body: JSON.stringify({ assignees: [pr.author] })
        });

        // 2. Add GSSoC labels
        console.log(`  Adding labels...`);
        await fetch(`https://api.github.com/repos/${repo}/issues/${pr.number}/labels`, {
            method: 'POST', headers,
            body: JSON.stringify({ labels: ["Gssoc 26", "gssoc:approved"] })
        });

        // 3. Request review from Ixotic27
        console.log(`  Requesting review from @Ixotic27...`);
        await fetch(`https://api.github.com/repos/${repo}/pulls/${pr.number}/requested_reviewers`, {
            method: 'POST', headers,
            body: JSON.stringify({ reviewers: ["Ixotic27"] })
        });

        console.log(`  ✅ PR #${pr.number} setup complete!`);
    }

    console.log("\n🎉 All PRs processed!");
}

processPRs().catch(console.error);
