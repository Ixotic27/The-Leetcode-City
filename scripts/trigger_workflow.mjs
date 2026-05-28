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

async function triggerWorkflow() {
    console.log("Triggering Publish Docker Package workflow...");
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/publish-package.yml/dispatches`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ref: "main" })
    });
    
    if (!res.ok) {
        console.error("Failed to trigger workflow:", await res.text());
    } else {
        console.log("Successfully triggered a new workflow run with the latest code fixes!");
    }
}

triggerWorkflow().catch(console.error);
