import fs from 'fs';

async function main() {
  const env = fs.readFileSync('.env.local', 'utf-8');
  const token = env.split('\n').find(line => line.startsWith('GITHUB_TOKEN='))!.split('=')[1].trim();
  const headers = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.github.v3+json',
  };
  const repo = 'Ixotic27/The-Leetcode-City';

  const prRes = await fetch(`https://api.github.com/repos/${repo}/pulls/95`, { headers });
  const pr = await prRes.json();
  
  console.log(`PR #${pr.number}: ${pr.title}`);
  console.log(`Author: @${pr.user?.login}`);
  console.log(`Body:\n${pr.body}`);
}

main();
