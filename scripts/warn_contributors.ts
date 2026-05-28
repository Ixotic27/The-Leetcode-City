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
  
  // PRs that are related to 3D UI / Animations where buildings might have been missing
  const targetPRs = [84, 65];

  const message = `📢 **Important Update Regarding Local Development**\n\nWe noticed that some contributors were struggling to load the 3D buildings locally because the frontend was waiting on a backend service key. \n\n**We have just pushed a fix to the backend.** You no longer need a service role key to view the city! Anonymous users can now fetch and render the entire 3D city locally out of the box.\n\n### What you need to do:\n1. Run \`git pull origin main\` (or sync your fork with \`main\`) to get the latest backend/frontend fixes.\n2. Run the project locally. You should now see all the buildings and customizations load perfectly.\n3. **Post legitimate, working screenshots or videos** of your feature running *with* the actual city/buildings visible in the background.\n\n⚠️ **WARNING:** If you are using AI to generate code, you still need to actually run it and verify that it works. **PRs with fake, cropped, or broken screenshots will be rejected, and repeat offenders will be blocked from future contributions.**\n\nPlease update your PR with valid screenshots as soon as possible. Thank you!`;

  for (const prNum of targetPRs) {
    console.log(`Commenting on PR #${prNum}...`);
    const res = await fetch(`https://api.github.com/repos/${repo}/issues/${prNum}/comments`, {
      method: 'POST', headers,
      body: JSON.stringify({ body: message }),
    });
    if (res.ok) {
      console.log(`✅ Success for PR #${prNum}`);
    } else {
      console.log(`❌ Failed for PR #${prNum}: ${await res.text()}`);
    }
  }
}

main();
