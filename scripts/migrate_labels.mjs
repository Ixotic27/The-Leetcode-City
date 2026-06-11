/**
 * migrate_labels.mjs
 * 
 * Migrates ALL issues and PRs (open + closed) to use the standardized label format:
 * 
 * Required on every issue/PR:
 *   - Gssoc 26
 *   - gssoc:approved
 *   - Exactly one level:X difficulty label
 * 
 * Actions:
 *   1. Rename bare difficulty labels → level:X format
 *   2. Remove deprecated labels (quality:clean, quality:exceptional, gssoc:verified, etc.)
 *   3. Add missing required labels (Gssoc 26, gssoc:approved, level:beginner fallback)
 *   4. Delete deprecated labels from the repo entirely
 */

import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const tokenLine = env.split('\n').find(l => l.startsWith('GITHUB_TOKEN='));
if (!tokenLine) { console.error('GITHUB_TOKEN not found in .env.local'); process.exit(1); }
const token = tokenLine.split('=').slice(1).join('=').trim();

const headers = {
  'Authorization': `Bearer ${token}`,
  'Accept': 'application/vnd.github.v3+json',
  'Content-Type': 'application/json',
};
const repo = 'Ixotic27/The-Leetcode-City';
const API = `https://api.github.com/repos/${repo}`;

// Labels to migrate: bare → level:X
const MIGRATE_MAP = {
  'beginner': 'level:beginner',
  'intermediate': 'level:intermediate',
  'advanced': 'level:advanced',
};

// Labels to remove (deprecated, don't follow format)
const LABELS_TO_REMOVE = [
  'beginner', 'intermediate', 'advanced',
  'quality:clean', 'quality:exceptional',
  'gssoc:verified',
];

// Required labels on every issue/PR
const REQUIRED_LABELS = ['Gssoc 26', 'gssoc:approved'];
const DIFFICULTY_LABELS = ['level:beginner', 'level:intermediate', 'level:advanced', 'level:critical'];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function ghFetch(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers });
  if (res.status === 403) {
    const reset = res.headers.get('x-ratelimit-reset');
    const waitMs = reset ? (parseInt(reset) * 1000 - Date.now() + 1000) : 60000;
    console.log(`⏳ Rate limited. Waiting ${Math.ceil(waitMs / 1000)}s...`);
    await sleep(waitMs);
    return ghFetch(url, opts);
  }
  return res;
}

