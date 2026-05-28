import fs from 'fs';

async function main() {
  const env = fs.readFileSync('.env.local', 'utf-8');
  const token = env.split('\n').find(line => line.startsWith('GITHUB_TOKEN='))!.split('=')[1].trim();
  const headers = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.github.v3+json',
  };
  const repo = 'Ixotic27/The-Leetcode-City';

  const runsRes = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=5`, { headers });
  const runs = await runsRes.json();
  
  const targetRun = runs.workflow_runs.find((r: any) => r.name === 'Find Semantic Duplicates' && r.conclusion === 'failure');
  if (!targetRun) {
    console.log("Could not find a failed run of Find Semantic Duplicates");
    return;
  }

  const jobsRes = await fetch(targetRun.jobs_url, { headers });
  const jobs = await jobsRes.json();

  const failedJob = jobs.jobs.find((j: any) => j.conclusion === 'failure');
  if (!failedJob) return;

  const logsRes = await fetch(`https://api.github.com/repos/${repo}/actions/jobs/${failedJob.id}/logs`, { headers });
  const logs = await logsRes.text();

  // Print the last 50 lines of logs
  const logLines = logs.split('\n');
  console.log(logLines.slice(-50).join('\n'));
}

main();
