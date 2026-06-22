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

async function createLabel(name: string, color: string, description: string) {
    const res = await fetch(`https://api.github.com/repos/${repo}/labels`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name, color, description })
    });
    if (res.status === 201) {
        console.log(`Created label: ${name}`);
    } else if (res.status === 422) {
        console.log(`Label "${name}" already exists.`);
    }
}

async function addLabelToIssue(issueNumber: number, newLabel: string) {
    // 1. Fetch current labels
    const getRes = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}`, {
        method: 'GET',
        headers
    });
    if (getRes.status !== 200) {
        console.error(`Failed to fetch issue #${issueNumber}:`, await getRes.text());
        return;
    }
    const issueData = await getRes.json();
    const currentLabels: { name: string }[] = issueData.labels || [];
    const labelNames = currentLabels.map(l => l.name);

    if (labelNames.includes(newLabel)) {
        console.log(`Issue #${issueNumber} already has label: ${newLabel}`);
        return;
    }

    labelNames.push(newLabel);

    // 2. Put updated labels
    const res = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}/labels`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ labels: labelNames })
    });
    if (res.status === 200) {
        console.log(`Successfully added label "${newLabel}" to issue #${issueNumber}`);
    } else {
        console.error(`Failed to update labels for issue #${issueNumber}:`, await res.text());
    }
    await new Promise(r => setTimeout(r, 600));
}

async function run() {
    console.log("Creating needs-visual-proof label...");
    await createLabel("needs-visual-proof", "cfd3d7", "Requires screenshots or recording before and after changes");

    console.log("\nAdding needs-visual-proof tag to affected issues (656, 660, 661)...");
    await addLabelToIssue(656, "needs-visual-proof");
    await addLabelToIssue(660, "needs-visual-proof");
    await addLabelToIssue(661, "needs-visual-proof");

    console.log("\nDone updating labels!");
}

run().catch(console.error);
