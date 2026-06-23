import fs from 'fs';
import path from 'path';

async function run() {
    const diffDir = path.join(process.cwd(), "scratch", "pr_diffs");
    const files = fs.readdirSync(diffDir).filter(f => f.endsWith('.diff'));
    
    const fileToPrs: Record<string, number[]> = {};
    const prToFiles: Record<number, string[]> = {};

    for (const file of files) {
        const prNumber = parseInt(file.split('.')[0]);
        const diffText = fs.readFileSync(path.join(diffDir, file), 'utf-8');
        
        // Find lines starting with "+++ b/"
        const lines = diffText.split('\n');
        const modifiedFiles: string[] = [];
        for (const line of lines) {
            if (line.startsWith('+++ b/')) {
                const filePath = line.substring(6).trim();
                modifiedFiles.push(filePath);
                if (!fileToPrs[filePath]) {
                    fileToPrs[filePath] = [];
                }
                fileToPrs[filePath].push(prNumber);
            }
        }
        prToFiles[prNumber] = modifiedFiles;
    }

    console.log("File modification matrix:\n");
    for (const [filePath, prs] of Object.entries(fileToPrs)) {
        if (prs.length > 1) {
            console.log(`⚠️ Overlap: ${filePath} is modified by PRs: ${prs.join(', ')}`);
        } else {
            console.log(`  File: ${filePath} (PR #${prs[0]})`);
        }
    }
}

run().catch(console.error);
