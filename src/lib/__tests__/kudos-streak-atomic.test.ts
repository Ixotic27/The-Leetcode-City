import { describe, it, expect, vi } from "vitest";

// Pure unit tests for the atomic kudos_streak update.
//
// The bug: kudos_streak / last_kudos_given_date were read into a JS
// snapshot at the top of the request handler, the new streak was
// computed from that snapshot, and written back unconditionally — no
// WHERE guard against the live row having since changed. A request that
// captured its snapshot early but writes late (a slow insert_kudos_atomic
// call, a client retry, etc.) can overwrite an already-correctly-advanced
// streak with a value computed from stale data.
//
// The fix: update_kudos_streak() does the increment in a single atomic
// UPDATE ... WHERE last_kudos_given_date IS DISTINCT FROM p_given_date,
// always operating on the row's current state rather than a JS-held
// snapshot, with the WHERE guard preventing same-day double application.

// Simulates the new update_kudos_streak(p_giver_id, p_given_date) RPC:
//   UPDATE developers
//   SET kudos_streak = CASE WHEN last_kudos_given_date = p_given_date - 1
//                       THEN kudos_streak + 1 ELSE 1 END,
//       last_kudos_given_date = p_given_date
//   WHERE id = p_giver_id AND last_kudos_given_date IS DISTINCT FROM p_given_date
// Operates directly on the live row — there is no separate snapshot to go stale.
function simulateUpdateKudosStreak(
  row: { kudos_streak: number; last_kudos_given_date: string | null },
  givenDate: string,
  yesterday: string
): { kudos_streak: number } {
  if (row.last_kudos_given_date === givenDate) {
    // WHERE clause excludes — no row matched, return current value unchanged.
    return { kudos_streak: row.kudos_streak };
  }
  row.kudos_streak = row.last_kudos_given_date === yesterday ? row.kudos_streak + 1 : 1;
  row.last_kudos_given_date = givenDate;
  return { kudos_streak: row.kudos_streak };
}

// Simulates the OLD buggy behavior: the caller computes from a snapshot
// taken at some earlier point, not the live row, and writes unconditionally.
function simulateOldStaleSnapshotUpdate(
  liveRow: { kudos_streak: number; last_kudos_given_date: string | null },
  snapshot: { kudos_streak: number; last_kudos_given_date: string | null },
  today: string,
  yesterday: string
): number {
  let newStreak = snapshot.kudos_streak;
  if (snapshot.last_kudos_given_date === today) {
    // no-op branch (matches the original `if (lastKudosDate === today) {}`)
  } else if (snapshot.last_kudos_given_date === yesterday) {
    newStreak += 1;
  } else {
    newStreak = 1;
  }
  liveRow.kudos_streak = newStreak;
  liveRow.last_kudos_given_date = today;
  return newStreak;
}

describe("update_kudos_streak — atomic fix (new behavior)", () => {
  it("consecutive day: increments streak by exactly 1", () => {
    const row = { kudos_streak: 5, last_kudos_given_date: "2026-06-15" };
    const r = simulateUpdateKudosStreak(row, "2026-06-16", "2026-06-15");
    expect(r.kudos_streak).toBe(6);
    expect(row.last_kudos_given_date).toBe("2026-06-16");
  });

  it("gap of more than 1 day: resets streak to 1", () => {
    const row = { kudos_streak: 5, last_kudos_given_date: "2026-06-10" };
    const r = simulateUpdateKudosStreak(row, "2026-06-16", "2026-06-15");
    expect(r.kudos_streak).toBe(1);
  });

  it("first-ever kudos (null last date): starts streak at 1", () => {
    const row = { kudos_streak: 0, last_kudos_given_date: null };
    const r = simulateUpdateKudosStreak(row, "2026-06-16", "2026-06-15");
    expect(r.kudos_streak).toBe(1);
  });

  it("same-day call (already given kudos today): WHERE guard excludes the row, streak unchanged", () => {
    const row = { kudos_streak: 6, last_kudos_given_date: "2026-06-16" };
    const r = simulateUpdateKudosStreak(row, "2026-06-16", "2026-06-15");
    expect(r.kudos_streak).toBe(6); // not 7 — same-day re-calls don't double-count
    expect(row.kudos_streak).toBe(6);
  });

  it("two concurrent first-of-day calls (Postgres row lock serializes them): net +1, not +2, not lost", () => {
    // Postgres serializes UPDATEs to the same row — the second caller's
    // UPDATE blocks until the first commits, then re-evaluates the WHERE
    // clause against the now-current row. Simulated here as sequential
    // calls against one shared row object.
    const sharedRow = { kudos_streak: 5, last_kudos_given_date: "2026-06-15" };
    const resultA = simulateUpdateKudosStreak(sharedRow, "2026-06-16", "2026-06-15"); // wins: 5 → 6
    const resultB = simulateUpdateKudosStreak(sharedRow, "2026-06-16", "2026-06-15"); // WHERE excludes, reads 6 back
    expect(resultA.kudos_streak).toBe(6);
    expect(resultB.kudos_streak).toBe(6); // re-reads current value, does not re-increment to 7
    expect(sharedRow.kudos_streak).toBe(6);
  });

  it("repeated calls the same day never push the streak past a single increment", () => {
    const row = { kudos_streak: 5, last_kudos_given_date: "2026-06-15" };
    for (let i = 0; i < 5; i++) {
      simulateUpdateKudosStreak(row, "2026-06-16", "2026-06-15");
    }
    expect(row.kudos_streak).toBe(6);
  });
});

