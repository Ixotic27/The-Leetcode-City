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

const mappings = {
    "level: easy": "beginner",
    "level: medium": "intermediate",
    "level: hard": "advanced"
};

async function fixLabels() {
    console.log("Fetching open issues...");
    const res = await fetch(`https://api.github.com/repos/${repo}/issues?state=open&per_page=100`, { headers });
    const issues = await res.json();
    
    let updatedCount = 0;
    
    for (const issue of issues) {
        // Skip PRs
        if (issue.pull_request) continue;
        
        let needsUpdate = false;
        const currentLabels = issue.labels.map(l => l.name);
        const newLabels = [];
        
        for (const label of currentLabels) {
            if (mappings[label]) {
                newLabels.push(mappings[label]);
                needsUpdate = true;
            } else {
                newLabels.push(label);
            }
        }
        
        if (needsUpdate) {
            console.log(`Updating issue #${issue.number} ("${issue.title}")...`);
            console.log(`  Old labels: ${currentLabels.join(', ')}`);
            console.log(`  New labels: ${newLabels.join(', ')}`);
            
            await fetch(`https://api.github.com/repos/${repo}/issues/${issue.number}/labels`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ labels: newLabels })
            });
            updatedCount++;
            
            // Small delay
            await new Promise(r => setTimeout(r, 500));
        }
    }
    
    console.log(`Done! Updated labels on ${updatedCount} issues.`);
}

fixLabels().catch(console.error);
