export enum LeetCodeFetchError {
    NETWORK_ERROR = "NETWORK_ERROR",
    HTTP_ERROR = "HTTP_ERROR",
    PARSE_ERROR = "PARSE_ERROR",
}

export async function fetchLeetCodeAboutMe(
    username: string
): Promise<{ data: string | null; error: LeetCodeFetchError | null }> {
    try {
        let res: Response;
        try {
            res = await fetch("https://leetcode.com/graphql", {
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
        } catch (err) {
            console.error("[leetcode.ts] failed to fetch LeetCode aboutMe (network):", err);
            return { data: null, error: LeetCodeFetchError.NETWORK_ERROR };
        }

        if (!res.ok) {
            return { data: null, error: LeetCodeFetchError.HTTP_ERROR };
        }

        let data: unknown;
        try {
            data = await res.json();
        } catch (err) {
            console.error("[leetcode.ts] failed to parse LeetCode aboutMe JSON:", err);
            return { data: null, error: LeetCodeFetchError.PARSE_ERROR };
        }

        const aboutMe =
            (data as { data?: { matchedUser?: { profile?: { aboutMe?: string } } } })
                ?.data?.matchedUser?.profile?.aboutMe ?? null;
        return { data: aboutMe, error: null };
    } catch (err) {
        console.error("[leetcode.ts] failed to fetch LeetCode aboutMe:", err);
        return { data: null, error: LeetCodeFetchError.NETWORK_ERROR };
    }
}

// Calendars are keyed dynamically as `y<year>` (e.g. y2015, y2016, …),
// each holding a JSON-encoded submissionCalendar string.
type YearCalendar = { submissionCalendar?: string };

export function parseMaxStreak(
    matchedUser: Record<string, unknown> | null | undefined,
    currentYear: number,
): number {
    if (!matchedUser) return 0;
    const allTimestamps: number[] = [];
    for (let y = currentYear-2; y <= currentYear; y++) {
        const cal = (matchedUser[`y${y}`] as YearCalendar | undefined)?.submissionCalendar;
        if (cal) {
            try {
                const parsed = JSON.parse(cal);
                allTimestamps.push(...Object.keys(parsed).map(Number));
            } catch (err) {
                console.warn("[leetcode.ts] skipped invalid submission calendar:", err);
            }
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
    maxStreak = Math.max(maxStreak,currentStreak)
    return maxStreak;
}

export async function fetchLeetCodeWeeklySubmissions(
    username: string
): Promise<{ data: number | null; error: LeetCodeFetchError | null }> {
    try {
        const now = new Date();
        const currentYear = now.getFullYear();
        const sevenDaysAgoDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const sevenDaysAgoYear = sevenDaysAgoDate.getFullYear();

        const yearsToFetch = [currentYear];
        if (sevenDaysAgoYear !== currentYear) {
            yearsToFetch.push(sevenDaysAgoYear);
        }

        const nowTs = Math.floor(now.getTime() / 1000);
        let totalWeeklyCount = 0;

        for (const year of yearsToFetch) {
            let res: Response;
            try {
                res = await fetch("https://leetcode.com/graphql", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "User-Agent": "Mozilla/5.0",
                        "Referer": "https://leetcode.com/"
                    },
                    body: JSON.stringify({
                        query: `
              query getUserCalendar($username: String!, $year: Int) {
                matchedUser(username: $username) {
                  userCalendar(year: $year) {
                    submissionCalendar
                  }
                }
              }
            `,
                        variables: { username, year }
                    })
                });
            } catch (err) {
                console.error("[leetcode.ts] failed to fetch weekly submissions (network):", err);
                return { data: null, error: LeetCodeFetchError.NETWORK_ERROR };
            }

            if (!res.ok) {
                return { data: null, error: LeetCodeFetchError.HTTP_ERROR };
            }

            let data: unknown;
            try {
                data = await res.json();
            } catch (err) {
                console.error("[leetcode.ts] failed to parse weekly submissions JSON:", err);
                return { data: null, error: LeetCodeFetchError.PARSE_ERROR };
            }

            const calendarStr =
                (data as { data?: { matchedUser?: { userCalendar?: { submissionCalendar?: string } } } })
                    ?.data?.matchedUser?.userCalendar?.submissionCalendar;
            if (!calendarStr) return { data: null, error: null };

            let calendar: Record<string, number>;
            try {
                calendar = JSON.parse(calendarStr);
            } catch (err) {
                console.error("[leetcode.ts] failed to parse submissionCalendar string:", err);
                return { data: null, error: LeetCodeFetchError.PARSE_ERROR };
            }

            const sevenDaysAgoTs = nowTs - 7 * 24 * 60 * 60;

            for (const [timestampStr, count] of Object.entries(calendar)) {
                const timestamp = parseInt(timestampStr, 10);
                if (timestamp >= sevenDaysAgoTs) {
                    totalWeeklyCount += count as number;
                }
            }
        }

        return { data: totalWeeklyCount, error: null };
    } catch (err) {
        console.error("[leetcode.ts] failed to fetch weekly submissions:", err);
        return { data: null, error: LeetCodeFetchError.NETWORK_ERROR };
    }
}
