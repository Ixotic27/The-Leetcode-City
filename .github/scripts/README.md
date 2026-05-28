# The Leetcode City — GitHub Automation Scripts

This directory contains the scripts that power the GitHub Actions bot for **The Leetcode City**.

## 📁 Structure

```
scripts/
├── package.json                    # Dependencies for check-duplicates.js
├── check-duplicates.js             # Semantic duplicate detection using Gemini embeddings
└── README.md                       # This file
```

## 🤖 How Issue Assignment Works

Contributors comment on an issue with phrases like:
- `assign me`
- `I want to work on this`
- `Can I take this`
- `gssoc`

The **first commenter** gets assigned automatically. After assignment:
- The conversation is **locked** (further discussion happens in the PR)
- You have **48 hours** to submit a PR
- Max **3 open issues** per contributor at a time

## 🏷️ PR Labels

### Difficulty (required)
- `level:beginner` — Green
- `level:intermediate` — Blue
- `level:advanced` — Orange
- `level:critical` — Gray

### Quality (optional)
- `quality:clean` — Green
- `quality:exceptional` — Purple

### Type (optional, auto-detected from PR title/branch)
- `type:bug` — Red
- `type:feature` — Green
- `type:docs` — Blue
- `type:testing` — Purple
- `type:security` — Yellow
- `type:performance` — Indigo
- `type:design` — Pink
- `type:refactor` — Teal

### Status
- `gssoc:approved` — Auto-applied to all PRs (+50 base points)
- `status:blocked` — CI is failing
- `needs-rebase` — Merge conflicts
- `needs-details` — PR template not followed
- `inactive` — PR closed due to inactivity

### Mentor
- `mentor:username` — Added by mentors to PRs they reviewed

## 📊 Scoring

```
Score: 50 + (difficulty × quality) + type_bonus
```

- `gssoc:approved` gives **+50 base points** (required on every PR)
- Difficulty and quality multipliers are applied by maintainers
- Type bonus is automatically detected
