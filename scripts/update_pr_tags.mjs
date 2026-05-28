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

async function updateExistingPRs() {
    const res = await fetch(`https://api.github.com/repos/${repo}/pulls?state=open&per_page=100`, { headers });
    const prs = await res.json();
    
    console.log(`Found ${prs.length} open PRs. Checking for tags from linked issues...`);
    
    for (const pr of prs) {
        let labelsToAdd = new Set();
        
        // 1. Branch name
        const branchMatch = pr.head.ref.match(/^(\d+)-/);
        if (branchMatch) {
            const issueNumber = parseInt(branchMatch[1]);
            try {
                const issueRes = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}`, { headers });
                if (issueRes.ok) {
                    const issue = await issueRes.json();
                    issue.labels.forEach(l => labelsToAdd.add(l.name));
                }
            } catch (e) {}
        }
        
        // 2. PR Body
        const body = pr.body || "";
        const issueRegex = /(?:fix|fixes|fixed|close|closes|closed|resolve|resolves|resolved)\s+#(\d+)/gi;
        let match;
        while ((match = issueRegex.exec(body)) !== null) {
            const issueNumber = parseInt(match[1]);
            try {
                const issueRes = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}`, { headers });
                if (issueRes.ok) {
                    const issue = await issueRes.json();
                    issue.labels.forEach(l => labelsToAdd.add(l.name));
                }
            } catch (e) {}
        }
        
        // Collect existing PR labels
        const existingLabels = pr.labels.map(l => l.name);
        
        // Check if there are actually any *new* labels to add
        let hasNewLabels = false;
        for (const l of Array.from(labelsToAdd)) {
            if (!existingLabels.includes(l)) {
                hasNewLabels = true;
                break;
            }
        }
        
        if (hasNewLabels) {
            for (const el of existingLabels) labelsToAdd.add(el); // Merge existing
            
            const newLabels = Array.from(labelsToAdd);
            console.log(`Updating PR #${pr.number} ("${pr.title}") with new labels: ${newLabels.join(', ')}`);
            
            await fetch(`https://api.github.com/repos/${repo}/issues/${pr.number}/labels`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ labels: newLabels })
            });
        }
        
        // Small delay
        await new Promise(r => setTimeout(r, 500));
    }
    
    console.log("Done updating PRs!");
}

updateExistingPRs().catch(console.error);
