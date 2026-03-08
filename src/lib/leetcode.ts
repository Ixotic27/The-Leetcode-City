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
    } catch {
        return null;
    }
}
