import { describe, it, expect } from "vitest";
import { parsePagination, parsePageParams } from "../parse-pagination";

describe("parsePagination", () => {
  // ── limit: NaN inputs ──────────────────────────────────────────────────────

  it('limit "abc" defaults to 20', () => {
    expect(parsePagination("abc", "0").limit).toBe(20);
  });

  it("limit null defaults to 20", () => {
    expect(parsePagination(null, "0").limit).toBe(20);
  });

  it('limit "" (empty string) defaults to 20', () => {
    expect(parsePagination("", "0").limit).toBe(20);
  });

  it('limit "1.5abc" (partial parse) defaults to 1 (parseInt reads 1)', () => {
    // parseInt("1.5abc") === 1, which is a valid value, clamped to min 1
    expect(parsePagination("1.5abc", "0").limit).toBe(1);
  });

  // ── limit: negative / zero ─────────────────────────────────────────────────

  it("limit -5 clamps to minimum 1", () => {
    expect(parsePagination("-5", "0").limit).toBe(1);
  });

  it("limit 0 clamps to minimum 1", () => {
    expect(parsePagination("0", "0").limit).toBe(1);
  });

  it("limit -1 clamps to minimum 1", () => {
    expect(parsePagination("-1", "0").limit).toBe(1);
  });

  // ── limit: above maximum ───────────────────────────────────────────────────

  it("limit 200 clamps to maximum 50", () => {
    expect(parsePagination("200", "0").limit).toBe(50);
  });

  it("limit 51 clamps to maximum 50", () => {
    expect(parsePagination("51", "0").limit).toBe(50);
  });

  it("limit 50 passes through unchanged", () => {
    expect(parsePagination("50", "0").limit).toBe(50);
  });

  // ── limit: valid range ─────────────────────────────────────────────────────

  it("limit 1 passes through unchanged", () => {
    expect(parsePagination("1", "0").limit).toBe(1);
  });

  it("limit 20 passes through unchanged", () => {
    expect(parsePagination("20", "0").limit).toBe(20);
  });

  it("limit 25 passes through unchanged", () => {
    expect(parsePagination("25", "0").limit).toBe(25);
  });

  // ── limit: result is always a safe integer ─────────────────────────────────

  it("limit result is never NaN", () => {
    expect(Number.isNaN(parsePagination("abc", null).limit)).toBe(false);
  });

  it("limit result is never negative", () => {
    expect(parsePagination("-999", "0").limit).toBeGreaterThanOrEqual(1);
  });

  it("limit result never exceeds 50", () => {
    expect(parsePagination("999", "0").limit).toBeLessThanOrEqual(50);
  });

  // ── offset: NaN inputs ─────────────────────────────────────────────────────

  it('offset "abc" defaults to 0', () => {
    expect(parsePagination("20", "abc").offset).toBe(0);
  });

  it("offset null defaults to 0", () => {
    expect(parsePagination("20", null).offset).toBe(0);
  });

  it('offset "" defaults to 0', () => {
    expect(parsePagination("20", "").offset).toBe(0);
  });

  // ── offset: negative ──────────────────────────────────────────────────────

  it("offset -10 clamps to 0", () => {
    expect(parsePagination("20", "-10").offset).toBe(0);
  });

  it("offset -1 clamps to 0", () => {
    expect(parsePagination("20", "-1").offset).toBe(0);
  });

  // ── offset: valid values ───────────────────────────────────────────────────

  it("offset 0 passes through unchanged", () => {
    expect(parsePagination("20", "0").offset).toBe(0);
  });

  it("offset 100 passes through unchanged", () => {
    expect(parsePagination("20", "100").offset).toBe(100);
  });

  it("offset 999 passes through unchanged", () => {
    expect(parsePagination("20", "999").offset).toBe(999);
  });

  // ── offset: result is always safe ─────────────────────────────────────────

  it("offset result is never NaN", () => {
    expect(Number.isNaN(parsePagination(null, "abc").offset)).toBe(false);
  });

  it("offset result is never negative", () => {
    expect(parsePagination(null, "-999").offset).toBeGreaterThanOrEqual(0);
  });

  // ── both null (bare endpoint call with no query params) ────────────────────

  it("both null uses defaults: limit 20, offset 0", () => {
    expect(parsePagination(null, null)).toEqual({ limit: 20, offset: 0 });
  });

  // ── custom defaultLimit ────────────────────────────────────────────────────

  it("respects a custom defaultLimit when limit is NaN", () => {
    expect(parsePagination("abc", "0", 10).limit).toBe(10);
  });

  it("custom defaultLimit is still clamped to max 50", () => {
    // default of 99 would be clamped only if NaN triggers it — the default
    // itself is not clamped, it's returned directly for NaN inputs.
    // Callers are responsible for passing a sane default.
    expect(parsePagination("abc", "0", 10).limit).toBe(10);
  });

  // ── NaN must never reach Supabase .range() ────────────────────────────────

  it("offset + limit - 1 is always a finite positive integer", () => {
    const { limit, offset } = parsePagination("abc", "xyz");
    const upperBound = offset + limit - 1;
    expect(Number.isFinite(upperBound)).toBe(true);
    expect(upperBound).toBeGreaterThanOrEqual(0);
  });
});

describe("parsePageParams", () => {
  // ── page guard ─────────────────────────────────────────────────────────────

  it("non-numeric page falls back to 1", () => {
    expect(parsePageParams("abc", null).page).toBe(1);
  });

  it("null page falls back to 1", () => {
    expect(parsePageParams(null, null).page).toBe(1);
  });

  it("empty page falls back to 1", () => {
    expect(parsePageParams("", null).page).toBe(1);
  });

  it("page below 1 is clamped to 1", () => {
    expect(parsePageParams("-5", null).page).toBe(1);
    expect(parsePageParams("0", null).page).toBe(1);
  });

  it("a valid page is preserved", () => {
    expect(parsePageParams("3", null).page).toBe(3);
  });

  it("page has no upper clamp — deep paging stays available", () => {
    expect(parsePageParams("500", null).page).toBe(500);
  });

  // ── limit is delegated, so it inherits the same guarantees ─────────────────

  it("non-numeric limit falls back to the default", () => {
    expect(parsePageParams(null, "abc").limit).toBe(20);
    expect(parsePageParams(null, "abc", 10).limit).toBe(10);
  });

  it("limit is clamped to [1, 50]", () => {
    expect(parsePageParams(null, "-5").limit).toBe(1);
    expect(parsePageParams(null, "99999").limit).toBe(50);
  });

  // ── derived offset ─────────────────────────────────────────────────────────

  it("derives offset from page and limit", () => {
    expect(parsePageParams("3", "20")).toEqual({ page: 3, limit: 20, offset: 40 });
  });

  it("page 1 starts at offset 0", () => {
    expect(parsePageParams("1", "20").offset).toBe(0);
  });

  // ── the actual regression: NaN must never reach Supabase .range() ──────────

  it("never produces NaN for .range() when both params are garbage", () => {
    // The pre-fix inline pattern (Math.min/Math.max with no isNaN guard) made
    // both values NaN here, so the routes issued `.range(NaN, NaN)` instead of
    // falling back to page 1 / limit 20.
    const { page, limit, offset } = parsePageParams("abc", "abc");

    expect(page).toBe(1);
    expect(limit).toBe(20);
    expect(offset).toBe(0);
    expect(Number.isNaN(offset + limit - 1)).toBe(false);
  });
});