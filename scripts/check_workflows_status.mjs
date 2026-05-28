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

async function checkWorkflows() {
    console.log("Fetching recent workflow runs...");
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=15`, { headers });
    const data = await res.json();
    
    if (!data.workflow_runs) {
        console.error("Failed to fetch workflows:", data);
        return;
    }
    
    console.log(`\n--- RECENT WORKFLOW RUNS ---`);
    for (const run of data.workflow_runs) {
        const symbol = run.conclusion === 'success' ? '✅' : 
                       run.conclusion === 'failure' ? '❌' : 
                       run.conclusion === 'cancelled' ? '🚫' : 
                       run.status === 'in_progress' ? '🔄' : '❓';
                       
        console.log(`${symbol} [${run.name}] - ${run.head_commit.message.split('\n')[0]}`);
        console.log(`   Status: ${run.status} | Conclusion: ${run.conclusion || 'N/A'}`);
        console.log(`   URL: ${run.html_url}\n`);
    }
}

checkWorkflows().catch(console.error);
