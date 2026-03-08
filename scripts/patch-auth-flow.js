const fs = require('fs');
const glob = require('glob'); // Not available? We can use recursive readdir
const path = require('path');

function walk(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            walk(filePath, fileList);
        } else {
            if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
                fileList.push(filePath);
            }
        }
    }
    return fileList;
}

const apiPath = path.join(__dirname, 'src', 'app', 'api');
const files = walk(apiPath);

let patched = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    // 1. Remove the old githubLogin parsing logic
    const oldLoginRegex = /const githubLogin = \(\s*user\.user_metadata\?\.user_name \?\?\s*user\.user_metadata\?\.preferred_username \?\?\s*""\s*\)\.toLowerCase\(\);/gs;
    if (oldLoginRegex.test(content)) {
        content = content.replace(oldLoginRegex, '');
        changed = true;
    }

    const oldLoginRegex2 = /const githubLogin = \(\s*user\.user_metadata\.user_name \?\?\s*user\.user_metadata\.preferred_username \?\?\s*""\s*\)\.toLowerCase\(\);/gs;
    if (oldLoginRegex2.test(content)) {
        content = content.replace(oldLoginRegex2, '');
        changed = true;
    }

    // Replace strict OAuth matches for login
    const oldLoginRegex3 = /const login = user\.user_metadata\?\.user_name\?\.toLowerCase\(\);/g;
    if (oldLoginRegex3.test(content)) {
        content = content.replace(oldLoginRegex3, '');
        changed = true;
    }

    // 2. Add github_login to the select statements if missing (but only if it's querying developers)
    // Basic heuristic: find `.select("` and insert `github_login, `
    // But be careful not to break non-developers queries.
    // Instead, let's just make the .eq substitution, and anywhere `githubLogin` was used, replace with `dev.github_login`:
    if (content.includes('.eq("github_login", githubLogin)')) {
        content = content.replace(/\.eq\("github_login", githubLogin\)/g, '.eq("claimed_by", user.id)');
        changed = true;
    }

    if (content.includes('.eq("github_login", login)')) {
        content = content.replace(/\.eq\("github_login", login\)/g, '.eq("claimed_by", user.id)');
        changed = true;
    }

    // 3. Since githubLogin variable is gone, replace it with `dev.github_login`
    if (changed) {
        // Fix up the references
        content = content.replace(/\bgithubLogin\b/g, 'dev.github_login');
        content = content.replace(/\blogin\b/g, 'dev.github_login'); // Only for district/change

        // Ensure "github_login" is selected
        // We'll just look for `.select("` and if it doesn't contain `github_login` or `*`, add it.
        content = content.replace(/\.select\("([^"]+)"\)/g, (match, p1) => {
            if (p1 === '*' || p1 === 'count' || p1.includes('github_login')) {
                return match;
            }
            return `.select("github_login, ${p1}")`;
        });

        fs.writeFileSync(file, content, 'utf8');
        console.log(`Patched: ${file}`);
        patched++;
    }
}

console.log(`Patched ${patched} API files.`);
