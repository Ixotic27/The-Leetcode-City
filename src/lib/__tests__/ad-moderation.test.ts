import { describe, it, expect } from 'vitest'
import { containsBlockedContent, isSuspiciousLink } from '../ad-moderation'

describe('ad-moderation.ts', () => {
  describe('containsBlockedContent', () => {
    describe('clean content', () => {
      it('returns blocked: false for empty string', () => {
        const result = containsBlockedContent('')
        expect(result.blocked).toBe(false)
        expect(result.reason).toBeUndefined()
      })

      it('returns blocked: false for normal text', () => {
        const result = containsBlockedContent('Check out my new coding project!')
        expect(result.blocked).toBe(false)
      })

      it('returns blocked: false for legitimate links', () => {
        const result = containsBlockedContent('Visit https://github.com/user/repo for code')
        expect(result.blocked).toBe(false)
      })
    })

    describe('blocked words', () => {
      it('blocks scam phrases like "free money"', () => {
        const result = containsBlockedContent('Win free money now!')
        expect(result.blocked).toBe(true)
        expect(result.reason).toContain('prohibited language')
      })

      it('blocks "guaranteed profit"', () => {
        const result = containsBlockedContent('guaranteed profit from crypto')
        expect(result.blocked).toBe(true)
      })

      it('blocks "send btc"', () => {
        const result = containsBlockedContent('send btc to get rich')
        expect(result.blocked).toBe(true)
      })

      it('blocks "send eth"', () => {
        const result = containsBlockedContent('send eth now')
        expect(result.blocked).toBe(true)
      })

      it('blocks spam phrases like "make money fast"', () => {
        const result = containsBlockedContent('make money fast today')
        expect(result.blocked).toBe(true)
      })

      it('blocks "buy followers"', () => {
        const result = containsBlockedContent('buy followers for cheap')
        expect(result.blocked).toBe(true)
      })

      it('blocks offensive content', () => {
        const result = containsBlockedContent('This is very offensive content')
        expect(result.blocked).toBe(false) // This specific text is not in the blocklist

        const result2 = containsBlockedContent('you are retard')
        expect(result2.blocked).toBe(true)
      })

      it('is case-insensitive', () => {
        const lower = containsBlockedContent('free money')
        const upper = containsBlockedContent('FREE MONEY')
        const mixed = containsBlockedContent('FrEe MoNeY')

        expect(lower.blocked).toBe(true)
        expect(upper.blocked).toBe(true)
        expect(mixed.blocked).toBe(true)
      })
    })

    describe('blocked patterns', () => {
      it('blocks phishing patterns like "paypal verify"', () => {
        const result = containsBlockedContent('paypal-verify-account')
        expect(result.blocked).toBe(true)
      })

      it('blocks "stripe confirm"', () => {
        const result = containsBlockedContent('stripe confirm payment')
        expect(result.blocked).toBe(true)
      })

      it('blocks "github login"', () => {
        const result = containsBlockedContent('github-login-secure')
        expect(result.blocked).toBe(true)
      })

      it('blocks virtual currency giveaways', () => {
        const result = containsBlockedContent('free v-bucks giveaway')
        expect(result.blocked).toBe(true)
      })

      it('blocks "robux free"', () => {
        const result = containsBlockedContent('cheap robux deal')
        expect(result.blocked).toBe(true)
      })

      it('blocks "free nitro"', () => {
        const result = containsBlockedContent('free nitro giveaway')
        expect(result.blocked).toBe(true)
      })

      it('blocks crypto giveaways', () => {
        const result = containsBlockedContent('crypto airdrop incoming')
        expect(result.blocked).toBe(true)
      })

      it('blocks "nft giveaway"', () => {
        const result = containsBlockedContent('nft giveaway for followers')
        expect(result.blocked).toBe(true)
      })
    })

    describe('multiple violations', () => {
      it('stops at first violation', () => {
        const result = containsBlockedContent('free money and robux giveaway')
        expect(result.blocked).toBe(true)
      })
    })
  })

  describe('isSuspiciousLink', () => {
    describe('clean URLs', () => {
      it('returns false for legitimate HTTPS URLs', () => {
        expect(isSuspiciousLink('https://github.com/user')).toBe(false)
        expect(isSuspiciousLink('https://google.com')).toBe(false)
        expect(isSuspiciousLink('https://stackoverflow.com/questions/123')).toBe(false)
      })

      it('returns false for legitimate HTTP URLs', () => {
        expect(isSuspiciousLink('http://example.com')).toBe(false)
      })

      it('returns false for URLs with subdomains', () => {
        expect(isSuspiciousLink('https://docs.github.com/en/articles')).toBe(false)
      })
    })

    describe('IP-based URLs', () => {
      it('returns true for IP-based URLs', () => {
        expect(isSuspiciousLink('https://192.168.1.1')).toBe(true)
        expect(isSuspiciousLink('http://10.0.0.1/admin')).toBe(true)
        expect(isSuspiciousLink('https://172.16.0.1')).toBe(true)
      })
    })

    describe('phishing lookalikes', () => {
      it('returns true for paypal phishing patterns', () => {
        expect(isSuspiciousLink('https://paypal.verify-account.com')).toBe(true)
        expect(isSuspiciousLink('http://paypal-secure.com')).toBe(true)
      })

      it('returns true for github phishing patterns (not *.github.com)', () => {
        expect(isSuspiciousLink('https://github-verify.xyz')).toBe(true)
        expect(isSuspiciousLink('http://github.secure.xyz')).toBe(true)
      })

      it('returns true for account recovery phishing', () => {
        expect(isSuspiciousLink('https://account.verify.com')).toBe(true)
        expect(isSuspiciousLink('http://account-recovery.com')).toBe(true)
      })

      it('returns false for legitimate github.com auth URLs', () => {
        expect(isSuspiciousLink('https://github.com/login')).toBe(false)
        expect(isSuspiciousLink('https://github.com/auth/verify')).toBe(false)
      })
    })

    describe('suspicious TLDs', () => {
      it('returns true for known scam TLDs', () => {
        expect(isSuspiciousLink('https://example.xyz')).toBe(true)
        expect(isSuspiciousLink('https://example.tk')).toBe(true)
        expect(isSuspiciousLink('https://example.ml')).toBe(true)
        expect(isSuspiciousLink('https://example.gq')).toBe(true)
        expect(isSuspiciousLink('https://example.ga')).toBe(true)
        expect(isSuspiciousLink('https://example.cf')).toBe(true)
        expect(isSuspiciousLink('https://example.click')).toBe(true)
        expect(isSuspiciousLink('https://example.link')).toBe(true)
        expect(isSuspiciousLink('https://example.buzz')).toBe(true)
        expect(isSuspiciousLink('https://example.top')).toBe(true)
      })

      it('returns false for legitimate TLDs', () => {
        expect(isSuspiciousLink('https://example.com')).toBe(false)
        expect(isSuspiciousLink('https://example.org')).toBe(false)
        expect(isSuspiciousLink('https://example.io')).toBe(false)
        expect(isSuspiciousLink('https://example.dev')).toBe(false)
      })
    })

    describe('excessive subdomains', () => {
      it('returns true for 4+ subdomains (phishing indicator)', () => {
        expect(isSuspiciousLink('https://a.b.c.d.example.com')).toBe(true)
        expect(isSuspiciousLink('https://mail.verify.account.secure.example.com')).toBe(true)
      })

      it('returns false for 1-3 subdomains', () => {
        expect(isSuspiciousLink('https://sub.example.com')).toBe(false)
        expect(isSuspiciousLink('https://a.b.example.com')).toBe(false)
        // 3 subdomains exactly: a, b, c = 3, but pattern requires 4+
        expect(isSuspiciousLink('https://docs.api.github.com')).toBe(false)
      })
    })

    describe('combined suspicious patterns', () => {
      it('returns true for IP + high port', () => {
        expect(isSuspiciousLink('https://192.168.1.1:8080')).toBe(true)
      })

      it('returns true for excessive subdomains + scam TLD', () => {
        expect(isSuspiciousLink('https://a.b.c.d.example.xyz')).toBe(true)
      })
    })
  })
})
