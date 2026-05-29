import fs from 'fs';

async function main() {
  const env = fs.readFileSync('.env.local', 'utf-8');
  const token = env.split('\n').find(line => line.startsWith('GITHUB_TOKEN='))!.split('=')[1].trim();
  const headers = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.github.v3+json',
  };
  const repo = 'Ixotic27/The-Leetcode-City';

  // 1. Get PR diff to see what triggered the secret scan
  const diffRes = await fetch(`https://api.github.com/repos/${repo}/pulls/83`, {
    headers: { ...headers, 'Accept': 'application/vnd.github.v3.diff' },
  });
  const diff = await diffRes.text();
  
  const addedLines = diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++'));
  const secretRegex = /SUPABASE_SERVICE_ROLE|SECRET|PASSWORD|PRIVATE_KEY/;
  const flagged = addedLines.filter(l => secretRegex.test(l));
  console.log("Lines flagged by secret scan:");
  flagged.forEach(l => console.log(`  ${l}`));

  // 2. Check what the "enforce-branch" and "review" required checks are
  const checksRes = await fetch(`https://api.github.com/repos/${repo}/branches/main/protection`, { headers });
  const protection = await checksRes.json();
  console.log("\nBranch protection required checks:");
  console.log(JSON.stringify(protection?.required_status_checks?.contexts, null, 2));

  // 3. Check all status checks on PR #83
  const prRes = await fetch(`https://api.github.com/repos/${repo}/pulls/83`, { headers });
  const pr = await prRes.json();
  const statusRes = await fetch(`https://api.github.com/repos/${repo}/commits/${pr.head.sha}/status`, { headers });
  const status = await statusRes.json();
  console.log("\nCommit statuses:");
  status.statuses?.forEach((s: any) => console.log(`  ${s.context}: ${s.state}`));

  const checksRunRes = await fetch(`https://api.github.com/repos/${repo}/commits/${pr.head.sha}/check-runs?per_page=20`, { headers });
  const checkRuns = await checksRunRes.json();
  console.log("\nCheck runs:");
  checkRuns.check_runs?.forEach((c: any) => console.log(`  ${c.name}: ${c.status} / ${c.conclusion}`));
}

main();
