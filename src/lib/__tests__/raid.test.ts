import { describe, it, expect } from 'vitest'
import {
  getRaidTitle,
  getStrengthEstimate,
  calculateAttackScore,
  calculateDefenseScore,
  RAID_TITLES,
  MAX_RAIDS_PER_DAY,
  RAID_TAG_DURATION_DAYS,
  XP_WIN_ATTACKER,
  XP_WIN_DEFENDER,
  XP_LOSE_DEFENDER,
} from '../raid'

describe('raid.ts', () => {
  describe('getRaidTitle', () => {
    it('returns null for 0 XP', () => {
      expect(getRaidTitle(0)).toBeNull()
    })

    it('returns null for XP < 100', () => {
      expect(getRaidTitle(50)).toBeNull()
      expect(getRaidTitle(99)).toBeNull()
    })

    it('returns "Pickpocket" for 100-499 XP', () => {
      expect(getRaidTitle(100)).toBe('Pickpocket')
      expect(getRaidTitle(250)).toBe('Pickpocket')
      expect(getRaidTitle(499)).toBe('Pickpocket')
    })

    it('returns "Burglar" for 500-1999 XP', () => {
      expect(getRaidTitle(500)).toBe('Burglar')
      expect(getRaidTitle(1000)).toBe('Burglar')
      expect(getRaidTitle(1999)).toBe('Burglar')
    })

    it('returns "Heist Master" for 2000-9999 XP', () => {
      expect(getRaidTitle(2000)).toBe('Heist Master')
      expect(getRaidTitle(5000)).toBe('Heist Master')
      expect(getRaidTitle(9999)).toBe('Heist Master')
    })

    it('returns "Kingpin" for 10000+ XP', () => {
      expect(getRaidTitle(10000)).toBe('Kingpin')
      expect(getRaidTitle(50000)).toBe('Kingpin')
      expect(getRaidTitle(999999)).toBe('Kingpin')
    })

    it('progression matches RAID_TITLES constant', () => {
      for (const titleEntry of RAID_TITLES) {
        expect(getRaidTitle(titleEntry.xp)).toBe(titleEntry.title)
      }
    })
  })

  describe('getStrengthEstimate', () => {
    it('returns "weak" for 0-15 score', () => {
      expect(getStrengthEstimate(0)).toBe('weak')
      expect(getStrengthEstimate(10)).toBe('weak')
      expect(getStrengthEstimate(15)).toBe('weak')
    })

    it('returns "medium" for 16-40 score', () => {
      expect(getStrengthEstimate(16)).toBe('medium')
      expect(getStrengthEstimate(25)).toBe('medium')
      expect(getStrengthEstimate(40)).toBe('medium')
    })

    it('returns "strong" for 41+ score', () => {
      expect(getStrengthEstimate(41)).toBe('strong')
      expect(getStrengthEstimate(100)).toBe('strong')
      expect(getStrengthEstimate(9999)).toBe('strong')
    })

    it('boundary values are correct', () => {
      // Test the exact boundary values
      expect(getStrengthEstimate(15)).toBe('weak')
      expect(getStrengthEstimate(16)).toBe('medium')
      expect(getStrengthEstimate(40)).toBe('medium')
      expect(getStrengthEstimate(41)).toBe('strong')
    })
  })

  describe('calculateAttackScore', () => {
    it('base formula: commits*3 + streak + kudos*2', () => {
      const result = calculateAttackScore({
        weeklyContributions: 10,
        appStreak: 5,
        weeklyKudosGiven: 3,
      })

      const expected = 10 * 3 + 5 + 3 * 2
      expect(result.total).toBe(expected)
      expect(result.breakdown.commits).toBe(30)
      expect(result.breakdown.streak).toBe(5)
      expect(result.breakdown.kudos).toBe(6)
    })

    it('boostBonus is additive', () => {
      const withoutBoost = calculateAttackScore({
        weeklyContributions: 10,
        appStreak: 5,
        weeklyKudosGiven: 3,
      })

      const withBoost = calculateAttackScore({
        weeklyContributions: 10,
        appStreak: 5,
        weeklyKudosGiven: 3,
        boostBonus: 50,
      })

      expect(withBoost.total).toBe(withoutBoost.total + 50)
      expect(withBoost.breakdown.boost).toBe(50)
    })

    it('stealth cloak zeroes streak contribution', () => {
      const withoutCloak = calculateAttackScore({
        weeklyContributions: 10,
        appStreak: 100,
        weeklyKudosGiven: 3,
      })

      const withCloak = calculateAttackScore({
        weeklyContributions: 10,
        appStreak: 100,
        weeklyKudosGiven: 3,
        stealthCloakActive: true,
      })

      expect(withoutCloak.breakdown.streak).toBe(100)
      expect(withCloak.breakdown.streak).toBe(0)
      expect(withCloak.total).toBe(withoutCloak.total - 100)
    })

    it('EMP shield reduces total score by 20% (floors to int)', () => {
      const withoutShield = calculateAttackScore({
        weeklyContributions: 10,
        appStreak: 5,
        weeklyKudosGiven: 3,
      })

      const withShield = calculateAttackScore({
        weeklyContributions: 10,
        appStreak: 5,
        weeklyKudosGiven: 3,
        empShieldActive: true,
      })

      const expected = Math.floor(withoutShield.total * 0.8)
      expect(withShield.total).toBe(expected)
    })

    it('EMP shield and stealth cloak can be combined', () => {
      const result = calculateAttackScore({
        weeklyContributions: 10,
        appStreak: 100,
        weeklyKudosGiven: 3,
        boostBonus: 50,
        stealthCloakActive: true,
        empShieldActive: true,
      })

      // commits: 30, streak: 0 (cloak), kudos: 6, boost: 50 = 86
      // EMP shield: floor(86 * 0.8) = 68
      const baseWithoutShield = 30 + 0 + 6 + 50
      const expected = Math.floor(baseWithoutShield * 0.8)
      expect(result.total).toBe(expected)
    })
  })

  describe('calculateDefenseScore', () => {
    it('base formula: commits*3 + streak + kudos', () => {
      const result = calculateDefenseScore({
        weeklyContributions: 10,
        appStreak: 5,
        weeklyKudosReceived: 2,
      })

      const expected = 10 * 3 + 5 + 2
      expect(result.total).toBe(expected)
      expect(result.breakdown.commits).toBe(30)
      expect(result.breakdown.streak).toBe(5)
      expect(result.breakdown.kudos).toBe(2)
    })

    it('sabotage virus reduces score by 30% (floors to int)', () => {
      const withoutVirus = calculateDefenseScore({
        weeklyContributions: 10,
        appStreak: 5,
        weeklyKudosReceived: 2,
      })

      const withVirus = calculateDefenseScore({
        weeklyContributions: 10,
        appStreak: 5,
        weeklyKudosReceived: 2,
        sabotageVirusActive: true,
      })

      const expected = Math.floor(withoutVirus.total * 0.7)
      expect(withVirus.total).toBe(expected)
    })

    it('anti-missile gives +50% only on air attacks', () => {
      const noDefense = calculateDefenseScore({
        weeklyContributions: 10,
        appStreak: 5,
        weeklyKudosReceived: 2,
        antiMissileActive: true,
        isAirAttack: false,
      })

      const airDefense = calculateDefenseScore({
        weeklyContributions: 10,
        appStreak: 5,
        weeklyKudosReceived: 2,
        antiMissileActive: true,
        isAirAttack: true,
      })

      const base = 30 + 5 + 2

      expect(noDefense.total).toBe(base)
      expect(airDefense.total).toBe(Math.floor(base * 1.5))
    })

    it('anti-tank gives +50% only on ground attacks', () => {
      const noDefense = calculateDefenseScore({
        weeklyContributions: 10,
        appStreak: 5,
        weeklyKudosReceived: 2,
        antiTankActive: true,
        isGroundAttack: false,
      })

      const groundDefense = calculateDefenseScore({
        weeklyContributions: 10,
        appStreak: 5,
        weeklyKudosReceived: 2,
        antiTankActive: true,
        isGroundAttack: true,
      })

      const base = 30 + 5 + 2

      expect(noDefense.total).toBe(base)
      expect(groundDefense.total).toBe(Math.floor(base * 1.5))
    })

    it('multiple defenses can be active', () => {
      const virusAndMissile = calculateDefenseScore({
        weeklyContributions: 10,
        appStreak: 5,
        weeklyKudosReceived: 2,
        sabotageVirusActive: true,
        antiMissileActive: true,
        isAirAttack: true,
      })

      // First reduce by virus (70%), then increase by missile (150%)
      const base = 30 + 5 + 2
      const afterVirus = Math.floor(base * 0.7)
      const afterMissile = Math.floor(afterVirus * 1.5)

      expect(virusAndMissile.total).toBe(afterMissile)
    })

    it('anti-missile and anti-tank do not stack on same attack', () => {
      const bothDefenses = calculateDefenseScore({
        weeklyContributions: 10,
        appStreak: 5,
        weeklyKudosReceived: 2,
        antiMissileActive: true,
        antiTankActive: true,
        isAirAttack: true,
        isGroundAttack: false,
      })

      const base = 30 + 5 + 2
      // Only anti-missile applies since isAirAttack = true
      expect(bothDefenses.total).toBe(Math.floor(base * 1.5))
    })
  })

  describe('Constants', () => {
    it('MAX_RAIDS_PER_DAY equals 3', () => {
      expect(MAX_RAIDS_PER_DAY).toBe(3)
    })

    it('RAID_TAG_DURATION_DAYS equals 3', () => {
      expect(RAID_TAG_DURATION_DAYS).toBe(3)
    })

    it('XP_WIN_ATTACKER equals 50', () => {
      expect(XP_WIN_ATTACKER).toBe(50)
    })

    it('XP_WIN_DEFENDER equals 30', () => {
      expect(XP_WIN_DEFENDER).toBe(30)
    })

    it('XP_LOSE_DEFENDER equals 30', () => {
      expect(XP_LOSE_DEFENDER).toBe(30)
    })

    it('RAID_TITLES is ordered by XP threshold', () => {
      for (let i = 1; i < RAID_TITLES.length; i++) {
        expect(RAID_TITLES[i].xp).toBeGreaterThan(RAID_TITLES[i - 1].xp)
      }
    })
  })
})
