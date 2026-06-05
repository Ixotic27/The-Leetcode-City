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
  const checks = await request('/repos/Ixotic27/The-Leetcode-City/commits/82847b847ae5771b92921b843907775f157ea635/check-runs');
  console.log('Check Runs for PR 175:');
  for (const c of checks.check_runs || []) {
    console.log(`- ${c.name}: ${c.status}/${c.conclusion}`);
  }
})();
