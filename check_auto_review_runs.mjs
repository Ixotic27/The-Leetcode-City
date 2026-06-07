import { readFileSync } from 'fs';
import https from 'https';

function request(path) {
  return new Promise((resolve, reject) => {
    https.get({
      hostname: 'api.github.com',
      path,
      headers: { 'User-Agent': 'Node.js', 'Accept': 'application/vnd.github.v3+json' }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

(async () => {
  const runs = await request('/repos/Ixotic27/The-Leetcode-City/actions/workflows/auto-review-approve.yml/runs?per_page=10');
  console.log('Auto Review & Approve Runs:');
  for (const r of runs.workflow_runs || []) {
    console.log(`[${r.created_at}] ID: ${r.id} - ${r.status}/${r.conclusion} - SHA: ${r.head_sha} - Message: ${r.head_commit?.message}`);
  }
})();
