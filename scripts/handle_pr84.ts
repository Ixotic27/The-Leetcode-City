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
  const prNum = 84;

  const prRes = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNum}`, { headers });
  const pr = await prRes.json();
  console.log(`PR #${prNum}: ${pr.title}`);
  
  // 1. Create labels if they don't exist
  for (const label of ['frontend', 'backend']) {
    try {
      await fetch(`https://api.github.com/repos/${repo}/labels`, {
        method: 'POST', headers,
        body: JSON.stringify({ name: label, color: '1d76db' }),
      });
    } catch {}
  }

  // 2. Add labels to PR
  await fetch(`https://api.github.com/repos/${repo}/issues/${prNum}/labels`, {
    method: 'POST', headers,
    body: JSON.stringify({ labels: ['frontend', 'backend'] }),
  });
  console.log("✅ Added frontend and backend labels to PR #84.");

  // 3. Post comment
  const author = pr.user.login;
  const message = `Hi @${author}, thanks for your PR!\n\nI noticed from your screenshot that the 3D buildings are missing from the city view. This happens when the frontend is running without the backend data (or without the proper Supabase service role key to fetch the profiles).\n\nIf you're using AI to generate these changes, please ensure you are actually testing the UI with data loaded. We cannot merge visual features (like explosion particles) if we cannot see how they interact with the actual buildings.\n\nTo get the backend running locally with full API access so you can test this properly, please DM the project admin on **[LinkedIn](https://www.linkedin.com/in/ishant-singh-bisht-247a4b322/)** to get the \`SUPABASE_SERVICE_ROLE_KEY\`. (We've also updated our \`CONTRIBUTING.md\` to clarify this!).\n\nPlease test this with the buildings loaded and update the PR with new screenshots. Let me know if you need any help setting it up!`;

  await fetch(`https://api.github.com/repos/${repo}/issues/${prNum}/comments`, {
    method: 'POST', headers,
    body: JSON.stringify({ body: message }),
  });
  console.log("✅ Posted feedback comment to PR #84.");
}

main();
