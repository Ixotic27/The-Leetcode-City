# 🇮🇳 LeetCode City — Indian Cities Multiverse

## Master Implementation Plan

> **Theme**: LeetCode City retro pixel art — `#ffa116` orange accent, `#0d0d0f` dark base,
> Silkscreen font, voxel buildings, emissive glow, dark-mode aesthetic.

---

## Phase 0: Fix Current Issues (START HERE)

### 0A. Scale Up Monuments to Central Tower Visibility

- Current: VidhanaSoudha ~45 units, BangalorePalace ~55 units, Fort Walls ~9 units
- Target: All 3× scale — VidhanaSoudha 120+, BangalorePalace 100+, Fort Walls 25+
- Scale ALL scatter decorations (NandiBull, GatewayArch, ClockTower, TempleGopuram) by 3×

### 0B. Spread Custom Landmark Buildings Across Full City

- Current: `landmarkPositions` uses hardcoded radius `280 + random() * 260`
- Fix: Use `cityRadius * 0.4` to `cityRadius * 1.3` — landmarks fill the whole city footprint
- Ensure no landmark overlaps the river channel (|z| < 95)

### 0C. DailyQuestionsLandmark Hardcoded Position

- Currently at `[373, 0, -75]` — needs to be part of dynamic landmarkPositions

---

## Phase 1-7: See full plan in conversation
