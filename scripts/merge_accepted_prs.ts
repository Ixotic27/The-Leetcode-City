import fs from "fs";
import path from "path";

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

const prsToMerge = [680, 679, 677, 674, 655, 654, 653, 645, 647];

async function mergePR(prNumber: number) {
    console.log(`\n--- Processing PR #${prNumber} ---`);

    // 1. Post approving review comment
    console.log(`  Approving PR #${prNumber}...`);
    const reviewRes = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}/reviews`, {
        method: "POST",
        headers,
        body: JSON.stringify({
            event: "APPROVE",
            body: "Approved! This is a clean and correct implementation. Thank you for your contribution to LeetCode City!"
        })
    });

    if (reviewRes.ok) {
        console.log(`  ✅ PR #${prNumber} approved with comment.`);
    } else {
        console.warn(`  ⚠️ Failed to approve PR #${prNumber}:`, await reviewRes.text());
    }

    // 2. Ensure quality tags/labels are set
    // Fetch PR details to check existing labels
    const prRes = await fetch(`https://api.github.com/repos/${repo}/issues/${prNumber}`, { headers });
    if (prRes.ok) {
        const prData = await prRes.json();
        const existingLabels: string[] = prData.labels?.map((l: any) => l.name) || [];
        const requiredLabels = ["Gssoc 26", "gssoc:approved"];
        
        let labelsToUpdate = [...existingLabels];
        let hasChanges = false;
        
        for (const req of requiredLabels) {
            // Case-insensitive check
            if (!existingLabels.some(l => l.toLowerCase() === req.toLowerCase())) {
                labelsToUpdate.push(req);
                hasChanges = true;
            }
        }

        if (hasChanges) {
            console.log(`  Updating labels to: ${labelsToUpdate.join(", ")}`);
            const labelRes = await fetch(`https://api.github.com/repos/${repo}/issues/${prNumber}/labels`, {
                method: "PUT",
                headers,
                body: JSON.stringify({ labels: labelsToUpdate })
            });
            if (labelRes.ok) {
                console.log(`  ✅ Labels updated.`);
            } else {
                console.warn(`  ⚠️ Failed to update labels:`, await labelRes.text());
            }
        }
    } else {
        console.warn(`  ⚠️ Failed to fetch PR data for label verification:`, await prRes.text());
    }

    // 3. Merge the PR (squash)
    console.log(`  Merging PR #${prNumber}...`);
    const mergeRes = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}/merge`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
            merge_method: "squash",
            commit_title: `Merge pull request #${prNumber} [Squashed]`
        })
    });

    if (mergeRes.ok) {
        console.log(`  🎉 PR #${prNumber} successfully merged!`);
    } else {
        console.error(`  ❌ Failed to merge PR #${prNumber}:`, await mergeRes.text());
    }

    // Small delay to prevent rate limit hit
    await new Promise(r => setTimeout(r, 1000));
}

async function run() {
    console.log(`Starting to merge ${prsToMerge.length} accepted pull requests...\n`);
    for (const pr of prsToMerge) {
        await mergePR(pr);
    }
    console.log("\n🎉 All accepted PRs processed!");
}

run().catch(console.error);
