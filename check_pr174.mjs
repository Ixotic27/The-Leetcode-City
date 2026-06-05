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
  const pr = await request('/repos/Ixotic27/The-Leetcode-City/pulls/175');
  console.log('PR Head SHA:', pr.head.sha);
  
  const comments = await request('/repos/Ixotic27/The-Leetcode-City/issues/175/comments');
  console.log('\nComments:');
  for (const c of comments) {
    console.log(`[${c.created_at}] @${c.user.login}: ${c.body.substring(0, 50).replace(/\n/g, ' ')}...`);
  }
  
  const statuses = await request(`/repos/Ixotic27/The-Leetcode-City/commits/${pr.head.sha}/status`);
  console.log('\nStatuses for HEAD SHA:');
  for (const s of statuses.statuses || []) {
    console.log(`[${s.updated_at}] ${s.context}: ${s.state}`);
  }
})();
