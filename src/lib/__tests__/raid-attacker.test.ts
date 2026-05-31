import { findRaidAttackerForUser, getAuthLoginCandidates } from "../raid-attacker";

type DeveloperRow = {
  id: number;
  claimed?: boolean | null;
  claimed_by?: string | null;
  github_login?: string | null;
  lc_username?: string | null;
  lc_github?: string | null;
};

function makeAdmin(rows: DeveloperRow[]) {
  return {
    from(table: string) {
      expect(table).toBe("developers");

      return {
        select() {
          const filters: ((row: DeveloperRow) => boolean)[] = [];
          const query = {
            eq(column: keyof DeveloperRow, value: string | number | boolean) {
              filters.push((row) => row[column] === value);
              return query;
            },
            limit() {
              return query;
            },
            async maybeSingle() {
              return { data: rows.find((row) => filters.every((filter) => filter(row))) ?? null };
            },
          };

          return query;
        },
        update(values: Partial<DeveloperRow>) {
          return {
            async eq(column: keyof DeveloperRow, value: string | number) {
              const row = rows.find((candidate) => candidate[column] === value);
              if (row) Object.assign(row, values);
              return { error: null };
            },
          };
        },
      };
    },
  };
}

describe("raid attacker lookup", () => {
  it("deduplicates GitHub login candidates from metadata and identities", () => {
    const candidates = getAuthLoginCandidates({
      id: "user-1",
      user_metadata: {
        user_name: "SaurabhhhCodes",
        preferred_username: "@saurabhhhcodes",
      },
      identities: [
        {
          identity_data: {
            user_name: "https://github.com/saurabhhhcodes",
          },
        },
      ],
    });

    expect(candidates).toEqual(["saurabhhhcodes"]);
  });

  it("repairs a linked row that belongs to the current session but has claimed=false", async () => {
    const rows: DeveloperRow[] = [
      {
        id: 7,
        claimed: false,
        claimed_by: "user-1",
        github_login: "leetcode_user",
      },
    ];

    const attacker = await findRaidAttackerForUser(makeAdmin(rows) as never, {
      id: "user-1",
      user_metadata: {},
      identities: [],
    }, "id, claimed, claimed_by, github_login");

    expect(attacker?.claimed).toBe(true);
    expect(rows[0]).toMatchObject({ claimed: true, claimed_by: "user-1", fetch_priority: 1 });
  });

  it("restores a stale LeetCode claim when the profile links to the signed-in GitHub account", async () => {
    const rows: DeveloperRow[] = [
      {
        id: 12,
        claimed: true,
        claimed_by: "old-session-id",
        github_login: "leetcode_handle",
        lc_username: "leetcode_handle",
        lc_github: "https://github.com/saurabhhhcodes",
      },
    ];

    const attacker = await findRaidAttackerForUser(makeAdmin(rows) as never, {
      id: "new-session-id",
      user_metadata: { user_name: "saurabhhhcodes" },
      identities: [],
    }, "id, claimed, claimed_by, github_login, lc_github");

    expect(attacker?.id).toBe(12);
    expect(rows[0]).toMatchObject({ claimed: true, claimed_by: "new-session-id" });
  });

  it("does not take over a row claimed by another user from a plain username match", async () => {
    const rows: DeveloperRow[] = [
      {
        id: 14,
        claimed: true,
        claimed_by: "other-user",
        github_login: "saurabhhhcodes",
      },
    ];

    const attacker = await findRaidAttackerForUser(makeAdmin(rows) as never, {
      id: "user-1",
      user_metadata: { user_name: "saurabhhhcodes" },
      identities: [],
    }, "id, claimed, claimed_by, github_login");

    expect(attacker).toBeNull();
    expect(rows[0].claimed_by).toBe("other-user");
  });
});
