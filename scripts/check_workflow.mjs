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

async function checkAllRuns() {
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=10`, { headers });
    const data = await res.json();
    
    for (const run of data.workflow_runs) {
        console.log(`[${run.name}] status=${run.status} conclusion=${run.conclusion} event=${run.event} created=${run.created_at}`);
        
        if (run.name === "Publish Docker Package" && run.conclusion === 'failure') {
            const jobsRes = await fetch(run.jobs_url, { headers });
            const jobsData = await jobsRes.json();
            const failedJob = jobsData.jobs.find(j => j.conclusion === 'failure');
            
            if (failedJob) {
                console.log(`  Failed step: ${failedJob.steps.find(s => s.conclusion === 'failure')?.name}`);
                const logRes = await fetch(`https://api.github.com/repos/${repo}/actions/jobs/${failedJob.id}/logs`, { headers });
                const logs = await logRes.text();
                const lines = logs.split('\n');
                // Find error lines
                const errorLines = lines.filter(l => l.toLowerCase().includes('error') || l.includes('##[error]'));
                console.log("  Errors found:");
                errorLines.forEach(l => console.log("  " + l.trim()));
            }
        }
    }
}

checkAllRuns().catch(console.error);
