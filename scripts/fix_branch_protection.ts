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

  // Update branch protection to only require checks that actually exist
  console.log("Updating branch protection required checks...");
  const res = await fetch(`https://api.github.com/repos/${repo}/branches/main/protection/required_status_checks`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      strict: true,
      contexts: ['security-checks']
    }),
  });
  
  if (res.ok) {
    console.log("✅ Updated! Now only 'security-checks' is required.");
    console.log("'enforce-branch' and 'review' removed — their workflows still run");
    console.log("and auto-close bad PRs, but they no longer block merging for valid PRs.");
  } else {
    const err = await res.text();
    console.log(`❌ Failed: ${res.status} ${err}`);
  }
}

main();
