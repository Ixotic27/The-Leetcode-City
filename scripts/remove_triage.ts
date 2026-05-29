import fs from 'fs';

async function main() {
  const env = fs.readFileSync('.env.local', 'utf-8');
  const token = env.split('\n').find(line => line.startsWith('GITHUB_TOKEN='))!.split('=')[1].trim();
  const headers = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.github.v3+json',
  };
  const repo = 'Ixotic27/The-Leetcode-City';
  const targetIssues = [92, 93];

  for (const issueNum of targetIssues) {
    console.log(`Removing 'needs-triage' from issue #${issueNum}...`);
    const res = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNum}/labels/needs-triage`, {
      method: 'DELETE', headers
    });
    if (res.ok) {
      console.log(`✅ Removed from PR/Issue #${issueNum}`);
    } else {
      console.log(`❌ Failed to remove from #${issueNum}: ${res.statusText}`);
    }
  }
}

main();
