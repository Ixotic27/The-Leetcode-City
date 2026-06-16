import { describe, it, expect, vi } from "vitest";
import { performVoteWithRollback } from "../vote-helper";

describe("performVoteWithRollback", () => {
  it("rolls back optimistic state when toggleVote throws", async () => {
    const setOptimistic = vi.fn();
    const toggleVoteFn = vi.fn(async () => {
      throw new Error("network");
    });
    await expect(
      performVoteWithRollback({ setOptimistic, toggleVoteFn, itemId: "feature_x" })
    ).rejects.toThrow("network");

    // setOptimistic called to apply optimistic state, then called again to rollback
    expect(setOptimistic).toHaveBeenCalledTimes(2);
    expect(setOptimistic).toHaveBeenNthCalledWith(1, "toggle");
    expect(setOptimistic).toHaveBeenNthCalledWith(2, "toggle");
    expect(toggleVoteFn).toHaveBeenCalledWith("feature_x");
  });

  it("does not rollback when toggleVote succeeds", async () => {
    const setOptimistic = vi.fn();
    const toggleVoteFn = vi.fn(async () => ({}));

    await performVoteWithRollback({ setOptimistic, toggleVoteFn, itemId: "feature_x" });

    expect(setOptimistic).toHaveBeenCalledTimes(1);
    expect(toggleVoteFn).toHaveBeenCalledWith("feature_x");
  });

  it("reducer toggle is reversible when applied twice", () => {
    // Recreate the reducer logic used in the component
    function toggleReducer(state: { votes: number; hasVoted: boolean }) {
      return {
        votes: state.hasVoted ? state.votes - 1 : state.votes + 1,
        hasVoted: !state.hasVoted,
      };
    }

    const initial = { votes: 10, hasVoted: false };
    const afterOne = toggleReducer(initial);
    const afterTwo = toggleReducer(afterOne);

    expect(afterTwo).toEqual(initial);
  });
});
