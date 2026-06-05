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
  const jobs = await request('/repos/Ixotic27/The-Leetcode-City/actions/runs/26714356299/jobs');
  console.log('Jobs for Run 26714356299:');
  for (const j of jobs.jobs || []) {
    console.log(`- ${j.name}: ${j.status}/${j.conclusion}`);
    for (const step of j.steps) {
      if (step.conclusion === 'failure') {
        console.log(`  FAILED STEP: ${step.name}`);
      }
    }
  }
})();
