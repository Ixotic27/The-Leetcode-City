import fs from 'fs';

async function main() {
  const env = fs.readFileSync('.env.local', 'utf-8');
  const token = env.split('\n').find(line => line.startsWith('GITHUB_TOKEN='))!.split('=')[1].trim();
  const headers = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.github.v3+json',
  };
  const repo = 'Ixotic27/The-Leetcode-City';
  const prNum = 95;

  const filesRes = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNum}/files`, { headers });
  const files = await filesRes.json();
  
  for (const f of files) {
    console.log(`File: ${f.filename}`);
    console.log(f.patch);
    console.log('---------------------');
  }
}

main();
