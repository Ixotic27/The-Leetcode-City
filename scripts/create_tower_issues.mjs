import fs from 'fs';
import https from 'https';

const repo = "Ixotic27/The-Leetcode-City";
const token = fs.readFileSync(".env.local", "utf-8")
    .split("\n")
    .find(line => line.startsWith("GITHUB_TOKEN="))
    ?.split("=")[1]?.trim();

if (!token) {
    console.error("No GITHUB_TOKEN found in .env.local");
    process.exit(1);
}

const headers = {
    "Accept": "application/vnd.github.v3+json",
    "Authorization": `token ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "Node-Script"
};

function restRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;
        const options = {
            hostname: 'api.github.com',
            path,
            method,
            headers: {
                ...headers,
                ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
            }
        };

        const req = https.request(options, (res) => {
            let resBody = '';
            res.on('data', chunk => resBody += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(resBody ? JSON.parse(resBody) : {});
                } else {
                    reject(new Error(`Request to ${path} failed with status ${res.statusCode}: ${resBody}`));
                }
            });
        });

        req.on('error', reject);
        if (data) {
            req.write(data);
        }
        req.end();
    });
}

async function run() {
    console.log("Creating tower and daily questions issues on GitHub...");

    // Issue 1: Daily Questions Building Style
    const title1 = "[Feature Proposal] Redesign Daily Questions Building to Match E.Arcade Style";
    const body1 = `### Overview
We need to update the 3D model/style of the **Daily Questions** building in the main town. Currently, it stands out or doesn't match the new retro-arcade aesthetic we are moving towards.

### Requirements
- Redesign the Daily Questions building structure and texture styling to match the **E.Arcade building style** (sleek, retro-arcade/cyberpunk grey tones, digital billboards/signs).
- Ensure a unified visual identity across the main landmarks in the 3D space by aligning daily questions styling with our grey/arcade palette.
- Keep the hitboxes and interactions of the Daily Questions building identical to current functionality.`;

    // Issue 2: Optimized Random Traffic System
    const title2 = "[Refactor/Optimization] Replace Tower-Orbiting Traffic with Optimized Street/Ring Random Cars";
    const body2 = `### Overview
We want to remove the current system where cars orbit/move around the central tower in a uniform pattern. Instead, we should introduce a more dynamic and realistic traffic simulation that runs on the actual city streets and concentric rings.

### Requirements
- **Remove existing tower orbiters:** Clean up the old code driving the cards/cars orbiting the central tower.
- **Implement Ring & Street Traffic:** 
  - Random cars should spawn and run along the different concentric rings of LeetCode City.
  - Cars should drive through the open spaces/streets between the buildings.
- **No Building Intersections:** Ensure cars do not clip or drive inside/through the buildings. Use predefined road/path networks or dynamic collision boundaries.
- **Performance Optimizations:** 
  - Use 2-3 types of low-poly 3D car models.
  - Optimize the models (reducing vertex/polygon counts) and use instanced rendering if possible to keep frame rates high.
  - Recycyle/pool car instances as they leave the screen or travel out of bounds.`;

    try {
        const issue1 = await restRequest('POST', `/repos/${repo}/issues`, {
            title: title1,
            body: body1,
            labels: ["enhancement", "UI/UX", "3D"]
        });
        console.log(`Successfully created issue #${issue1.number}: "${issue1.title}"`);
        console.log(`URL: ${issue1.html_url}`);

        const issue2 = await restRequest('POST', `/repos/${repo}/issues`, {
            title: title2,
            body: body2,
            labels: ["enhancement", "performance", "3D"]
        });
        console.log(`Successfully created issue #${issue2.number}: "${issue2.title}"`);
        console.log(`URL: ${issue2.html_url}`);
    } catch (err) {
        console.error("Failed to create issues:", err);
        process.exit(1);
    }
}

run().catch(console.error);
