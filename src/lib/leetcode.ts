/**
 * Error types for LeetCode API fetch failures.
 * Allows callers to distinguish between transient network issues and data absence.
 */
export enum LeetCodeFetchError {
  /** Network connectivity issue or fetch threw */
  NETWORK_ERROR = "NETWORK_ERROR",
  /** LeetCode responded with a non-OK HTTP status */
  HTTP_ERROR = "HTTP_ERROR",
  /** LeetCode response body could not be parsed as JSON */
  PARSE_ERROR = "PARSE_ERROR",
}

/** Return type for LeetCode API calls that can fail */
export interface LeetCodeResult<T> {
  data: T;
  error: LeetCodeFetchError | null;
}

export async function fetchLeetCodeAboutMe(
  username: string,
): Promise<LeetCodeResult<string | null>> {
  try {
    const res = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://leetcode.com/",
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
        variables: { username },
      }),
    });

    if (!res.ok) {
      return { data: null, error: LeetCodeFetchError.HTTP_ERROR };
    }

    let data: Record<string, unknown>;
    try {
      data = await res.json();
    } catch {
      return { data: null, error: LeetCodeFetchError.PARSE_ERROR };
    }

    return {
      data: (data?.data as Record<string, unknown>)?.matchedUser?.profile?.aboutMe ?? null,
      error: null,
    };
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
    for (let y = 2015; y <= currentYear; y++) {
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
    if (currentStreak > maxStreak) maxStreak = currentStreak;
    return maxStreak;
}

export async function fetchLeetCodeWeeklySubmissions(
  username: string,
): Promise<LeetCodeResult<number>> {
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
      const res = await fetch("https://leetcode.com/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0",
          "Referer": "https://leetcode.com/",
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
          variables: { username, year },
        }),
      });

      if (!res.ok) {
        return { data: 0, error: LeetCodeFetchError.HTTP_ERROR };
      }

      let data: Record<string, unknown>;
      try {
        data = await res.json();
      } catch {
        return { data: 0, error: LeetCodeFetchError.PARSE_ERROR };
      }

      const matchedUser = data?.data as Record<string, unknown> | undefined;
      const calendarStr = (
        matchedUser?.matchedUser as Record<string, unknown>
      )?.userCalendar?.submissionCalendar as string | undefined;

      if (!calendarStr) {
        return { data: 0, error: LeetCodeFetchError.PARSE_ERROR };
      }

      let calendar: Record<string, number>;
      try {
        calendar = JSON.parse(calendarStr);
      } catch {
        return { data: 0, error: LeetCodeFetchError.PARSE_ERROR };
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
    return { data: 0, error: LeetCodeFetchError.NETWORK_ERROR };
  }
}
