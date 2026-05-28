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

  const issue1 = {
    title: '🐛 Bug: Rain is localized to only one part of the city',
    body: `### Description\nThe rain particles/effect seem to be falling in only one specific part of the city rather than covering the entire map or following the camera dynamically.\n\n*(See screenshot attached by admin)*\n\n### Expected Behavior\nRain should either cover the entire visible city bounding box or dynamically center around the camera/target so it feels like it's raining everywhere.\n\n### Possible Solution\nCheck the \`EffectsLayer.tsx\` or wherever the rain particle system is instantiated and ensure the bounds/box of the particle system matches the city radius or camera frustum.`,
    labels: ['bug', 'frontend', 'needs-triage', 'good first issue']
  };

  const issue2 = {
    title: '🐛 Bug: Pixel sharpness / aliasing issues on 3D buildings',
    body: `### Description\nThe 3D buildings and pixels appear somewhat blurry or lack the crisp sharpness expected of a pixel-art style aesthetic. \n\n*(See screenshot attached by admin)*\n\n### Expected Behavior\nThe scene should look crisp and sharp. \n\n### Possible Solution\nInvestigate the \`dpr\` (device pixel ratio) setting in \`<Canvas>\` within \`CityCanvas.tsx\`, or check if we need to disable/enable certain anti-aliasing (e.g. \`antialias: false\`) or change the texture filtering (\`THREE.NearestFilter\`) on the render targets to preserve the pixelated look.`,
    labels: ['bug', 'frontend', 'needs-triage', 'good first issue']
  };

  for (const issue of [issue1, issue2]) {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST', headers,
      body: JSON.stringify(issue),
    });
    const data = await res.json();
    console.log(`Created issue: ${data.html_url}`);
  }
}

main();
