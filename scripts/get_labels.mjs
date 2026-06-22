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
    try {
        const labels = await restRequest('GET', `/repos/${repo}/labels?per_page=100`);
        console.log("Existing labels:");
        console.log(labels.map(l => l.name).join(', '));
    } catch (err) {
        console.error("Failed to get labels:", err);
    }
}

run().catch(console.error);
