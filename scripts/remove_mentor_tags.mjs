import fs from 'fs';

const repo = "Ixotic27/The-Leetcode-City";
const token = fs.readFileSync(".env.local", "utf-8")
    .split("\n")
    .find(line => line.startsWith("GITHUB_TOKEN="))
    ?.split("=")[1]?.trim();

const headers = {
    "Accept": "application/vnd.github.v3+json",
    "Authorization": `token ${token}`,
    "User-Agent": "Node-Script"
};

async function removeMentorTags() {
    console.log("Fetching all issues to remove 'mentor:Ixotic27' tag...");
    
    // Fetch issues with the label
    const res = await fetch(`https://api.github.com/repos/${repo}/issues?labels=mentor:Ixotic27&state=all&per_page=100`, { headers });
    const issues = await res.json();
    
    if (!issues || issues.length === 0) {
        console.log("No issues found with the 'mentor:Ixotic27' tag.");
        return;
    }
    
    console.log(`Found ${issues.length} issues with the tag. Removing them...`);
    
    for (const issue of issues) {
        // We use the DELETE endpoint for labels
        const deleteRes = await fetch(`https://api.github.com/repos/${repo}/issues/${issue.number}/labels/mentor:Ixotic27`, {
            method: 'DELETE',
            headers
        });
        
        if (!deleteRes.ok) {
            console.error(`Failed to remove tag from issue #${issue.number}:`, await deleteRes.text());
        } else {
            console.log(`Successfully removed tag from issue #${issue.number}`);
        }
    }
    
    console.log("Finished removing tags!");
}

removeMentorTags().catch(console.error);
