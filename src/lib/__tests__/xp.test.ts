import { describe, it, expect } from 'vitest'
import {
  xpForLevel,
  xpDeltaForLevel,
  levelFromXp,
  tierFromLevel,
  rankFromLevel,
  levelProgress,
  calculateLeetcodeXp,
  xpForAchievementTier,
  XP_TIERS,
  XP_RANKS,
  DAILY_XP_CAP,
  ENGAGEMENT_SOURCES,
} from '../xp'

describe('xp.ts', () => {
  describe('xpForLevel', () => {
    it('returns 0 for level 1', () => {
      expect(xpForLevel(1)).toBe(0)
    })

    it('returns 0 for level <= 0', () => {
      expect(xpForLevel(0)).toBe(0)
      expect(xpForLevel(-1)).toBe(0)
    })

    it('returns 114 for level 2', () => {
      expect(xpForLevel(2)).toBe(114)
    })

    it('is monotonically increasing', () => {
      let prev = xpForLevel(1)
      for (let level = 2; level <= 25; level++) {
        const curr = xpForLevel(level)
        expect(curr).toBeGreaterThan(prev)
        prev = curr
      }
    })

    it('grows exponentially (level 25 > 10x level 5)', () => {
      const xp5 = xpForLevel(5)
      const xp25 = xpForLevel(25)
      expect(xp25).toBeGreaterThan(xp5 * 10)
    })
  })

  describe('xpDeltaForLevel', () => {
    it('always returns positive values', () => {
      for (let level = 1; level <= 25; level++) {
        expect(xpDeltaForLevel(level)).toBeGreaterThan(0)
      }
    })

    it('equals xpForLevel(n+1) - xpForLevel(n)', () => {
      for (let level = 1; level <= 24; level++) {
        const delta = xpDeltaForLevel(level)
        const expected = xpForLevel(level + 1) - xpForLevel(level)
        expect(delta).toBe(expected)
      }
    })

    it('increases with level (harder to level up as you progress)', () => {
      expect(xpDeltaForLevel(5)).toBeGreaterThan(xpDeltaForLevel(2))
      expect(xpDeltaForLevel(20)).toBeGreaterThan(xpDeltaForLevel(10))
    })
  })

  describe('levelFromXp', () => {
    it('returns 1 for 0 XP', () => {
      expect(levelFromXp(0)).toBe(1)
    })

    it('always returns >= 1', () => {
      expect(levelFromXp(-100)).toBe(1)
      expect(levelFromXp(-1)).toBe(1)
    })

    it('is inverse of xpForLevel within a level', () => {
      for (let level = 1; level <= 20; level++) {
        const levelXp = xpForLevel(level)
        const nextLevelXp = xpForLevel(level + 1)
        const midXp = levelXp + Math.floor((nextLevelXp - levelXp) / 2)

        expect(levelFromXp(levelXp)).toBe(level)
        expect(levelFromXp(midXp)).toBe(level)
        expect(levelFromXp(nextLevelXp - 1)).toBe(level)
      }
    })

    it('advances level at correct XP thresholds', () => {
      const level3Xp = xpForLevel(3)
      const level4Xp = xpForLevel(4)

      expect(levelFromXp(level3Xp)).toBe(3)
      expect(levelFromXp(level4Xp)).toBe(4)
      expect(levelFromXp(level4Xp - 1)).toBe(3)
    })
  })

  describe('tierFromLevel', () => {
    it('returns novice tier for levels 1-4', () => {
      for (let level = 1; level <= 4; level++) {
        const tier = tierFromLevel(level)
        expect(tier.id).toBe('novice')
        expect(tier.minLevel).toBe(1)
        expect(tier.maxLevel).toBe(4)
      }
    })

    it('returns apprentice tier for levels 5-8', () => {
      for (let level = 5; level <= 8; level++) {
        const tier = tierFromLevel(level)
        expect(tier.id).toBe('apprentice')
      }
    })

    it('returns specialist tier for levels 9-13', () => {
      for (let level = 9; level <= 13; level++) {
        const tier = tierFromLevel(level)
        expect(tier.id).toBe('specialist')
      }
    })

    it('returns expert tier for levels 14-18', () => {
      for (let level = 14; level <= 18; level++) {
        const tier = tierFromLevel(level)
        expect(tier.id).toBe('expert')
      }
    })

    it('returns knight tier for levels 19-23', () => {
      for (let level = 19; level <= 23; level++) {
        const tier = tierFromLevel(level)
        expect(tier.id).toBe('knight')
      }
    })

    it('returns guardian tier for levels 24+', () => {
      for (let level = 24; level <= 50; level++) {
        const tier = tierFromLevel(level)
        expect(tier.id).toBe('guardian')
      }
    })

    it('returns novice for invalid levels', () => {
      const tier = tierFromLevel(-5)
      expect(tier.id).toBe('novice')
    })
  })

  describe('rankFromLevel', () => {
    it('returns specific titles for known levels 1-24', () => {
      expect(rankFromLevel(1).title).toBe('First AC')
      expect(rankFromLevel(5).title).toBe('Hash Mapper')
      expect(rankFromLevel(10).title).toBe('Stack Master')
      expect(rankFromLevel(20).title).toBe('Memoization Ace')
      expect(rankFromLevel(24).title).toBe('Guardian')
    })

    it('returns "Legend" for levels >= 25', () => {
      expect(rankFromLevel(25).title).toBe('Legend')
      expect(rankFromLevel(26).title).toBe('Legend')
      expect(rankFromLevel(100).title).toBe('Legend')
    })

    it('returns "Hello World" for unknown levels', () => {
      expect(rankFromLevel(0).title).toBe('Hello World')
      expect(rankFromLevel(-1).title).toBe('Hello World')
      expect(rankFromLevel(999).title).toMatch(/Legend|Hello World/) // 999 > 25 so Legend
    })

    it('includes correct tier for returned rank', () => {
      const rank1 = rankFromLevel(1)
      expect(rank1.tier.id).toBe('novice')

      const rank15 = rankFromLevel(15)
      expect(rank15.tier.id).toBe('expert')

      const rank25 = rankFromLevel(25)
      expect(rank25.tier.id).toBe('guardian')
    })

    it('matches XP_RANKS for defined levels 1-24', () => {
      for (const xpRank of XP_RANKS.slice(0, 24)) {
        const result = rankFromLevel(xpRank.level)
        expect(result.title).toBe(xpRank.title)
        expect(result.tier.id).toBe(xpRank.tier.id)
      }
    })
  })

  describe('levelProgress', () => {
    it('returns value between 0 and 1', () => {
      const testXpValues = [0, 50, 100, 500, 1000, 5000, 10000]
      for (const xp of testXpValues) {
        const progress = levelProgress(xp)
        expect(progress).toBeGreaterThanOrEqual(0)
        expect(progress).toBeLessThanOrEqual(1)
      }
    })

    it('returns 0 at exact level XP threshold', () => {
      for (let level = 1; level <= 10; level++) {
        const levelXp = xpForLevel(level)
        const progress = levelProgress(levelXp)
        expect(progress).toBe(0)
      }
    })

    it('returns close to 1 near next level', () => {
      for (let level = 1; level <= 10; level++) {
        const nextLevelXp = xpForLevel(level + 1)
        const progress = levelProgress(nextLevelXp - 1)
        expect(progress).toBeGreaterThan(0.9)
      }
    })

    it('increases monotonically within a level', () => {
      const level = 5
      const startXp = xpForLevel(level)
      const endXp = xpForLevel(level + 1)
      const midXp = startXp + Math.floor((endXp - startXp) / 2)

      const prog1 = levelProgress(startXp)
      const prog2 = levelProgress(midXp)
      const prog3 = levelProgress(endXp - 1)

      expect(prog2).toBeGreaterThan(prog1)
      expect(prog3).toBeGreaterThan(prog2)
    })
  })

  describe('calculateLeetcodeXp', () => {
    it('returns non-zero for developer with all zeros (uses Math.max(input, 1))', () => {
      const xp = calculateLeetcodeXp({
        easy_solved: 0,
        medium_solved: 0,
        hard_solved: 0,
        contest_rating: 0,
        lc_streak: 0,
      })
      // log2(1+1)*3 + log2(1+1)*6 + log2(1+1)*12 = 2*3 + 2*6 + 2*12 = 42
      // Actually: floor(log2(2)*3) + floor(log2(2)*6) + floor(log2(2)*12) = 3 + 6 + 12 = 21
      expect(xp).toBe(21)
    })

    it('scales hard > medium > easy per unit with higher counts', () => {
      const easy10 = calculateLeetcodeXp({
        easy_solved: 10,
        medium_solved: 0,
        hard_solved: 0,
        contest_rating: 0,
        lc_streak: 0,
      })

      const medium10 = calculateLeetcodeXp({
        easy_solved: 0,
        medium_solved: 10,
        hard_solved: 0,
        contest_rating: 0,
        lc_streak: 0,
      })

      const hard10 = calculateLeetcodeXp({
        easy_solved: 0,
        medium_solved: 0,
        hard_solved: 10,
        contest_rating: 0,
        lc_streak: 0,
      })

      expect(hard10).toBeGreaterThan(medium10)
      expect(medium10).toBeGreaterThan(easy10)
    })

    it('contest rating <= 1400 gives no bonus', () => {
      const low = calculateLeetcodeXp({
        easy_solved: 10,
        medium_solved: 10,
        hard_solved: 10,
        contest_rating: 1000,
        lc_streak: 0,
      })

      const exact = calculateLeetcodeXp({
        easy_solved: 10,
        medium_solved: 10,
        hard_solved: 10,
        contest_rating: 1400,
        lc_streak: 0,
      })

      expect(low).toBe(exact)
    })

    it('contest rating > 1400 gives increasing XP', () => {
      const base = calculateLeetcodeXp({
        easy_solved: 10,
        medium_solved: 10,
        hard_solved: 10,
        contest_rating: 1400,
        lc_streak: 0,
      })

      const high = calculateLeetcodeXp({
        easy_solved: 10,
        medium_solved: 10,
        hard_solved: 10,
        contest_rating: 2000,
        lc_streak: 0,
      })

      expect(high).toBeGreaterThan(base)
    })

    it('streak adds XP linearly (1.5x streak)', () => {
      const base = calculateLeetcodeXp({
        easy_solved: 10,
        medium_solved: 10,
        hard_solved: 10,
        contest_rating: 1500,
        lc_streak: 0,
      })

      const streak5 = calculateLeetcodeXp({
        easy_solved: 10,
        medium_solved: 10,
        hard_solved: 10,
        contest_rating: 1500,
        lc_streak: 5,
      })

      const streak10 = calculateLeetcodeXp({
        easy_solved: 10,
        medium_solved: 10,
        hard_solved: 10,
        contest_rating: 1500,
        lc_streak: 10,
      })

      // 1.5 * 5 = 7.5 ≈ 7, 1.5 * 10 = 15
      expect(streak5).toBe(base + 7)
      expect(streak10).toBe(base + 15)
    })

    it('is monotonic with increasing input values', () => {
      const dev1 = {
        easy_solved: 10,
        medium_solved: 10,
        hard_solved: 10,
        contest_rating: 1500,
        lc_streak: 5,
      }

      const dev2 = { ...dev1, easy_solved: 20 }
      const dev3 = { ...dev1, medium_solved: 20 }
      const dev4 = { ...dev1, hard_solved: 20 }
      const dev5 = { ...dev1, contest_rating: 2000 }
      const dev6 = { ...dev1, lc_streak: 10 }

      const base = calculateLeetcodeXp(dev1)

      expect(calculateLeetcodeXp(dev2)).toBeGreaterThan(base)
      expect(calculateLeetcodeXp(dev3)).toBeGreaterThan(base)
      expect(calculateLeetcodeXp(dev4)).toBeGreaterThan(base)
      expect(calculateLeetcodeXp(dev5)).toBeGreaterThan(base)
      expect(calculateLeetcodeXp(dev6)).toBeGreaterThan(base)
    })
  })

  describe('xpForAchievementTier', () => {
    it('returns 10 for bronze', () => {
      expect(xpForAchievementTier('bronze')).toBe(10)
    })

    it('returns 25 for silver', () => {
      expect(xpForAchievementTier('silver')).toBe(25)
    })

    it('returns 50 for gold', () => {
      expect(xpForAchievementTier('gold')).toBe(50)
    })

    it('returns 100 for diamond', () => {
      expect(xpForAchievementTier('diamond')).toBe(100)
    })

    it('returns 0 for unknown tier', () => {
      expect(xpForAchievementTier('unknown')).toBe(0)
      expect(xpForAchievementTier('')).toBe(0)
    })
  })

  describe('Constants', () => {
    it('XP_TIERS are properly ordered and non-overlapping', () => {
      for (let i = 0; i < XP_TIERS.length; i++) {
        const tier = XP_TIERS[i]
        expect(tier.minLevel).toBeLessThanOrEqual(tier.maxLevel)

        if (i > 0) {
          const prevTier = XP_TIERS[i - 1]
          expect(tier.minLevel).toBe(prevTier.maxLevel + 1)
        }
      }
    })

    it('XP_RANKS has entries for all levels 1-25', () => {
      expect(XP_RANKS.length).toBe(25)
      for (let level = 1; level <= 25; level++) {
        const rank = XP_RANKS[level - 1]
        expect(rank.level).toBe(level)
      }
    })

    it('DAILY_XP_CAP equals 150', () => {
      expect(DAILY_XP_CAP).toBe(150)
    })

    it('ENGAGEMENT_SOURCES contains expected keys', () => {
      expect(ENGAGEMENT_SOURCES.has('checkin')).toBe(true)
      expect(ENGAGEMENT_SOURCES.has('dailies')).toBe(true)
      expect(ENGAGEMENT_SOURCES.has('kudos_given')).toBe(true)
      expect(ENGAGEMENT_SOURCES.has('visit')).toBe(true)
      expect(ENGAGEMENT_SOURCES.has('fly')).toBe(true)
      expect(ENGAGEMENT_SOURCES.has('raid_win')).toBe(false)
    })
  })
})
