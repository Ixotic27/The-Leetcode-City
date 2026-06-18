import https from 'https';

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

function colorConclusion(status, conclusion) {
  if (conclusion === 'success') return `${GREEN}✔ success${RESET}`;
  if (conclusion === 'failure') return `${RED}✖ failure${RESET}`;
  if (conclusion === 'cancelled') return `${YELLOW}⊘ cancelled${RESET}`;
  if (status === 'in_progress') return `${CYAN}⟳ in_progress${RESET}`;
  return `${DIM}${status}/${conclusion}${RESET}`;
}

function calcDuration(start, end) {
  if (!start || !end) return 'N/A';
  const s = Math.floor((new Date(end) - new Date(start)) / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

function request(path) {
  return new Promise((resolve, reject) => {
    const req = https.get({
      hostname: 'api.github.com',
      path,
      headers: {
        'User-Agent': 'Node.js',
        'Accept': 'application/vnd.github.v3+json'
      }
    }, (res) => {
      let data = '';
      const remaining = res.headers['x-ratelimit-remaining'];
      const resetAt = res.headers['x-ratelimit-reset'];
      if (remaining !== undefined) {
        const resetTime = new Date(parseInt(resetAt) * 1000).toLocaleTimeString();
        console.log(`${DIM}[Rate Limit] Remaining: ${remaining} | Resets at: ${resetTime}${RESET}\n`);
      }
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ body: JSON.parse(data), headers: res.headers }); }
        catch (e) { reject(new Error('JSON parse failed: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', reject);
  });
}

async function fetchAllRuns(maxPages = 3) {
  let page = 1;
  let allRuns = [];
  while (page <= maxPages) {
    const { body } = await request(
      `/repos/Ixotic27/The-Leetcode-City/actions/runs?per_page=15&page=${page}`
    );
    const runs = body.workflow_runs || [];
    if (runs.length === 0) break;
    allRuns = allRuns.concat(runs);
    page++;
  }
  return allRuns;
}

async function exportCSV(runs) {
  const lines = ['ID,Name,Event,Status,Conclusion,Branch,Duration,SHA,Created At'];
  for (const r of runs) {
    const duration = calcDuration(r.created_at, r.updated_at);
    lines.push(`${r.id},${r.name},${r.event},${r.status},${r.conclusion},${r.head_branch},${duration},${r.head_sha},${r.created_at}`);
  }
  const { writeFileSync } = await import('fs');
  writeFileSync('ci_pipeline_runs.csv', lines.join('\n'));
  console.log(`${GREEN}CSV exported → ci_pipeline_runs.csv${RESET}\n`);
}

(async () => {
  const args = process.argv.slice(2);
  const filterStatus     = args.find(a => a.startsWith('--status='))?.split('=')[1];
  const filterBranch     = args.find(a => a.startsWith('--branch='))?.split('=')[1];
  const filterWorkflow   = args.find(a => a.startsWith('--workflow='))?.split('=')[1] || 'CI Pipeline';
  const doExport         = args.includes('--export');

  console.log(`${BOLD}${CYAN}═══ Workflow Runs: ${filterWorkflow} ═══${RESET}\n`);

  const allRuns = await fetchAllRuns(3);
  let filtered = allRuns.filter(r => r.name === filterWorkflow);

  if (filterStatus) {
    filtered = filtered.filter(r => r.conclusion === filterStatus || r.status === filterStatus);
    console.log(`${YELLOW}Filter: status = "${filterStatus}"${RESET}\n`);
  }
  if (filterBranch) {
    filtered = filtered.filter(r => r.head_branch === filterBranch);
    console.log(`${YELLOW}Filter: branch = "${filterBranch}"${RESET}\n`);
  }

  if (filtered.length === 0) {
    console.log(`${RED}No runs found for workflow: "${filterWorkflow}"${RESET}`);
    return;
  }

  for (const r of filtered) {
    const duration = calcDuration(r.created_at, r.updated_at);
    console.log(`${BOLD}Run ID:${RESET}   ${r.id}`);
    console.log(`${BOLD}Name:${RESET}     ${r.name}`);
    console.log(`${BOLD}Event:${RESET}    ${r.event}`);
    console.log(`${BOLD}Status:${RESET}   ${colorConclusion(r.status, r.conclusion)}`);
    console.log(`${BOLD}Branch:${RESET}   ${CYAN}${r.head_branch || 'unknown'}${RESET}`);
    console.log(`${BOLD}Duration:${RESET} ${duration}`);
    console.log(`${BOLD}SHA:${RESET}      ${r.head_sha}`);
    console.log(`${BOLD}Created:${RESET}  ${r.created_at}`);
    console.log(`${DIM}${'─'.repeat(55)}${RESET}`);
  }

  console.log(`\n${BOLD}Total runs shown: ${filtered.length}${RESET}`);
  if (doExport) await exportCSV(filtered);
})();