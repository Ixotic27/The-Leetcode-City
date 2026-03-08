const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ?
            walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

function processFile(filePath) {
    if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;

    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    // 1. Git City -> LeetCode City
    content = content.replace(/Git City/g, "LeetCode City");

    // 2. GitHub -> LeetCode
    content = content.replace(/GitHub/g, "LeetCode");

    // 3. Restore Sign-in exceptions
    content = content.replace(/Sign in with LeetCode/g, "Sign in with GitHub");
    content = content.replace(/LeetCode account/g, "GitHub account");
    content = content.replace(/LeetCode credentials/g, "GitHub credentials");
    content = content.replace(/provider: "leetcode"/g, 'provider: "github"');
    content = content.replace(/LeetCode Sponsors/g, 'GitHub Sponsors');
    content = content.replace(/LeetCode API/g, 'GitHub API'); // mostly for terms/privacy

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log("Updated:", filePath);
    }
}

console.log("Starting replacement in src/app...");
walkDir(path.join(__dirname, 'src', 'app'), processFile);

console.log("Starting replacement in src/components...");
walkDir(path.join(__dirname, 'src', 'components'), processFile);

console.log("Done.");
