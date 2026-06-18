import { readFileSync } from 'fs';
import https from 'https';

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

function colorStatus(status, conclusion) {
  if (conclusion === 'success') return `${GREEN}✔ success${RESET}`;
  if (conclusion === 'failure') return `${RED}✖ failure${RESET}`;
  if (conclusion === 'cancelled') return `${YELLOW}⊘ cancelled${RESET}`;
  if (status === 'in_progress') return `${CYAN}⟳ in_progress${RESET}`;
  return `${DIM}${status}/${conclusion}${RESET}`;
}

function calcDuration(start, end) {
  if (!start || !end) return 'N/A';
  const ms = new Date(end) - new Date(start);
  const s = Math.floor(ms / 1000);
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
      // Rate limit info
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

async function fetchAllRuns(workflow, maxPages = 3) {
  let page = 1;
  let allRuns = [];
  while (page <= maxPages) {
    const { body } = await request(
      `/repos/Ixotic27/The-Leetcode-City/actions/workflows/${workflow}/runs?per_page=10&page=${page}`
    );
    const runs = body.workflow_runs || [];
    if (runs.length === 0) break;
    allRuns = allRuns.concat(runs);
    page++;
  }
  return allRuns;
}

async function fetchPRForSHA(sha) {
  try {
    const { body } = await request(
      `/repos/Ixotic27/The-Leetcode-City/commits/${sha}/pulls`
    );
    if (Array.isArray(body) && body.length > 0) {
      return `#${body[0].number} (${body[0].title})`;
    }
  } catch (_) {}
  return null;
}

async function exportCSV(runs) {
  const lines = ['ID,Status,Conclusion,Branch,Duration,SHA,Message,Created At'];
  for (const r of runs) {
    const duration = calcDuration(r.created_at, r.updated_at);
    const msg = (r.head_commit?.message || '').replace(/,/g, ';').replace(/\n/g, ' ');
    lines.push(`${r.id},${r.status},${r.conclusion},${r.head_branch},${duration},${r.head_sha},${msg},${r.created_at}`);
  }
  const { writeFileSync } = await import('fs');
  writeFileSync('workflow_runs.csv', lines.join('\n'));
  console.log(`${GREEN}CSV exported → workflow_runs.csv${RESET}\n`);
}

(async () => {
  const args = process.argv.slice(2);
  const filterStatus = args.find(a => a.startsWith('--status='))?.split('=')[1];
  const filterBranch = args.find(a => a.startsWith('--branch='))?.split('=')[1];
  const doExport   = args.includes('--export');
  const showPR     = args.includes('--pr');

  console.log(`${BOLD}${CYAN}═══ Auto Review & Approve — Workflow Runs ═══${RESET}\n`);

  const runs = await fetchAllRuns('auto-review-approve.yml', 3);

  let filtered = runs;
  if (filterStatus) {
    filtered = filtered.filter(r => r.conclusion === filterStatus || r.status === filterStatus);
    console.log(`${YELLOW}Filter: conclusion/status = "${filterStatus}"${RESET}\n`);
  }
  if (filterBranch) {
    filtered = filtered.filter(r => r.head_branch === filterBranch);
    console.log(`${YELLOW}Filter: branch = "${filterBranch}"${RESET}\n`);
  }

  if (filtered.length === 0) {
    console.log(`${RED}No runs match filters.${RESET}`);
    return;
  }

  for (const r of filtered) {
    const duration = calcDuration(r.created_at, r.updated_at);
    const status   = colorStatus(r.status, r.conclusion);
    const msg      = r.head_commit?.message?.split('\n')[0] || '—';
    const branch   = `${CYAN}${r.head_branch || 'unknown'}${RESET}`;

    console.log(`${BOLD}Run ID:${RESET}  ${r.id}`);
    console.log(`${BOLD}Status:${RESET}  ${status}`);
    console.log(`${BOLD}Branch:${RESET}  ${branch}`);
    console.log(`${BOLD}Duration:${RESET} ${duration}`);
    console.log(`${BOLD}SHA:${RESET}     ${r.head_sha}`);
    console.log(`${BOLD}Message:${RESET} ${msg}`);
    console.log(`${BOLD}Created:${RESET} ${r.created_at}`);

    if (showPR) {
      const pr = await fetchPRForSHA(r.head_sha);
      console.log(`${BOLD}PR:${RESET}      ${pr || 'No PR linked'}`);
    }

    console.log(`${DIM}${'─'.repeat(55)}${RESET}`);
  }

  console.log(`\n${BOLD}Total runs shown: ${filtered.length}${RESET}`);

  if (doExport) await exportCSV(filtered);
})();