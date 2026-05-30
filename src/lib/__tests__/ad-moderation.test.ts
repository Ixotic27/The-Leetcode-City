import { containsBlockedContent, isSuspiciousLink } from '../ad-moderation';

describe('ad-moderation utilities (pure)', () => {
  it('containsBlockedContent detects blocked words (case-insensitive)', () => {
    expect(containsBlockedContent('This is FREE MONEY!!!')).toEqual({ blocked: true, reason: 'Content contains prohibited language' });
    expect(containsBlockedContent('totally ok')).toEqual({ blocked: false });
  });

  it('containsBlockedContent detects blocked patterns like crypto giveaways', () => {
    const res = containsBlockedContent('crypto giveaway airdrop');
    expect(res.blocked).toBe(true);
    expect(res.reason).toBe('Content matches a prohibited pattern');
  });

  it('isSuspiciousLink detects common phishing-like patterns', () => {
    expect(isSuspiciousLink('https://paypal.verify-login.com')).toBe(true);
    expect(isSuspiciousLink('https://example.com')).toBe(false);
  });

  it('isSuspiciousLink detects IP-based URLs', () => {
    expect(isSuspiciousLink('http://192.168.0.1/account/secure')).toBe(true);
  });

  it('isSuspiciousLink detects suspicious TLDs with paths and query strings', () => {
    expect(isSuspiciousLink('https://promo.xyz/path')).toBe(true);
    expect(isSuspiciousLink('https://promo.top/?campaign=1')).toBe(true);
    expect(isSuspiciousLink('promo.xyz/path')).toBe(true);
    expect(isSuspiciousLink('www.promo.top')).toBe(true);
    expect(isSuspiciousLink('https://safe.example.com/path')).toBe(false);
  });
});
