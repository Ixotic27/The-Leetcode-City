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
  const reviews = await request('/repos/Ixotic27/The-Leetcode-City/pulls/175/reviews');
  for (const r of reviews) {
    console.log(`\n\n--- [${r.submitted_at}] @${r.user?.login} (Review: ${r.state}) ---`);
    console.log(r.body);
  }
})();
