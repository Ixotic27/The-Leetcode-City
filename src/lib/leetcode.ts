export async function fetchLeetCodeAboutMe(username: string): Promise<string | null> {
    try {
        const res = await fetch("https://leetcode.com/graphql", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0",
                "Referer": "https://leetcode.com/"
            },
            body: JSON.stringify({
                query: `
          query getUserProfile($username: String!) {
            matchedUser(username: $username) {
              profile {
                aboutMe
              }
            }
          }
        `,
                variables: { username }
            })
        });

        if (!res.ok) return null;
        const data = await res.json();
        return data?.data?.matchedUser?.profile?.aboutMe ?? null;
    } catch (err) { console.warn("[lib/leetcode.ts] error:", err); return null;
     }
}

export function parseMaxStreak(matchedUser: any, currentYear: number): number {
    if (!matchedUser) return 0;
    const allTimestamps: number[] = [];
    for (let y = 2015; y <= currentYear; y++) {
        const cal = matchedUser[`y${y}`]?.submissionCalendar;
        if (cal) {
            try {
                const parsed = JSON.parse(cal);
                allTimestamps.push(...Object.keys(parsed).map(Number));
            } catch (err) { console.warn("[lib/leetcode.ts] non-critical error:", err); }
        }
    }
    allTimestamps.sort((a, b) => a - b);

    let maxStreak = 0;
    let currentStreak = 0;
    let previousDate = 0;

    for (const ts of allTimestamps) {
        if (currentStreak === 0) {
            currentStreak = 1;
            previousDate = ts;
        } else {
            const diffDays = Math.round((ts - previousDate) / 86400);
            if (diffDays === 1) {
                currentStreak++;
            } else if (diffDays > 1) {
                if (currentStreak > maxStreak) maxStreak = currentStreak;
                currentStreak = 1;
            }
            previousDate = ts;
        }
    }
    if (currentStreak > maxStreak) maxStreak = currentStreak;
    return maxStreak;
}
