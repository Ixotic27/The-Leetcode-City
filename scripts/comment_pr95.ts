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
  const prNum = 95;

  const commentBody = `Thanks for this PR! However, there is a critical security issue with the current implementation.

By creating a new \`link-leetcode\` API route that performs "simple manual linking", this PR allows any logged-in user to type in *any* LeetCode username and instantly claim it. This completely bypasses our existing account verification system, allowing malicious users to steal other people's buildings and stats.

We already have a secure verification system implemented in \`src/app/api/verify-leetcode/route.ts\`. That route requires users to place a unique, randomly generated token (like \`LCC-XXXX\`) in their LeetCode "About Me" section, and verifies its presence via the LeetCode API to prove ownership of the account.

**To fix this PR:**
1. Please **do not** create a new \`link-leetcode\` route that bypasses verification.
2. Instead, update your new Settings UI to integrate with the existing \`verify-leetcode\` endpoint. 
3. The Settings page should display the user's expected token (which they can get from the backend or generate locally since it's just \`"LCC-" + user.id.split("-")[0].toUpperCase()\`), instruct them to add it to their LeetCode profile, and *then* call \`/api/verify-leetcode\` when they click the Link button.
4. If you need to store the explicit \`lc_username\` in a new column on the \`developers\` table (as you did in your migration), simply add that column update directly into the successful completion block of the existing \`verify-leetcode\` route.

Please update the PR to use the secure verification flow!`;

  const res = await fetch(`https://api.github.com/repos/${repo}/issues/${prNum}/comments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ body: commentBody }),
  });
  
  if (res.ok) {
    const data = await res.json();
    console.log(`Successfully commented on PR #${prNum}: ${data.html_url}`);
  } else {
    console.log(`Failed to comment: ${res.statusText}`);
    const err = await res.text();
    console.log(err);
  }
}

main();
