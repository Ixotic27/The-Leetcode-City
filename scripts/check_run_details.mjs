import fs from 'fs';
import { execSync } from 'child_process';

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

async function getJobLogs() {
    const runId = '26502828921';
    console.log(`Fetching jobs for run ${runId}...`);
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/runs/${runId}/jobs`, { headers });
    const data = await res.json();
    
    for (const job of data.jobs || []) {
        console.log(`Job: ${job.name} (Status: ${job.status}, Conclusion: ${job.conclusion})`);
        if (job.conclusion === 'action_required' || job.conclusion === 'failure') {
            for (const step of job.steps || []) {
                if (step.conclusion === 'failure' || step.conclusion === 'action_required') {
                    console.log(`\n❌ Step failed/needs action: ${step.name}`);
                }
            }
        }
    }
}

getJobLogs().catch(console.error);
