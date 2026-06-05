$env:GITHUB_TOKEN=""

$body1 = @"
**Description:**
Some missions state to gather "more than 50 points". However, when the player's points reach exactly 50, the "MISSION QUOTA MATCHED" message pops up prematurely before the quota is actually exceeded. The logic check needs to be strictly greater than (e.g., > 50) rather than greater than or equal to (>= 50).

**Requirements:**
- :warning: **Visual Proof Required:** You MUST provide a video and screenshots showing the behavior BOTH **before** the fix (showing the bug) and **after** the fix (showing the correct behavior where it triggers at 51).
- PRs without this visual proof will be marked as invalid and closed automatically.

*(Please refer to the issue comments for the screenshot)*
"@

$body2 = @"
**Description:**
After successfully completing the flying mission (by collecting the required coins/points), the "MISSION QUOTA MATCHED" popup incorrectly appears again as soon as we reach the same point threshold later. The mission state should be marked as completed, and the popup should not repeatedly trigger once the mission is already finished.

**Requirements:**
- :warning: **Visual Proof Required:** You MUST provide a video and screenshots showing the behavior BOTH **before** the fix (showing the bug repeating) and **after** the fix (showing it only happening once).
- PRs without this visual proof will be marked as invalid and closed automatically.

*(Please refer to the issue comments for the screenshot)*
"@

$body3 = @"
**Description:**
On the "MISSION QUOTA MATCHED!" popup, the "KEEP FLYING" button is not working. Currently, only the "EXIT NOW" button is responsive. Clicking "KEEP FLYING" should successfully close the popup and allow the player to continue their flight without interrupting the session.

**Requirements:**
- :warning: **Visual Proof Required:** You MUST provide a video and screenshots showing the behavior BOTH **before** the fix (clicking the button does nothing) and **after** the fix (clicking the button successfully closes the popup and resumes flight).
- PRs without this visual proof will be marked as invalid and closed automatically.

*(Please refer to the issue comments for the screenshot)*
"@

gh issue create --title "Bug: 'Mission Quota Matched' message pops up prematurely at exact quota value" --body $body1
gh issue create --title "Bug: 'Mission Quota Matched' popup repeatedly appears after completing the mission" --body $body2
gh issue create --title "Bug: 'KEEP FLYING' button is unresponsive on the Mission Quota Matched popup" --body $body3
