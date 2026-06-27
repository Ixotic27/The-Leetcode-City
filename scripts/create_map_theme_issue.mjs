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
    console.log("Creating map theme issue on GitHub...");

    const title = "[Feature Proposal] Redesign E.Arcade Map Theme to Arcade Grey Style & Expand Assets (Avoid Pokémon Copyright)";
    
    const body = `### Overview
We need to redesign the map theme of E.Arcade. Currently, parts of the map use Pokémon-style aesthetics or assets. To prevent any copyright strikes or legal issues from **The Pokémon Company / Nintendo**, we must completely decouple our graphics from their intellectual property. 

Instead, we should adopt a unified **retro arcade/pixel-art theme** (using the sleek, stylized grey color palette already present in the arcade room UI and Ixotopia town layout). The layout of the map can remain Pokémon-type (a top-down grid exploration system) but all graphical assets must be completely original or open-source retro-arcade assets.

### Key Goals & Changes
1. **Remove Pokémon Assets:** Remove all copyrighted Pokémon-derived tile-sets, characters, items, and UI sprites.
2. **Standardize on Arcade Grey Theme:** Style the entire overworld with grey scale / neon pixel-art assets that match the existing arcade design (as seen in the E.Arcade cards and panels).
3. **Introduce New Asset Types:**
   - **NPCs:** Non-playable characters with dialogue bubbles, simple AI routines, and custom pixel-art sprites.
   - **Under Construction Board:** Custom retro-arcade signposts placed at the boundary gates or locked portals to guide players.
   - **New Animations:** Smooth walking/running cycles for custom avatars, interaction micro-animations, and visual effects (such as particles or glowing lights).
   - **Bosses:** Custom enemy sprites, battle arenas, or boss chambers.
   - **Buildings:** Modern grey/cyberpunk/retro-arcade structures (e.g. Code Shop, Guild Hall, Leaderboard Plaza).
   - **Dungeons:** Instanced map areas filled with puzzles, coding challenges, or monsters matching the new visual style.

### Ideas & Contribution Guidelines
- We should use standard grid-aligned tile sets that are either custom-made or licensed under CC0/MIT (e.g. from Kenney, itch.io open assets, etc.).
- Avatar customizer sprites must be expanded to match this new theme.
- Feel free to drop comments below with link references to matching assets, draft designs, or styling proposals!`;

    try {
        const issue = await restRequest('POST', `/repos/${repo}/issues`, {
            title,
            body,
            labels: ["enhancement", "assets", "UI/UX"]
        });
        console.log(`Successfully created issue #${issue.number}: "${issue.title}"`);
        console.log(`URL: ${issue.html_url}`);
    } catch (err) {
        console.error("Failed to create issue:", err);
        process.exit(1);
    }
}

run().catch(console.error);
