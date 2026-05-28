import fs from 'fs';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function main() {
  const env = fs.readFileSync('.env.local', 'utf-8');
  const token = env.split('\n').find(line => line.startsWith('GITHUB_TOKEN='))!.split('=')[1].trim();
  const headers = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
  const repo = 'Ixotic27/The-Leetcode-City';

  console.log('Triggering Find Semantic Duplicates workflow...');
  const triggerRes = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/find-duplicates.yml/dispatches`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ref: 'main' }),
  });

  if (!triggerRes.ok) {
    console.log('Failed to trigger workflow:', await triggerRes.text());
    return;
  }

  console.log('Workflow triggered successfully. Waiting for it to start...');
  await delay(5000);

  // Fetch the latest run
  const runsRes = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=1`, { headers });
  const runs = await runsRes.json();
  const run = runs.workflow_runs[0];
  
  if (!run || run.name !== 'Find Semantic Duplicates') {
    console.log('Could not find the triggered run.');
    return;
  }
  
  console.log(`Tracking run #${run.id}...`);

  let status = run.status;
  while (status === 'in_progress' || status === 'queued') {
    await delay(3000);
    const rRes = await fetch(`https://api.github.com/repos/${repo}/actions/runs/${run.id}`, { headers });
    const r = await rRes.json();
    status = r.status;
    if (status === 'completed') {
      console.log(`Run completed with conclusion: ${r.conclusion}`);
      
      const jobsRes = await fetch(r.jobs_url, { headers });
      const jobs = await jobsRes.json();
      const job = jobs.jobs[0];
      if (job) {
        const logsRes = await fetch(`https://api.github.com/repos/${repo}/actions/jobs/${job.id}/logs`, { headers });
        const logs = await logsRes.text();
        const logLines = logs.split('\n').slice(-50).join('\n');
        console.log(`\n--- Logs ---\n${logLines}`);
      }
      break;
    }
  }
}

main();
