import fs from 'fs';

async function main() {
  const env = fs.readFileSync('.env.local', 'utf-8');
  const token = env.split('\n').find(line => line.startsWith('GITHUB_TOKEN='))!.split('=')[1].trim();
  const headers = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
  const repo = 'Ixotic27/The-Leetcode-City';
  const spamIssues = [98, 97, 96, 86];

  for (const issueNum of spamIssues) {
    console.log(`Closing spam issue #${issueNum}...`);
    
    // 1. Post comment
    const commentBody = `Closing this issue as it appears to be AI-generated spam or extremely pedantic nitpicks rather than a genuine bug (e.g., complaining about standard IP extraction methods or using \`60_000\` for milliseconds). Please refrain from opening low-quality or automated issues just to farm contributions.`;
    await fetch(`https://api.github.com/repos/${repo}/issues/${issueNum}/comments`, {
      method: 'POST', headers,
      body: JSON.stringify({ body: commentBody })
    });

    // 2. Add 'invalid' label
    await fetch(`https://api.github.com/repos/${repo}/issues/${issueNum}/labels`, {
      method: 'POST', headers,
      body: JSON.stringify({ labels: ['invalid'] })
    });

    // 3. Close the issue
    const res = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNum}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ state: 'closed', state_reason: 'not_planned' })
    });

    if (res.ok) {
      console.log(`✅ Successfully closed issue #${issueNum}`);
    } else {
      console.log(`❌ Failed to close #${issueNum}`);
    }
  }
}

main();
