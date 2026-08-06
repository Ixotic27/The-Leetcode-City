import { describe, expect, it } from "vitest";
import { runBattleTests, transpilePythonSubset } from "../battleJudge";

const TWO_SUM = `def twoSum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in seen:
            return [seen[diff], i]
        seen[num] = i
    return []`;

const TWO_SUM_BRUTE = `def twoSum(nums, target):
    for i, a in enumerate(nums):
        for j, b in enumerate(nums):
            if i != j and a + b == target:
                return [i, j]
    return []`;

const MAX_AREA = `def maxArea(height):
    l, r = 0, len(height) - 1
    res = 0
    while l < r:
        width = r - l
        area = min(height[l], height[r]) * width
        res = max(res, area)
        if height[l] < height[r]:
            l += 1
        else:
            r -= 1
    return res`;

const TWO_SUM_TESTS = [
  { input: "", output: "", args: [[2, 7, 11, 15], 9], expected: [0, 1] },
  { input: "", output: "", args: [[3, 2, 4], 6], expected: [1, 2] },
  { input: "", output: "", args: [[3, 3], 6], expected: [0, 1] },
];

const MAX_AREA_TESTS = [
  { input: "", output: "", args: [[1, 8, 6, 2, 5, 4, 8, 3, 7]], expected: 49 },
  { input: "", output: "", args: [[1, 1]], expected: 1 },
  { input: "", output: "", args: [[4, 3, 2, 1, 4]], expected: 16 },
];

describe("battleJudge", () => {
  it("rejects keyword-only fake solutions", () => {
    const results = runBattleTests("# seen", "twoSum", TWO_SUM_TESTS);
    expect(results.every((r) => r.passed)).toBe(false);
  });

  it("accepts the hash-map twoSum template", () => {
    const results = runBattleTests(TWO_SUM, "twoSum", TWO_SUM_TESTS);
    expect(results.every((r) => r.passed)).toBe(true);
  });

  it("accepts an equivalent brute-force twoSum", () => {
    const results = runBattleTests(TWO_SUM_BRUTE, "twoSum", TWO_SUM_TESTS);
    expect(results.every((r) => r.passed)).toBe(true);
  });

  it("accepts the maxArea template", () => {
    const results = runBattleTests(MAX_AREA, "maxArea", MAX_AREA_TESTS);
    expect(results.every((r) => r.passed)).toBe(true);
  });

  it("fails default stub code", () => {
    const stub = `def twoSum(nums, target):\n    pass`;
    const results = runBattleTests(stub, "twoSum", TWO_SUM_TESTS);
    expect(results.every((r) => r.passed)).toBe(false);
  });

  it("transpiles enumerate loops", () => {
    const js = transpilePythonSubset(TWO_SUM);
    expect(js).toContain("function twoSum");
    expect(js).toContain("for (let i = 0;");
  });
});
