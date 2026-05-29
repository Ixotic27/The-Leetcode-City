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

async function closeIssues() {
    const issuesToClose = [43, 44, 45];
    
    for (const num of issuesToClose) {
        // Close with a comment
        await fetch(`https://api.github.com/repos/${repo}/issues/${num}/comments`, {
            method: 'POST', headers,
            body: JSON.stringify({ body: "Closing this issue — this is a CI/CD automation fix that will be resolved directly by the maintainer, not a contributor task." })
        });
        
        await fetch(`https://api.github.com/repos/${repo}/issues/${num}`, {
            method: 'PATCH', headers,
            body: JSON.stringify({ state: "closed", state_reason: "not_planned" })
        });
        
        console.log(`Closed issue #${num}`);
    }
}

closeIssues().catch(console.error);
