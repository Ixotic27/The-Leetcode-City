import fs from 'fs';

async function main() {
  const env = fs.readFileSync('.env.local', 'utf-8');
  const token = env.split('\n').find(line => line.startsWith('GITHUB_TOKEN='))!.split('=')[1].trim();
  const headers = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.github.v3+json',
  };
  const repo = 'Ixotic27/The-Leetcode-City';

  const res = await fetch(`https://api.github.com/repos/${repo}/issues?state=open&per_page=10`, { headers });
  const issues = await res.json();
  
  for (const issue of issues) {
    if (!issue.pull_request) {
      console.log(`\nIssue #${issue.number}: ${issue.title}`);
      console.log(`Author: @${issue.user.login}`);
      console.log(`Body:\n${issue.body?.substring(0, 300)}...`);
    }
  }
}

main();
