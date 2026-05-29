import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const token = env.split('\n').find(l => l.startsWith('GITHUB_TOKEN='))!.split('=')[1].trim();
const headers = {
  'Authorization': 'Bearer ' + token,
  'Accept': 'application/vnd.github.v3+json',
  'Content-Type': 'application/json',
};
const repo = 'Ixotic27/The-Leetcode-City';

// Required labels that MUST be on every open issue/PR
const REQUIRED_GSSOC_LABELS = ['Gssoc 26', 'gssoc:approved'];
const DIFFICULTY_LABELS = ['beginner', 'intermediate', 'advanced', 'level:beginner', 'level:intermediate', 'level:advanced', 'level:critical'];
const DEFAULT_DIFFICULTY = 'beginner';
const GOOD_FIRST_ISSUE = 'good first issue';

async function ensureLabelExists(name: string, color: string, description: string) {
  const res = await fetch(`https://api.github.com/repos/${repo}/labels/${encodeURIComponent(name)}`, { headers });
  if (res.status === 404) {
    console.log(`  Creating label: ${name}`);
    await fetch(`https://api.github.com/repos/${repo}/labels`, {
      method: 'POST', headers,
      body: JSON.stringify({ name, color, description }),
    });
  }
}

async function addLabels(issueNumber: number, labels: string[]) {
  if (labels.length === 0) return;
  const res = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}/labels`, {
    method: 'POST', headers,
    body: JSON.stringify({ labels }),
  });
  if (res.ok) {
    console.log(`  ✅ #${issueNumber}: Added [${labels.join(', ')}]`);
  } else {
    console.log(`  ❌ #${issueNumber}: Failed to add labels: ${await res.text()}`);
  }
}

async function main() {
  // Step 1: Ensure gssoc:approved label exists
  await ensureLabelExists('gssoc:approved', '0e8a16', 'Approved GSSoC contribution');
  await ensureLabelExists('good first issue', '7057ff', 'Good for newcomers');

  // Step 2: Fetch all open issues + PRs
  const allIssues: any[] = [];
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/issues?state=open&per_page=100&page=${page}`,
      { headers }
    );
    const data = await res.json();
    if (!data.length) break;
    allIssues.push(...data);
  }

  console.log(`\nFound ${allIssues.length} open issues/PRs. Checking labels...\n`);

  let fixedCount = 0;

  for (const issue of allIssues) {
    const number = issue.number;
    const labels: string[] = issue.labels.map((l: any) => l.name);
    const isPR = !!issue.pull_request;
    const type = isPR ? 'PR' : 'ISSUE';
    const missingLabels: string[] = [];

    // Check for required GSSoC labels
    for (const required of REQUIRED_GSSOC_LABELS) {
      if (!labels.includes(required)) {
        missingLabels.push(required);
      }
    }

    // Check for good first issue
    if (!labels.includes(GOOD_FIRST_ISSUE)) {
      missingLabels.push(GOOD_FIRST_ISSUE);
    }

    // Check for at least one difficulty label
    const hasDifficulty = labels.some(l => DIFFICULTY_LABELS.includes(l));
    if (!hasDifficulty) {
      missingLabels.push(DEFAULT_DIFFICULTY);
    }

    if (missingLabels.length > 0) {
      console.log(`#${number} (${type}): Missing [${missingLabels.join(', ')}]`);
      await addLabels(number, missingLabels);
      fixedCount++;
    } else {
      console.log(`#${number} (${type}): ✅ All required labels present`);
    }
  }

  console.log(`\n🎉 Done! Fixed ${fixedCount} out of ${allIssues.length} issues/PRs.`);
}

main();
