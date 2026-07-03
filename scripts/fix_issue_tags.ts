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

async function updateIssueLabels(issueNumber: number, labels: string[]) {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}/labels`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ labels })
    });
    if (res.status === 200) {
        console.log(`Successfully updated labels for issue #${issueNumber} to:`, labels);
    } else {
        console.error(`Failed to update labels for issue #${issueNumber}:`, await res.text());
    }
}

async function run() {
    console.log("Creating missing tags/labels...");
    await createLabel("gssoc 26", "170100", "GSSoC 2026");
    await createLabel("gssoc:approved", "9313a8", "Approved for GSSoC");
    await createLabel("good first issue", "7057ff", "Good for newcomers");
    await createLabel("level:beginner", "0e8a16", "Beginner level task");
    await createLabel("level:intermediate", "fbca04", "Intermediate level task");
    await createLabel("level:advanced", "b60205", "Advanced level task");
    await createLabel("type:bug", "d73a4a", "Bug issue");
    await createLabel("type:security", "e6e600", "Security issue");

    console.log("\nUpdating issue labels on GitHub...");
    // Update the 4 issues we just created (656, 657, 658, 659)
    await updateIssueLabels(656, ["gssoc 26", "gssoc:approved", "good first issue", "level:intermediate", "type:bug"]);
    await updateIssueLabels(657, ["gssoc 26", "gssoc:approved", "good first issue", "level:intermediate", "type:security"]);
    await updateIssueLabels(658, ["gssoc 26", "gssoc:approved", "good first issue", "level:intermediate", "type:security"]);
    await updateIssueLabels(659, ["gssoc 26", "gssoc:approved", "good first issue", "level:intermediate", "type:bug"]);

    console.log("\nDone updating labels!");
}

run().catch(console.error);
