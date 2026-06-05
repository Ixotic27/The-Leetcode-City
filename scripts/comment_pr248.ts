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
  const prNum = 248;

  const commentBody = `Hi @Himanshujha7, thank you for this incredible PR! The dynamic snow weather system looks amazing.

Before we can merge this, we need you to address a few critical conflicts with recent changes pushed to \`main\`:

1. **Rebase needed for \`CityScene.tsx\`**: We just fixed a critical infinite recursion bug involving \`DayNightEnvironment\` which was crashing the site on load. Your branch was created before this fix, so your changes to \`CityScene.tsx\` currently reintroduce the buggy code structure. Please rebase on the latest \`main\`.
2. **Rebase needed for \`page.tsx\`**: We recently updated the city loading logic in \`page.tsx\` to use batched chunking to prevent server overload. Your changes in this file will conflict.
3. **\`package-lock.json\` changes**: Your PR modifies thousands of lines in \`package-lock.json\` (removing \`"peer": true\` from many dependencies). This usually happens when running \`npm install\` with a different npm/node version. Please revert the \`package-lock.json\` changes so it matches \`main\`.

Could you please rebase your branch on the latest \`main\`, resolve the conflicts in \`CityScene.tsx\` and \`page.tsx\`, and revert the \`package-lock.json\` changes? Once that is done, we'd love to review and merge this awesome feature!`;

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
