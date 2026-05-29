import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const token = env.split('\n').find(l => l.startsWith('GITHUB_TOKEN='))?.split('=')[1].trim();
const headers = {
  'Authorization': 'Bearer ' + token,
  'Accept': 'application/vnd.github.v3+json',
  'Content-Type': 'application/json',
};
const repo = 'Ixotic27/The-Leetcode-City';

async function main() {
  console.log("Checking if gssoc:approved exists...");
  let res = await fetch(`https://api.github.com/repos/${repo}/labels/gssoc:approved`, { headers });
  let approvedExists = res.ok;
  
  if (!approvedExists) {
    console.log("gssoc:approved does not exist. Renaming gssoc:verified to gssoc:approved...");
    const patchRes = await fetch(`https://api.github.com/repos/${repo}/labels/gssoc:verified`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ new_name: 'gssoc:approved', color: '0e8a16', description: 'Approved GSSoC contribution' })
    });
    if (patchRes.ok) {
      console.log("Successfully renamed label!");
      return;
    } else {
      console.log("Failed to rename label:", await patchRes.text());
      // Maybe gssoc:verified doesn't exist either?
    }
  }

  // If approved exists (or rename failed), replace manually
  console.log("Replacing labels on issues/PRs...");
  let updatedCount = 0;
  for (let page = 1; page <= 50; page++) {
    const issuesRes = await fetch(`https://api.github.com/repos/${repo}/issues?state=all&labels=gssoc:verified&per_page=100&page=${page}`, { headers });
    const issues = await issuesRes.json();
    if (!issues || !issues.length) break;
    for (const issue of issues) {
      const newLabels = issue.labels.map(l => l.name).filter(n => n !== 'gssoc:verified');
      if (!newLabels.includes('gssoc:approved')) {
        newLabels.push('gssoc:approved');
      }
      await fetch(`https://api.github.com/repos/${repo}/issues/${issue.number}/labels`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ labels: newLabels })
      });
      console.log(`Updated #${issue.number}`);
      updatedCount++;
    }
  }
  console.log(`Updated ${updatedCount} issues/PRs.`);
  
  // Delete gssoc:verified
  console.log("Deleting old gssoc:verified label...");
  await fetch(`https://api.github.com/repos/${repo}/labels/gssoc:verified`, { method: 'DELETE', headers });
  console.log("Done!");
}
main();