async function fetchAllPages(baseUrl) {
  const items = [];
  for (let page = 1; page <= 100; page++) {
    const sep = baseUrl.includes('?') ? '&' : '?';
    const res = await ghFetch(`${baseUrl}${sep}per_page=100&page=${page}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    items.push(...data);
    if (data.length < 100) break;
    await sleep(100); // gentle rate limiting
  }
  return items;
}

async function main() {
  console.log('🏷️  Label Migration Script');
  console.log('=========================\n');

  // Step 1: Ensure required labels exist in the repo
  console.log('📋 Step 1: Ensuring required labels exist...');
  const labelsToCreate = [
    { name: 'level:beginner', color: '22c55e', description: 'Beginner difficulty level' },
    { name: 'level:intermediate', color: '3b82f6', description: 'Intermediate difficulty level' },
    { name: 'level:advanced', color: 'f97316', description: 'Advanced difficulty level' },
    { name: 'level:critical', color: '6b7280', description: 'Critical difficulty level' },
    { name: 'Gssoc 26', color: 'e5533d', description: 'GSSoC 2026 contribution' },
    { name: 'gssoc:approved', color: '0e8a16', description: 'Approved GSSoC contribution' },
    { name: 'good first issue', color: '7057ff', description: 'Good for newcomers' },
  ];
  for (const label of labelsToCreate) {
    const res = await ghFetch(`${API}/labels/${encodeURIComponent(label.name)}`);
    if (res.status === 404) {
      console.log(`  ➕ Creating: ${label.name}`);
      await ghFetch(`${API}/labels`, { method: 'POST', body: JSON.stringify(label) });
    } else {
      console.log(`  ✅ Exists: ${label.name}`);
    }
  }

  // Step 2: Fetch ALL issues and PRs (open + closed)
  console.log('\n📂 Step 2: Fetching all issues/PRs...');
  const allOpen = await fetchAllPages(`${API}/issues?state=open`);
  const allClosed = await fetchAllPages(`${API}/issues?state=closed`);
  const allItems = [...allOpen, ...allClosed];
  console.log(`  Found ${allOpen.length} open + ${allClosed.length} closed = ${allItems.length} total`);

  // Step 3: Process each issue/PR
  console.log('\n🔄 Step 3: Migrating labels...\n');
  let migratedCount = 0;
  let skippedCount = 0;

  for (const item of allItems) {
    const num = item.number;
    const isPR = !!item.pull_request;
    const type = isPR ? 'PR' : 'Issue';
    const currentLabels = item.labels.map(l => l.name);

    const labelsToAdd = [];
    const labelsToRemove = [];

    // 3a. Migrate bare difficulty labels → level:X
    for (const [bare, leveled] of Object.entries(MIGRATE_MAP)) {
      if (currentLabels.includes(bare)) {
        labelsToRemove.push(bare);
        if (!currentLabels.includes(leveled) && !labelsToAdd.includes(leveled)) {
          labelsToAdd.push(leveled);
        }
      }
    }

    // 3b. Remove deprecated labels
    for (const dep of LABELS_TO_REMOVE) {
      if (currentLabels.includes(dep) && !labelsToRemove.includes(dep)) {
        labelsToRemove.push(dep);
      }
    }

    // 3c. Add missing required labels
    for (const req of REQUIRED_LABELS) {
      if (!currentLabels.includes(req) && !labelsToAdd.includes(req)) {
        labelsToAdd.push(req);
      }
    }

    // 3d. Ensure at least one difficulty label exists
    const allCurrentAndAdded = [...currentLabels, ...labelsToAdd].filter(l => !labelsToRemove.includes(l));
    const hasDifficulty = allCurrentAndAdded.some(l => DIFFICULTY_LABELS.includes(l));
    if (!hasDifficulty) {
      labelsToAdd.push('level:beginner');
    }

    // Apply changes
    if (labelsToAdd.length === 0 && labelsToRemove.length === 0) {
      skippedCount++;
      continue;
    }

    console.log(`${type} #${num}: +[${labelsToAdd.join(', ')}] -[${labelsToRemove.join(', ')}]`);

    // Add labels
    if (labelsToAdd.length > 0) {
      await ghFetch(`${API}/issues/${num}/labels`, {
        method: 'POST',
        body: JSON.stringify({ labels: labelsToAdd }),
      });
    }

    // Remove deprecated labels one by one
    for (const label of labelsToRemove) {
      await ghFetch(`${API}/issues/${num}/labels/${encodeURIComponent(label)}`, {
        method: 'DELETE',
      });
    }

    migratedCount++;
    await sleep(200); // be gentle with API
  }

  console.log(`\n✅ Migration complete! Migrated: ${migratedCount}, Already correct: ${skippedCount}`);

  // Step 4: Delete deprecated labels from the repo
  console.log('\n🗑️  Step 4: Deleting deprecated labels from repo...');
  for (const label of LABELS_TO_REMOVE) {
    const res = await ghFetch(`${API}/labels/${encodeURIComponent(label)}`, { method: 'DELETE' });
    if (res.ok || res.status === 204) {
      console.log(`  🗑️  Deleted: ${label}`);
    } else if (res.status === 404) {
      console.log(`  ⏭️  Already gone: ${label}`);
    } else {
      console.log(`  ❌ Failed to delete ${label}: ${res.status}`);
    }
  }

  console.log('\n🎉 All done!');
}

main().catch(err => { console.error('Fatal error:', err); process.exit(1); });
