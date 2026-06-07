import { describe, it, expect } from "vitest";
import { sanitizeLedBannerText } from "../sanitize-led-banner";

describe("sanitizeLedBannerText", () => {
  // ── Happy path ──────────────────────────────────────────────────────────────

  it("returns normal ASCII text unchanged", () => {
    expect(sanitizeLedBannerText("Hello, world!")).toBe("Hello, world!");
  });

  it("preserves emoji (valid unicode scalar values)", () => {
    expect(sanitizeLedBannerText("LeetCode City 🔥🏙️")).toBe("LeetCode City 🔥🏙️");
  });

  it("preserves accented and CJK characters", () => {
    expect(sanitizeLedBannerText("café 東京 Ünïcödé")).toBe("café 東京 Ünïcödé");
  });

  it("trims leading and trailing whitespace", () => {
    expect(sanitizeLedBannerText("  hello  ")).toBe("hello");
  });

  it("collapses internal whitespace runs to a single space", () => {
    expect(sanitizeLedBannerText("hello    world\t\ttabs")).toBe("hello world tabs");
  });

  // ── Length enforcement ───────────────────────────────────────────────────────

  it("truncates to 100 chars after sanitization", () => {
    const long = "a".repeat(150);
    expect(sanitizeLedBannerText(long)).toHaveLength(100);
  });

  it("truncates after stripping, not before — control chars don't consume budget", () => {
    // 50 control chars + 90 visible chars → after strip: 90 visible chars (< 100)
    const input = "\u0001".repeat(50) + "x".repeat(90);
    const result = sanitizeLedBannerText(input);
    expect(result).toBe("x".repeat(90));
  });

  // ── Control character stripping ──────────────────────────────────────────────

  it("strips C0 control characters (U+0000–001F)", () => {
    expect(sanitizeLedBannerText("hel\u0000lo\u0001\u001Fworld")).toBe("helloworld");
  });

  it("strips DEL (U+007F) and C1 block (U+0080–009F)", () => {
    expect(sanitizeLedBannerText("hel\u007Flo\u0080\u009Fworld")).toBe("helloworld");
  });

  it("strips null byte embedded in text", () => {
    expect(sanitizeLedBannerText("abc\u0000def")).toBe("abcdef");
  });

  // ── Zero-width and invisible characters ────────────────────────────────────

  it("strips zero-width space (U+200B)", () => {
    expect(sanitizeLedBannerText("a\u200Bb")).toBe("ab");
  });

  it("strips zero-width non-joiner and joiner (U+200C, U+200D)", () => {
    expect(sanitizeLedBannerText("a\u200Cb\u200Dc")).toBe("abc");
  });

  it("strips BOM / zero-width no-break space (U+FEFF)", () => {
    expect(sanitizeLedBannerText("\uFEFFhello")).toBe("hello");
  });

  it("strips soft hyphen (U+00AD)", () => {
    expect(sanitizeLedBannerText("hel\u00ADlo")).toBe("hello");
  });

  it("strips word joiner (U+2060)", () => {
    expect(sanitizeLedBannerText("a\u2060b")).toBe("ab");
  });

  // ── Bidirectional override characters ───────────────────────────────────────

  it("strips right-to-left override (U+202E)", () => {
    // Classic 'evil.exe' filename trick
    expect(sanitizeLedBannerText("legit\u202Eignore.exe")).toBe("legitignore.exe");
  });

  it("strips all bidi embedding/override/isolate characters", () => {
    const bidiChars = "\u200E\u200F\u202A\u202B\u202C\u202D\u202E\u2066\u2067\u2068\u2069";
    expect(sanitizeLedBannerText(`a${bidiChars}b`)).toBe("ab");
  });

  // ── HTML tag stripping ────────────────────────────────────────────────────────

  it("strips HTML script tags", () => {
    expect(sanitizeLedBannerText("<script>alert(1)</script>hi")).toBe("hi");
  });

  it("strips inline event handler attributes in tags", () => {
    expect(sanitizeLedBannerText('<img onerror="alert(1)">hello')).toBe("hello");
  });

  it("strips partial/malformed tags", () => {
    expect(sanitizeLedBannerText("hello <b>world</b>")).toBe("hello world");
  });

  // ── Empty / null-equivalent inputs ──────────────────────────────────────────

  it("returns null for an empty string", () => {
    expect(sanitizeLedBannerText("")).toBeNull();
  });

  it("returns null for a string that is entirely control characters", () => {
    expect(sanitizeLedBannerText("\u0000\u0001\u001F\u007F")).toBeNull();
  });

  it("returns null for a string that is entirely zero-width characters", () => {
    expect(sanitizeLedBannerText("\u200B\u200C\u200D\uFEFF")).toBeNull();
  });

  it("returns null for whitespace-only input", () => {
    expect(sanitizeLedBannerText("   \t\n  ")).toBeNull();
  });

  it("returns null for a string that looks non-empty but contains only stripped chars", () => {
    // Appears to be 5 chars but all invisible after sanitization
    expect(sanitizeLedBannerText("\u202E\u200B\u0000\uFEFF\u00AD")).toBeNull();
  });
});