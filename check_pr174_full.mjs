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
  const comments = await request('/repos/Ixotic27/The-Leetcode-City/issues/174/comments');
  for (const c of comments) {
    console.log(`\n\n--- [${c.created_at}] @${c.user.login} ---`);
    console.log(c.body);
  }
})();
