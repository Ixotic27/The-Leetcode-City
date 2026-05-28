import fs from 'fs';

async function main() {
  const env = fs.readFileSync('.env.local', 'utf-8');
  const token = env.split('\n').find(line => line.startsWith('GITHUB_TOKEN='))!.split('=')[1].trim();
  const headers = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.github.v3+json',
  };
  const repo = 'Ixotic27/The-Leetcode-City';

  const pullsRes = await fetch(`https://api.github.com/repos/${repo}/pulls?state=open&per_page=10`, { headers });
  const pulls = await pullsRes.json();
  
  console.log("Open PRs:");
  pulls.forEach((pr: any) => {
    console.log(`- PR #${pr.number}: ${pr.title} (by @${pr.user.login})`);
  });
}

main();
