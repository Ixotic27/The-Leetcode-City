/**
 * Sanitizes LED banner text before storage.
 *
 * Strips:
 *  - C0/C1 control characters (U+0000–001F, U+007F–009F)
 *  - Zero-width and bidirectional override characters that appear visually
 *    empty but carry hidden content or reverse text rendering
 *  - Any HTML/XML tag fragments (belt-and-suspenders — the rendering path
 *    is WebGL, not DOM, but we sanitize at ingress regardless)
 *
 * Then collapses whitespace runs, trims, and enforces the 100-char limit
 * *after* stripping so the length check operates on what actually gets stored.
 *
 * Returns null when the cleaned string is empty so callers can treat it
 * identically to an explicit clear request.
 */
export function sanitizeLedBannerText(raw: string): string | null {
  const sanitized = raw
    // C0 control chars (NUL … US) except \t, \n, \r, and DEL, C1 block (PAD … APC)
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, "")
    // Zero-width spaces, joiners, non-joiners, word-joiners
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    // Bidirectional override and embedding characters
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "")
    // Soft hyphen (invisible but affects copy-paste)
    .replace(/\u00AD/g, "")
    // Strip entire script tags and their contents
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    // Strip any HTML/XML tag fragments
    .replace(/<[^>]*>/g, "")
    // Collapse internal whitespace runs to a single space
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 100);

  return sanitized.length > 0 ? sanitized : null;
}