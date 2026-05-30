/**
 * Basic content moderation for sky ads.
 *
 * Blocklists for offensive content, scam patterns, and suspicious URLs.
 */

const BLOCKED_WORDS = [
  // Scam / phishing
  "free money",
  "guaranteed profit",
  "double your",
  "send btc",
  "send eth",
  "wallet recovery",
  "seed phrase",
  "private key",
  // Offensive / homophobic
  "nigger",
  "faggot",
  "retard",
  "kill yourself",
  "kys",
  "= gay",
  "is gay",
  "are gay",
  "so gay",
  "thats gay",
  "that's gay",
  "ur gay",
  "you're gay",
  "dyke",
  "tranny",
  // Spam patterns
  "buy followers",
  "get rich quick",
  "make money fast",
  "casino bonus",
  "porn",
  "xxx",
  "onlyfans",
  // Impersonation
  "official github",
  "official vercel",
  "official stripe",
];

const BLOCKED_PATTERNS = [
  /\b(?:paypal|stripe|github|google|apple)[\s-]*(?:verify|confirm|secure|login|update)/i,
  /(?:free|cheap)\s+(?:v-?bucks|robux|nitro)/i,
  /(?:crypto|nft)\s+(?:giveaway|airdrop)/i,
];

const SUSPICIOUS_LINK_PATTERNS = [
  // Phishing lookalikes
  /paypal[.-](?:verify|confirm|secure|login)/i,
  /login[.-]confirm/i,
  /account[.-](?:verify|secure|update|recovery)/i,
  /github[.-](?:verify|secure|auth|login)(?!\.com)/i,
  // IP-based URLs
  /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,
  // Excessive subdomains (common in phishing)
  /https?:\/\/(?:[^/]*\.){4,}/,
];

const SUSPICIOUS_TLDS = new Set([
  "xyz",
  "top",
  "buzz",
  "click",
  "link",
  "gq",
  "ml",
  "tk",
  "cf",
  "ga",
]);

function extractHostname(url: string): string | null {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return null;

  for (const candidate of [trimmedUrl, `https://${trimmedUrl}`]) {
    try {
      const hostname = new URL(candidate).hostname.toLowerCase();
      if (hostname) return hostname;
    } catch {
      // Try the next candidate before falling back to regex checks.
    }
  }

  return null;
}

export function containsBlockedContent(
  text: string,
): { blocked: boolean; reason?: string } {
  const lower = text.toLowerCase();

  for (const word of BLOCKED_WORDS) {
    if (lower.includes(word)) {
      return { blocked: true, reason: "Content contains prohibited language" };
    }
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      return { blocked: true, reason: "Content matches a prohibited pattern" };
    }
  }

  return { blocked: false };
}

export function isSuspiciousLink(url: string): boolean {
  const hostname = extractHostname(url);
  const tld = hostname?.split(".").pop();
  if (tld && SUSPICIOUS_TLDS.has(tld)) return true;

  for (const pattern of SUSPICIOUS_LINK_PATTERNS) {
    if (pattern.test(url)) return true;
  }
  return false;
}
