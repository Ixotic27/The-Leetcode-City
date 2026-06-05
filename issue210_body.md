**Description:**
There is a bug where daily missions trigger their completion messages prematurely. For example, if the player has an active daily mission to gather **150 points**, the "MISSION QUOTA MATCHED" message pops up as soon as they reach a lower milestone like **50 points**.

The logic should properly check the current score against the specific daily mission's target score. The completion message should only show up when the exact target quota (e.g. 150) is met or exceeded.

**Requirements:**
- :warning: **Visual Proof Required:** You MUST provide a video and screenshots showing the behavior BOTH **before** the fix (showing the premature popup) and **after** the fix (showing the correct behavior where it triggers only at the target score).
- PRs without this visual proof will be marked as invalid and closed automatically.

<img width="743" height="471" alt="Image" src="https://github.com/user-attachments/assets/c71855fe-86d5-4887-bb32-ef46908cdb99" />
