$env:GITHUB_TOKEN=""

gh issue create --title "Bug: 'Mission Quota Matched' message pops up prematurely at exact quota value" -F issue1.md
gh issue create --title "Bug: 'Mission Quota Matched' popup repeatedly appears after completing the mission" -F issue2.md
gh issue create --title "Bug: 'KEEP FLYING' button is unresponsive on the Mission Quota Matched popup" -F issue3.md

Remove-Item issue1.md, issue2.md, issue3.md