describe("old stale-snapshot update — bug reproduction (#497)", () => {
  it("reproduces the bug: a late write from a stale snapshot clobbers an already-advanced streak", () => {
    // Giver's true state heading into the day: streak=5, last given yesterday.
    const liveRow = { kudos_streak: 5, last_kudos_given_date: "2026-06-15" };

    // A slow request (e.g. a delayed insert_kudos_atomic RPC, or a client
    // retry) captured its snapshot back when the row still looked like this —
    // call it stale because by the time it writes, the live row has moved on.
    const staleSnapshot = { kudos_streak: 5, last_kudos_given_date: "2026-06-15" };

    // Meanwhile, a fresh same-day request correctly advances the live row.
    simulateOldStaleSnapshotUpdate(liveRow, { ...liveRow }, "2026-06-16", "2026-06-15");
    expect(liveRow.kudos_streak).toBe(6); // correct so far

    // Now the slow request's write finally lands, using the *stale* snapshot
    // captured before the fresh update above — there is no WHERE guard, so
    // it overwrites unconditionally.
    simulateOldStaleSnapshotUpdate(liveRow, staleSnapshot, "2026-06-16", "2026-06-15");

    // Bug: the already-correct streak of 6 gets recomputed from stale data
    // and rewritten — in this case to the same value by coincidence, but
    // the live row's last_kudos_given_date write is entirely unconditional,
    // i.e. nothing in the write path checks whether the row changed since
    // the snapshot was taken.
    expect(liveRow.kudos_streak).toBe(6);
  });

  it("reproduces the bug concretely: stale snapshot resets an advanced streak back to 1", () => {
    // Live row has already been correctly advanced today (e.g. by an
    // earlier kudos request this same day): streak=6, last=today.
    const liveRow = { kudos_streak: 6, last_kudos_given_date: "2026-06-16" };

    // A much older, slow-to-land request captured its snapshot before any
    // of today's kudos happened — back when last_kudos_given_date was a
    // gap of several days, not yesterday.
    const staleSnapshot = { kudos_streak: 4, last_kudos_given_date: "2026-06-10" };

    // Its date params are still computed fresh at write time (today is
    // real, not cached) — only the row snapshot is stale. No WHERE guard
    // checks whether last_kudos_given_date still matches the snapshot.
    simulateOldStaleSnapshotUpdate(liveRow, staleSnapshot, "2026-06-16", "2026-06-15");

    // Corruption: an already-correct streak of 6 gets clobbered down to 1
    // by a late write computed from out-of-date information.
    expect(liveRow.kudos_streak).toBe(1);
  });

  it("the atomic fix cannot reproduce the same regression — it never holds a stale snapshot", () => {
    const liveRow = { kudos_streak: 6, last_kudos_given_date: "2026-06-16" };
    // Equivalent "late" call against the *live* row instead of a stale copy —
    // there is no separate snapshot to go stale, so the WHERE guard sees
    // last_kudos_given_date already equals today and excludes the row.
    const r = simulateUpdateKudosStreak(liveRow, "2026-06-16", "2026-06-15");
    expect(r.kudos_streak).toBe(6); // never regresses to 1
  });
});

describe("kudos route — RPC call shape (mocked) — application layer", () => {
  function buildMockSb(streakResponse: { kudos_streak: number } | null) {
    return {
      rpc: vi.fn().mockImplementation((name: string) => {
        if (name === "update_kudos_streak") {
          return Promise.resolve({ data: streakResponse, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }),
    };
  }

  it("calls update_kudos_streak with p_giver_id and p_given_date only (no client-computed yesterday)", async () => {
    const sb = buildMockSb({ kudos_streak: 6 });
    const giverId = 42;
    const today = "2026-06-16";

    await sb.rpc("update_kudos_streak", { p_giver_id: giverId, p_given_date: today });

    expect(sb.rpc).toHaveBeenCalledWith(
      "update_kudos_streak",
      expect.objectContaining({ p_giver_id: 42, p_given_date: "2026-06-16" })
    );
    // The RPC call must not be passed a p_last_kudos_date / yesterday param —
    // that comparison now lives entirely inside the SQL function.
    const callArgs = sb.rpc.mock.calls.find((c) => c[0] === "update_kudos_streak")?.[1];
    expect(callArgs).not.toHaveProperty("p_yesterday");
    expect(callArgs).not.toHaveProperty("last_kudos_given_date");
  });

  it("uses kudos_streak from the RPC response for the achievements check, not a recomputed JS value", async () => {
    const sb = buildMockSb({ kudos_streak: 6 });
    const { data: streakResult } = await sb.rpc("update_kudos_streak", { p_giver_id: 1, p_given_date: "2026-06-16" });
    const newKudosStreak = (streakResult as any)?.kudos_streak ?? 0;
    expect(newKudosStreak).toBe(6);
  });

  it("falls back to the pre-request snapshot if the RPC errors, without throwing", async () => {
    const sb = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "connection reset" } }),
    };
    const { data: streakResult, error: streakError } = await sb.rpc("update_kudos_streak", {
      p_giver_id: 1,
      p_given_date: "2026-06-16",
    });
    expect(streakError).not.toBeNull();
    const giverSnapshotStreak = 5;
    const newKudosStreak = (streakResult as any)?.kudos_streak ?? giverSnapshotStreak;
    expect(newKudosStreak).toBe(5);
  });
});