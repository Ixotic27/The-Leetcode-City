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

  // Get ALL check runs for the PR's head SHA
  const prRes = await fetch(`https://api.github.com/repos/${repo}/pulls/83`, { headers });
  const pr = await prRes.json();
  
  const checksRes = await fetch(`https://api.github.com/repos/${repo}/commits/${pr.head.sha}/check-runs?per_page=50`, { headers });
  const checks = await checksRes.json();
  
  console.log("All check runs on PR #83:");
  checks.check_runs.forEach((c: any) => {
    console.log(`  "${c.name}" (app: ${c.app?.slug}) — ${c.status} / ${c.conclusion}`);
  });
  
  // Get branch protection
  const bpRes = await fetch(`https://api.github.com/repos/${repo}/branches/main/protection`, { headers });
  const bp = await bpRes.json();
  console.log("\nRequired status checks:");
  console.log(JSON.stringify(bp.required_status_checks, null, 2));
}

main();
