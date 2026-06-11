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
  const runs = await request('/repos/Ixotic27/The-Leetcode-City/actions/runs?per_page=15');
  console.log('Recent Workflow Runs:');
  for (const r of runs.workflow_runs || []) {
    if (r.name === 'CI Pipeline') {
      console.log(`[${r.created_at}] ${r.name} (${r.event}) - ${r.status}/${r.conclusion} - SHA: ${r.head_sha}`);
    }
  }
})();
