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

async function earnQuickdraw() {
    console.log("Opening a dummy issue for Quickdraw achievement...");
    const createRes = await fetch(`https://api.github.com/repos/${repo}/issues`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
            title: "Quickdraw Achievement Dummy Issue", 
            body: "This issue will be closed instantly to earn the Quickdraw badge." 
        })
    });
    
    if (!createRes.ok) throw new Error("Failed to create");
    const issue = await createRes.json();
    console.log(`Created issue #${issue.number}`);

    // Wait 2 seconds
    await new Promise(r => setTimeout(r, 2000));

    console.log(`Closing issue #${issue.number} instantly...`);
    await fetch(`https://api.github.com/repos/${repo}/issues/${issue.number}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ state: "closed" })
    });
    
    console.log("Done! You should receive the Quickdraw achievement shortly.");
}

earnQuickdraw().catch(console.error);
