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

async function deleteLabel(name: string) {
    const res = await fetch(`https://api.github.com/repos/${repo}/labels/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        headers
    });
    if (res.status === 204) {
        console.log(`Deleted label: ${name}`);
    } else {
        console.log(`Label "${name}" could not be deleted (might not exist).`);
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
    console.log("Creating new GSSoC type:feature label...");
    await createLabel("type:feature", "a2eeef", "New feature or request");

    console.log("\nUpdating issues to replace type:enhancement with type:feature...");
    await updateIssueLabels(660, ["gssoc 26", "gssoc:approved", "good first issues", "level:intermediate", "type:feature"]);
    await updateIssueLabels(661, ["gssoc 26", "gssoc:approved", "good first issues", "level:advanced", "type:feature"]);

    console.log("\nDeleting type:enhancement and enhancement from repository...");
    await deleteLabel("type:enhancement");
    await deleteLabel("enhancement");

    console.log("\nDone cleaning up labels!");
}

run().catch(console.error);
